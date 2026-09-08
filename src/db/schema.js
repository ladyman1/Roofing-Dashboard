const { db } = require('./knex');

async function initSchema() {
  const hasBatches = await db.schema.hasTable('upload_batches');
  if (!hasBatches) {
    await db.schema.createTable('upload_batches', (table) => {
      table.increments('id').primary();
      table.string('filename', 255).notNullable();
      table.timestamp('uploaded_at').defaultTo(db.fn.now());
      table.integer('row_count').defaultTo(0);
      table.decimal('total_sales', 14, 2).defaultTo(0.00);
      table.string('reporting_date', 20).nullable();
      table.text('notes').nullable();
    });
    console.log('[DB] Created table: upload_batches');
  }

  const hasSales = await db.schema.hasTable('sales_records');
  if (!hasSales) {
    await db.schema.createTable('sales_records', (table) => {
      table.increments('id').primary();
      table.integer('batch_id').unsigned().references('id').inTable('upload_batches').onDelete('CASCADE').nullable();
      table.string('record_date', 20).notNullable();
      table.string('iso_date', 10).nullable(); // YYYY-MM-DD
      table.integer('tosm').notNullable().defaultTo(0); // 0 = Credit, 1 = Cash
      table.string('tosm_description', 100).notNullable();
      table.string('subgroup', 20).notNullable();
      table.string('subgroup_description', 150).nullable();
      
      // Period metrics
      table.decimal('sales', 14, 2).defaultTo(0.00);
      table.decimal('cost', 14, 2).defaultTo(0.00);
      table.decimal('margin', 14, 2).defaultTo(0.00);
      table.decimal('margin_pct', 7, 2).defaultTo(0.00);
      table.decimal('quantity', 14, 4).defaultTo(0.0000);
      table.integer('invoice_tx_count').defaultTo(0);
      table.integer('credit_tx_count').defaultTo(0);

      // YTD metrics
      table.decimal('ytd_sales', 14, 2).defaultTo(0.00);
      table.decimal('ytd_cost', 14, 2).defaultTo(0.00);
      table.decimal('ytd_margin', 14, 2).defaultTo(0.00);
      table.decimal('ytd_margin_pct', 7, 2).defaultTo(0.00);
      table.decimal('ytd_quantity', 14, 4).defaultTo(0.0000);
      table.integer('ytd_invoice_tx_count').defaultTo(0);
      table.integer('ytd_credit_tx_count').defaultTo(0);

      table.timestamp('created_at').defaultTo(db.fn.now());

      // Indexes for fast querying
      table.index(['iso_date'], 'idx_sales_iso_date');
      table.index(['tosm'], 'idx_sales_tosm');
      table.index(['subgroup'], 'idx_sales_subgroup');
      table.index(['batch_id'], 'idx_sales_batch_id');
    });
    console.log('[DB] Created table: sales_records');
  }

  const hasBudgets = await db.schema.hasTable('monthly_budgets');
  if (!hasBudgets) {
    await db.schema.createTable('monthly_budgets', (table) => {
      table.increments('id').primary();
      table.integer('year').notNullable().defaultTo(2026);
      table.integer('month').notNullable(); // 1 - 12
      table.string('month_name', 20).notNullable();
      table.decimal('budget_sales', 14, 2).defaultTo(0.00);
      table.decimal('budget_margin', 14, 2).defaultTo(0.00);
      table.decimal('budget_margin_pct', 7, 2).defaultTo(0.00);
      table.decimal('actual_sales', 14, 2).nullable();
      table.decimal('actual_margin', 14, 2).nullable();
      table.decimal('actual_margin_pct', 7, 2).nullable();
      table.decimal('prior_year_sales', 14, 2).defaultTo(0.00);
      table.decimal('prior_year_margin', 14, 2).defaultTo(0.00);
      table.decimal('prior_year_margin_pct', 7, 2).defaultTo(0.00);
      table.text('notes').nullable();
      table.timestamp('updated_at').defaultTo(db.fn.now());

      table.unique(['year', 'month'], 'idx_budget_year_month');
    });
    console.log('[DB] Created table: monthly_budgets');
  } else {
    // Migration: add actual columns if table was created previously without them
    const hasActualSales = await db.schema.hasColumn('monthly_budgets', 'actual_sales');
    if (!hasActualSales) {
      await db.schema.table('monthly_budgets', (table) => {
        table.decimal('actual_sales', 14, 2).nullable();
      });
      console.log('[DB] Added column actual_sales to monthly_budgets');
    }
    const hasActualMargin = await db.schema.hasColumn('monthly_budgets', 'actual_margin');
    if (!hasActualMargin) {
      await db.schema.table('monthly_budgets', (table) => {
        table.decimal('actual_margin', 14, 2).nullable();
      });
      console.log('[DB] Added column actual_margin to monthly_budgets');
    }
    const hasActualMarginPct = await db.schema.hasColumn('monthly_budgets', 'actual_margin_pct');
    if (!hasActualMarginPct) {
      await db.schema.table('monthly_budgets', (table) => {
        table.decimal('actual_margin_pct', 7, 2).nullable();
      });
      console.log('[DB] Added column actual_margin_pct to monthly_budgets');
    }
  }

  const hasUsers = await db.schema.hasTable('users');
  if (!hasUsers) {
    await db.schema.createTable('users', (table) => {
      table.increments('id').primary();
      table.string('username', 100).notNullable().unique();
      table.string('password_hash', 255).notNullable();
      table.string('salt', 100).notNullable();
      table.string('role', 20).notNullable().defaultTo('viewer'); // 'admin' | 'viewer'
      table.string('full_name', 150).nullable();
      table.boolean('is_active').defaultTo(true);
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());

      table.index(['username'], 'idx_users_username');
    });
    console.log('[DB] Created table: users');
  }
}

module.exports = {
  initSchema
};
