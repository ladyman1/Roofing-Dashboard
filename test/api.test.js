const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseRoofingCsv, detectDelimiter } = require('../src/services/csvParser');
const { initSchema } = require('../src/db/schema');
const { seedInitialData } = require('../src/services/seeder');
const { db, getDbDialect } = require('../src/db/knex');

async function runTests() {
  console.log('--- STARTING ROOFING DASHBOARD VERIFICATION TESTS ---');

  // Test 1: Delimiter detection
  console.log('[TEST 1] Testing delimiter auto-detection...');
  const tsvSample = "Date\tTOSM\tSales";
  const csvSample = "Date,TOSM,Sales";
  assert.strictEqual(detectDelimiter(tsvSample), '\t', 'Should detect TSV delimiter');
  assert.strictEqual(detectDelimiter(csvSample), ',', 'Should detect CSV delimiter');
  console.log('✓ Delimiter auto-detection passed.');

  // Test 2: CSV & TSV parsing
  console.log('[TEST 2] Testing CSV & TSV parsing from sample files...');
  const tsvPath = path.join(__dirname, '../data/sample_data.tsv');
  const tsvContent = fs.readFileSync(tsvPath, 'utf8');
  const parsedRows = parseRoofingCsv(tsvContent);

  assert.strictEqual(parsedRows.length, 20, 'Expected exactly 20 rows parsed');
  
  // Verify first row
  const r0 = parsedRows[0];
  assert.strictEqual(r0.record_date, '31/08/2026');
  assert.strictEqual(r0.iso_date, '2026-08-31');
  assert.strictEqual(r0.tosm, 0);
  assert.strictEqual(r0.subgroup, 'R');
  assert.strictEqual(r0.subgroup_description, 'ROOFING');
  assert.strictEqual(r0.sales, 6321.65);
  assert.strictEqual(r0.cost, 3921.15);
  assert.strictEqual(r0.margin, 2400.5);
  assert.strictEqual(r0.margin_pct, 37.97);
  assert.strictEqual(r0.quantity, 7634);
  assert.strictEqual(r0.invoice_tx_count, 46);
  assert.strictEqual(r0.credit_tx_count, 6);
  assert.strictEqual(r0.ytd_sales, 19199.47);
  console.log('✓ Sample data parsing passed.');

  // Test 3: Total calculations match
  console.log('[TEST 3] Verifying sum calculations...');
  const totalSales = parsedRows.reduce((sum, r) => sum + r.sales, 0);
  const totalCost = parsedRows.reduce((sum, r) => sum + r.cost, 0);
  const totalMargin = parsedRows.reduce((sum, r) => sum + r.margin, 0);
  const totalInvoices = parsedRows.reduce((sum, r) => sum + r.invoice_tx_count, 0);
  const totalCredits = parsedRows.reduce((sum, r) => sum + r.credit_tx_count, 0);

  assert.strictEqual(Number(totalSales.toFixed(2)), 203496.89, 'Total Sales must equal £203,496.89');
  assert.strictEqual(Number(totalCost.toFixed(2)), 149105.23, 'Total Cost must equal £149,105.23');
  assert.strictEqual(Number(totalMargin.toFixed(2)), 54391.66, 'Total Margin must equal £54,391.66');
  assert.strictEqual(totalInvoices, 2499, 'Total invoices must equal 2,499');
  assert.strictEqual(totalCredits, 82, 'Total credits must equal 82');
  console.log(`✓ Financial totals verified: Sales £${totalSales.toFixed(2)}, Margin £${totalMargin.toFixed(2)} (${((totalMargin/totalSales)*100).toFixed(2)}%), Invoices ${totalInvoices}, Credits ${totalCredits}`);

  // Test 4: Database schema & seeder
  console.log(`[TEST 4] Initializing schema with ${getDbDialect()}...`);
  await initSchema();

  console.log('[TEST 4b] Seeding database...');
  const seedResult = await seedInitialData(true);
  assert.strictEqual(seedResult.count, 20, 'Seed should insert 20 records');

  const dbCountRes = await db('sales_records').count('* as total').first();
  const dbCount = parseInt(dbCountRes.total || dbCountRes['count(*)'], 10);
  assert.strictEqual(dbCount, 20, 'Database should contain 20 records');
  console.log('✓ Database schema and seed verified.');

  // Test 5: Subgroup aggregation check
  console.log('[TEST 5] Verifying Subgroup aggregation in database...');
  const rbRecords = await db('sales_records').where('subgroup', 'RB');
  assert.strictEqual(rbRecords.length, 2, 'Roofing Battens (RB) should have 2 entries (Cash + Credit)');
  const rbSales = rbRecords.reduce((sum, r) => sum + Number(r.sales), 0);
  assert.strictEqual(Number(rbSales.toFixed(2)), 33735.20, 'RB total sales should be £33,735.20 (24764.32 + 8970.88)');
  console.log('✓ Subgroup aggregation verified.');

  // Test 6: Incremental multi-month upload
  console.log('[TEST 6] Verifying incremental multi-period batch insertion...');
  const [septBatchId] = await db('upload_batches').insert({
    filename: 'september_2026.csv',
    row_count: 20,
    total_sales: 203496.89,
    reporting_date: '30/09/2026'
  }).returning('id');
  const resolvedSeptId = typeof septBatchId === 'object' ? septBatchId.id : septBatchId;

  const septRecords = parsedRows.map(r => ({
    ...r,
    record_date: '30/09/2026',
    iso_date: '2026-09-30',
    batch_id: resolvedSeptId
  }));
  await db('sales_records').insert(septRecords);

  const distinctDates = await db('sales_records').distinct('record_date');
  assert.strictEqual(distinctDates.length, 2, 'Should now have 2 distinct reporting dates');
  console.log('✓ Incremental monthly batch added successfully (Aug & Sept).');

  // Test 7: Batch deletion and rollback
  console.log('[TEST 7] Verifying batch deletion and rollback...');
  await db('sales_records').where('batch_id', resolvedSeptId).del();
  await db('upload_batches').where('id', resolvedSeptId).del();

  const datesAfterDel = await db('sales_records').distinct('record_date');
  assert.strictEqual(datesAfterDel.length, 1, 'Should roll back to 1 reporting date after deletion');
  console.log('✓ Batch deletion and rollback verified.');

  // Test 8: Monthly Budget & Variance Calculation
  console.log('[TEST 8] Verifying Monthly Budget & Prior Year calculations in DB...');
  const { seedMonthlyBudgets } = require('../src/services/seeder');
  await seedMonthlyBudgets(true);

  const budgetCount = await db('monthly_budgets').count('* as total').first();
  assert.strictEqual(parseInt(budgetCount.total || budgetCount['count(*)'], 10), 12, 'Must have 12 monthly budgets');

  const augBudget = await db('monthly_budgets').where({ year: 2026, month: 8 }).first();
  assert.strictEqual(Number(augBudget.budget_sales), 195000, 'August budget sales should be £195,000');
  assert.strictEqual(Number(augBudget.prior_year_sales), 185200, 'August prior year sales should be £185,200');
  console.log('✓ Monthly budget table verified (12 months initialized).');

  // Test 9: Budget update / input simulation
  console.log('[TEST 9] Verifying budget edit / update functionality...');
  await db('monthly_budgets').where({ year: 2026, month: 8 }).update({
    budget_sales: 198000,
    budget_margin_pct: 26.5
  });
  const updatedAug = await db('monthly_budgets').where({ year: 2026, month: 8 }).first();
  assert.strictEqual(Number(updatedAug.budget_sales), 198000, 'Updated budget sales should be £198,000');
  // Reset back to 195,000
  await db('monthly_budgets').where({ year: 2026, month: 8 }).update({
    budget_sales: 195000,
    budget_margin_pct: 26.0
  });
  console.log('✓ Budget edit and persistence verified.');

  // Test 10: Entering Budget, Actual Sales and Last Year Figures for the same month
  console.log('[TEST 10] Verifying entering budget, actual sales and last year figures for the same month...');
  await db('monthly_budgets').where({ year: 2026, month: 9 }).update({
    budget_sales: 210000,
    actual_sales: 218500,
    actual_margin: 59432,
    actual_margin_pct: 27.2,
    prior_year_sales: 196000,
    prior_year_margin: 49980,
    prior_year_margin_pct: 25.5
  });

  const m9 = await db('monthly_budgets').where({ year: 2026, month: 9 }).first();
  assert.strictEqual(Number(m9.budget_sales), 210000, 'Budget sales should be £210,000');
  assert.strictEqual(Number(m9.actual_sales), 218500, 'Actual sales should be £218,500');
  assert.strictEqual(Number(m9.prior_year_sales), 196000, 'Last year sales should be £196,000');
  
  const varBudget = Number(m9.actual_sales) - Number(m9.budget_sales);
  const varPrior = Number(m9.actual_sales) - Number(m9.prior_year_sales);
  assert.strictEqual(varBudget, 8500, 'Variance vs budget should be +£8,500');
  assert.strictEqual(varPrior, 22500, 'Variance vs last year should be +£22,500');

  // Reset month 9 actual_sales back to null
  await db('monthly_budgets').where({ year: 2026, month: 9 }).update({
    actual_sales: null,
    actual_margin: null,
    actual_margin_pct: null
  });
  const m9Reset = await db('monthly_budgets').where({ year: 2026, month: 9 }).first();
  assert.strictEqual(m9Reset.actual_sales, null, 'Actual sales should be reset to null');
  console.log('✓ Entering Budget, Actual Sales, and Last Year figures for same month verified.');

  console.log('--- ALL TESTS COMPLETED SUCCESSFULLY! ---');
}

runTests()
  .then(async () => {
    await db.destroy();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('TEST FAILED:', err);
    await db.destroy();
    process.exit(1);
  });
