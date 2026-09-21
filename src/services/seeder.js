const fs = require('fs');
const path = require('path');
const { db } = require('../db/knex');
const { parseRoofingCsv } = require('./csvParser');
const { hashPassword } = require('./auth');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DEFAULT_BUDGETS_2026 = [
  { month: 1, budget_sales: 185000, budget_margin: 48100, budget_margin_pct: 26.0, prior_year_sales: 172500, prior_year_margin: 43125, prior_year_margin_pct: 25.0 },
  { month: 2, budget_sales: 190000, budget_margin: 49400, budget_margin_pct: 26.0, prior_year_sales: 178000, prior_year_margin: 45390, prior_year_margin_pct: 25.5 },
  { month: 3, budget_sales: 215000, budget_margin: 55900, budget_margin_pct: 26.0, prior_year_sales: 198400, prior_year_margin: 50592, prior_year_margin_pct: 25.5 },
  { month: 4, budget_sales: 220000, budget_margin: 57200, budget_margin_pct: 26.0, prior_year_sales: 205000, prior_year_margin: 52275, prior_year_margin_pct: 25.5 },
  { month: 5, budget_sales: 230000, budget_margin: 59800, budget_margin_pct: 26.0, prior_year_sales: 212000, prior_year_margin: 54060, prior_year_margin_pct: 25.5 },
  { month: 6, budget_sales: 225000, budget_margin: 58500, budget_margin_pct: 26.0, prior_year_sales: 210000, prior_year_margin: 53550, prior_year_margin_pct: 25.5 },
  { month: 7, budget_sales: 220000, budget_margin: 57200, budget_margin_pct: 26.0, prior_year_sales: 208500, prior_year_margin: 53167, prior_year_margin_pct: 25.5 },
  { month: 8, budget_sales: 195000, budget_margin: 50700, budget_margin_pct: 26.0, prior_year_sales: 185200, prior_year_margin: 47226, prior_year_margin_pct: 25.5 },
  { month: 9, budget_sales: 210000, budget_margin: 54600, budget_margin_pct: 26.0, prior_year_sales: 196000, prior_year_margin: 49980, prior_year_margin_pct: 25.5 },
  { month: 10, budget_sales: 215000, budget_margin: 55900, budget_margin_pct: 26.0, prior_year_sales: 202000, prior_year_margin: 51510, prior_year_margin_pct: 25.5 },
  { month: 11, budget_sales: 195000, budget_margin: 50700, budget_margin_pct: 26.0, prior_year_sales: 182000, prior_year_margin: 46410, prior_year_margin_pct: 25.5 },
  { month: 12, budget_sales: 160000, budget_margin: 41600, budget_margin_pct: 26.0, prior_year_sales: 148000, prior_year_margin: 37740, prior_year_margin_pct: 25.5 }
];

async function seedMonthlyBudgets(force = false) {
  const countRes = await db('monthly_budgets').count('* as total').first();
  const currentCount = parseInt(countRes ? (countRes.total || countRes['count(*)']) : 0, 10);
  if (currentCount >= 12 && !force) {
    return { seeded: false, count: currentCount };
  }

  if (force && currentCount > 0) {
    await db('monthly_budgets').del();
  }

  const rows = DEFAULT_BUDGETS_2026.map(b => ({
    year: 2026,
    month: b.month,
    month_name: MONTH_NAMES[b.month - 1],
    budget_sales: b.budget_sales,
    budget_margin: b.budget_margin,
    budget_margin_pct: b.budget_margin_pct,
    prior_year_sales: b.prior_year_sales,
    prior_year_margin: b.prior_year_margin,
    prior_year_margin_pct: b.prior_year_margin_pct,
    notes: '2026 Roofing Department Target & 2025 Historical'
  }));

  await db('monthly_budgets').insert(rows);
  console.log(`[SEED] Seeded ${rows.length} monthly budgets for 2026.`);
  return { seeded: true, count: rows.length };
}

async function seedDefaultUsers(force = false) {
  const countRes = await db('users').count('* as total').first();
  const currentCount = parseInt(countRes ? (countRes.total || countRes['count(*)']) : 0, 10);
  if (currentCount > 0 && !force) {
    return { seeded: false, count: currentCount };
  }

  if (force && currentCount > 0) {
    await db('users').del();
  }

  const { hash, salt } = hashPassword('admin123');
  await db('users').insert({
    username: 'admin',
    password_hash: hash,
    salt,
    role: 'admin',
    full_name: 'Administrator',
    is_active: true
  });
  console.log('[SEED] Initial admin user seeded: username "admin"');
  return { seeded: true, count: 1 };
}

async function seedInitialData(force = false) {
  // Ensure default admin user is seeded (never delete existing users on sample data reset)
  await seedDefaultUsers(false);

  // Always ensure budgets are seeded
  await seedMonthlyBudgets(force);

  const countRes = await db('sales_records').count('* as total').first();
  const currentCount = parseInt(countRes ? (countRes.total || countRes['count(*)']) : 0, 10);

  if (currentCount > 0 && !force) {
    console.log(`[SEED] Database already contains ${currentCount} records. Skipping seed.`);
    return { seeded: false, count: currentCount };
  }

  if (force && currentCount > 0) {
    console.log('[SEED] Force flag enabled: Clearing existing sales records and batches...');
    await db('sales_records').del();
    await db('upload_batches').del();
  }

  const sampleFilePath = path.join(__dirname, '../../data/sample_data.tsv');
  const fallbackCsvPath = path.join(__dirname, '../../data/sample_data.csv');

  let content;
  let filename = 'sample_data.tsv';
  if (fs.existsSync(sampleFilePath)) {
    content = fs.readFileSync(sampleFilePath, 'utf8');
  } else if (fs.existsSync(fallbackCsvPath)) {
    content = fs.readFileSync(fallbackCsvPath, 'utf8');
    filename = 'sample_data.csv';
  } else {
    throw new Error('Seed data file not found in data/ directory');
  }

  const rows = parseRoofingCsv(content);
  const totalSales = rows.reduce((sum, r) => sum + r.sales, 0);
  const reportingDate = rows[0]?.record_date || '31/08/2026';

  // Insert batch
  const [batchId] = await db('upload_batches').insert({
    filename,
    row_count: rows.length,
    total_sales: Number(totalSales.toFixed(2)),
    reporting_date: reportingDate,
    notes: 'Initial August 2026 baseline data'
  }).returning('id');

  const resolvedBatchId = typeof batchId === 'object' ? batchId.id : batchId;

  // Insert records with batch_id
  const recordsToInsert = rows.map(r => ({
    ...r,
    batch_id: resolvedBatchId
  }));

  await db('sales_records').insert(recordsToInsert);
  console.log(`[SEED] Successfully seeded ${recordsToInsert.length} records into batch #${resolvedBatchId}`);

  return {
    seeded: true,
    batch_id: resolvedBatchId,
    count: recordsToInsert.length,
    total_sales: totalSales
  };
}

module.exports = {
  seedInitialData,
  seedMonthlyBudgets,
  seedDefaultUsers,
  MONTH_NAMES
};
