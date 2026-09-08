const express = require('express');
const multer = require('multer');
const { db, getDbDialect, isPg } = require('../db/knex');
const { parseRoofingCsv } = require('../services/csvParser');
const { seedInitialData } = require('../services/seeder');
const {
  hashPassword,
  verifyPassword,
  createToken,
  requireAuth,
  requireAdmin
} = require('../services/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// Helper to apply filters to query
function applyFilters(query, { date, tosm, subgroup, search }) {
  if (date && date !== 'all') {
    query.where(builder => {
      builder.where('record_date', date).orWhere('iso_date', date);
    });
  }

  if (tosm !== undefined && tosm !== null && tosm !== 'all' && tosm !== '') {
    query.where('tosm', parseInt(tosm, 10));
  }

  if (subgroup && subgroup !== 'all' && subgroup !== '') {
    query.where('subgroup', String(subgroup).toUpperCase());
  }

  if (search && search.trim()) {
    const s = `%${search.trim().toLowerCase()}%`;
    query.where(builder => {
      builder.whereRaw('LOWER(subgroup) LIKE ?', [s])
        .orWhereRaw('LOWER(subgroup_description) LIKE ?', [s])
        .orWhereRaw('LOWER(tosm_description) LIKE ?', [s]);
    });
  }

  return query;
}

// 1. Health check (Public)
router.get('/health', async (req, res) => {
  try {
    // Quick probe
    await db.raw('SELECT 1 as healthy');
    const recordCountRes = await db('sales_records').count('* as count').first();
    const count = parseInt(recordCountRes ? (recordCountRes.count || recordCountRes['count(*)']) : 0, 10);

    res.json({
      status: 'ok',
      database: getDbDialect(),
      is_postgres: isPg,
      records_in_db: count,
      uptime_seconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ==================== AUTHENTICATION ROUTES ====================

// Login (Public)
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const user = await db('users').where({ username: cleanUsername }).first();

    if (!user || !user.is_active || !verifyPassword(password, user.password_hash, user.salt)) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = createToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        full_name: user.full_name || user.username
      }
    });
  } catch (err) {
    console.error('[LOGIN ERROR]', err);
    res.status(500).json({ error: 'Authentication failed.' });
  }
});

// Get Current User Profile (Requires Auth)
router.get('/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await db('users').where({ id: req.user.id }).first();
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'User account not found or deactivated.' });
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        full_name: user.full_name || user.username
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== USER MANAGEMENT (ADMIN ONLY) ====================

// List all users
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await db('users')
      .select('id', 'username', 'full_name', 'role', 'is_active', 'created_at')
      .orderBy('id', 'asc');
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new user
router.post('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { username, password, role = 'viewer', full_name } = req.body;
    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters.' });
    }
    if (!password || typeof password !== 'string' || password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanRole = role === 'admin' ? 'admin' : 'viewer';

    const existing = await db('users').where({ username: cleanUsername }).first();
    if (existing) {
      return res.status(400).json({ error: `Username "${cleanUsername}" already exists.` });
    }

    const { hash, salt } = hashPassword(password);
    const [userId] = await db('users').insert({
      username: cleanUsername,
      password_hash: hash,
      salt,
      role: cleanRole,
      full_name: full_name ? full_name.trim() : null,
      is_active: true
    }).returning('id');

    const resolvedId = typeof userId === 'object' ? userId.id : userId;
    const createdUser = await db('users')
      .where({ id: resolvedId })
      .select('id', 'username', 'full_name', 'role', 'is_active', 'created_at')
      .first();

    res.status(201).json({ success: true, user: createdUser });
  } catch (err) {
    console.error('[CREATE USER ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

// Assign / Reset Password for a user
router.put('/users/:id/password', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid user ID.' });

    const { password } = req.body;
    if (!password || typeof password !== 'string' || password.length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters.' });
    }

    const user = await db('users').where({ id }).first();
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const { hash, salt } = hashPassword(password);
    await db('users').where({ id }).update({
      password_hash: hash,
      salt,
      updated_at: db.fn.now()
    });

    res.json({ success: true, message: `Password for "${user.username}" updated successfully.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a user
router.delete('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid user ID.' });

    if (id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own logged-in account.' });
    }

    const userToDelete = await db('users').where({ id }).first();
    if (!userToDelete) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (userToDelete.role === 'admin') {
      const adminCountRes = await db('users').where({ role: 'admin' }).count('* as count').first();
      const adminCount = parseInt(adminCountRes ? (adminCountRes.count || adminCountRes['count(*)']) : 0, 10);
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot delete the only remaining administrator account.' });
      }
    }

    await db('users').where({ id }).del();
    res.json({ success: true, message: `User "${userToDelete.username}" deleted successfully.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== DASHBOARD DATA ROUTES ====================

// 2. Available reporting dates (chronological order)
router.get('/dates', requireAuth, async (req, res) => {
  try {
    const rows = await db('sales_records')
      .distinct('record_date', 'iso_date')
      .orderBy('iso_date', 'desc');

    const dates = rows.map(r => ({
      date: r.record_date,
      iso_date: r.iso_date
    }));

    res.json({ dates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2b. Incremental Monthly Trends (MoM performance across all uploaded periods)
router.get('/trends', requireAuth, async (req, res) => {
  try {
    const rows = await db('sales_records')
      .select(
        'record_date',
        'iso_date',
        db.raw('COALESCE(SUM(sales), 0) as sales'),
        db.raw('COALESCE(SUM(cost), 0) as cost'),
        db.raw('COALESCE(SUM(margin), 0) as margin'),
        db.raw('COALESCE(SUM(quantity), 0) as quantity'),
        db.raw('COALESCE(SUM(invoice_tx_count), 0) as invoices'),
        db.raw('COALESCE(SUM(credit_tx_count), 0) as credits'),
        db.raw('COALESCE(SUM(CASE WHEN tosm = 0 THEN sales ELSE 0 END), 0) as credit_sales'),
        db.raw('COALESCE(SUM(CASE WHEN tosm = 1 THEN sales ELSE 0 END), 0) as cash_sales')
      )
      .groupBy('record_date', 'iso_date')
      .orderBy('iso_date', 'asc');

    const trends = rows.map(r => {
      const sales = Number(r.sales);
      const cost = Number(r.cost);
      const margin = Number(r.margin);
      const marginPct = sales > 0 ? Number(((margin / sales) * 100).toFixed(2)) : 0;
      const inv = Number(r.invoices);
      const cr = Number(r.credits);
      const returnRate = (inv + cr) > 0 ? Number(((cr / (inv + cr)) * 100).toFixed(2)) : 0;

      return {
        date: r.record_date,
        iso_date: r.iso_date,
        sales: Number(sales.toFixed(2)),
        cost: Number(cost.toFixed(2)),
        margin: Number(margin.toFixed(2)),
        margin_pct: marginPct,
        quantity: Number(Number(r.quantity).toFixed(2)),
        invoices: inv,
        credits: cr,
        return_rate_pct: returnRate,
        credit_sales: Number(Number(r.credit_sales).toFixed(2)),
        cash_sales: Number(Number(r.cash_sales).toFixed(2))
      };
    });

    res.json({ trends });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. KPI Scorecards & Overview
router.get('/kpis', requireAuth, async (req, res) => {
  try {
    const { date, tosm } = req.query;

    let baseQuery = db('sales_records');
    applyFilters(baseQuery, { date, tosm });

    const stats = await baseQuery
      .select(
        db.raw('COALESCE(SUM(sales), 0) as total_sales'),
        db.raw('COALESCE(SUM(cost), 0) as total_cost'),
        db.raw('COALESCE(SUM(margin), 0) as total_margin'),
        db.raw('COALESCE(SUM(quantity), 0) as total_quantity'),
        db.raw('COALESCE(SUM(invoice_tx_count), 0) as total_invoices'),
        db.raw('COALESCE(SUM(credit_tx_count), 0) as total_credits'),
        db.raw('COALESCE(SUM(ytd_sales), 0) as ytd_sales'),
        db.raw('COALESCE(SUM(ytd_cost), 0) as ytd_cost'),
        db.raw('COALESCE(SUM(ytd_margin), 0) as ytd_margin'),
        db.raw('COALESCE(SUM(ytd_quantity), 0) as ytd_quantity'),
        db.raw('COALESCE(SUM(ytd_invoice_tx_count), 0) as ytd_invoices'),
        db.raw('COALESCE(SUM(ytd_credit_tx_count), 0) as ytd_credits'),
        db.raw('COUNT(*) as record_count')
      )
      .first();

    const totalSales = Number(stats.total_sales);
    const totalCost = Number(stats.total_cost);
    const totalMargin = Number(stats.total_margin);
    const totalQty = Number(stats.total_quantity);
    const totalInvoices = Number(stats.total_invoices);
    const totalCredits = Number(stats.total_credits);
    const totalTx = totalInvoices + totalCredits;
    const marginPct = totalSales > 0 ? Number(((totalMargin / totalSales) * 100).toFixed(2)) : 0;
    const creditRatePct = totalTx > 0 ? Number(((totalCredits / totalTx) * 100).toFixed(2)) : 0;

    const ytdSales = Number(stats.ytd_sales);
    const ytdCost = Number(stats.ytd_cost);
    const ytdMargin = Number(stats.ytd_margin);
    const ytdMarginPct = ytdSales > 0 ? Number(((ytdMargin / ytdSales) * 100).toFixed(2)) : 0;

    // Split by TOSM (Credit vs Cash)
    let tosmQuery = db('sales_records');
    applyFilters(tosmQuery, { date });
    const tosmSplit = await tosmQuery
      .select(
        'tosm',
        'tosm_description',
        db.raw('COALESCE(SUM(sales), 0) as sales'),
        db.raw('COALESCE(SUM(margin), 0) as margin'),
        db.raw('COALESCE(SUM(invoice_tx_count), 0) as invoices'),
        db.raw('COALESCE(SUM(credit_tx_count), 0) as credits')
      )
      .groupBy('tosm', 'tosm_description');

    let creditSales = 0;
    let cashSales = 0;
    tosmSplit.forEach(item => {
      const s = Number(item.sales);
      if (item.tosm === 0) creditSales += s;
      if (item.tosm === 1) cashSales += s;
    });

    res.json({
      period: {
        sales: totalSales,
        cost: totalCost,
        margin: totalMargin,
        margin_pct: marginPct,
        quantity: totalQty,
        invoices: totalInvoices,
        credits: totalCredits,
        total_transactions: totalTx,
        credit_rate_pct: creditRatePct,
        credit_sales: Number(creditSales.toFixed(2)),
        cash_sales: Number(cashSales.toFixed(2)),
        credit_share_pct: (creditSales + cashSales) > 0 ? Number(((creditSales / (creditSales + cashSales)) * 100).toFixed(1)) : 0,
        cash_share_pct: (creditSales + cashSales) > 0 ? Number(((cashSales / (creditSales + cashSales)) * 100).toFixed(1)) : 0
      },
      ytd: {
        sales: ytdSales,
        cost: ytdCost,
        margin: ytdMargin,
        margin_pct: ytdMarginPct,
        quantity: Number(stats.ytd_quantity),
        invoices: Number(stats.ytd_invoices),
        credits: Number(stats.ytd_credits)
      },
      record_count: Number(stats.record_count)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Subgroup performance breakdown
router.get('/subgroups', requireAuth, async (req, res) => {
  try {
    const { date, tosm, sortBy = 'sales', order = 'desc' } = req.query;

    let query = db('sales_records');
    applyFilters(query, { date, tosm });

    const rows = await query
      .select(
        'subgroup',
        db.raw('MAX(subgroup_description) as subgroup_description'),
        db.raw('COALESCE(SUM(sales), 0) as sales'),
        db.raw('COALESCE(SUM(cost), 0) as cost'),
        db.raw('COALESCE(SUM(margin), 0) as margin'),
        db.raw('COALESCE(SUM(quantity), 0) as quantity'),
        db.raw('COALESCE(SUM(invoice_tx_count), 0) as invoices'),
        db.raw('COALESCE(SUM(credit_tx_count), 0) as credits'),
        db.raw('COALESCE(SUM(ytd_sales), 0) as ytd_sales'),
        db.raw('COALESCE(SUM(ytd_cost), 0) as ytd_cost'),
        db.raw('COALESCE(SUM(ytd_margin), 0) as ytd_margin'),
        db.raw('COALESCE(SUM(ytd_quantity), 0) as ytd_quantity'),
        db.raw('COALESCE(SUM(ytd_invoice_tx_count), 0) as ytd_invoices'),
        db.raw('COALESCE(SUM(ytd_credit_tx_count), 0) as ytd_credits')
      )
      .groupBy('subgroup');

    // Calculate margins & ratios
    const formatted = rows.map(r => {
      const sales = Number(r.sales);
      const cost = Number(r.cost);
      const margin = Number(r.margin);
      const marginPct = sales > 0 ? Number(((margin / sales) * 100).toFixed(2)) : 0;
      const invoices = Number(r.invoices);
      const credits = Number(r.credits);
      const totalTx = invoices + credits;
      const creditRatePct = totalTx > 0 ? Number(((credits / totalTx) * 100).toFixed(2)) : 0;

      const ytdSales = Number(r.ytd_sales);
      const ytdMargin = Number(r.ytd_margin);
      const ytdMarginPct = ytdSales > 0 ? Number(((ytdMargin / ytdSales) * 100).toFixed(2)) : 0;

      return {
        subgroup: r.subgroup,
        subgroup_description: r.subgroup_description || r.subgroup,
        sales: Number(sales.toFixed(2)),
        cost: Number(cost.toFixed(2)),
        margin: Number(margin.toFixed(2)),
        margin_pct: marginPct,
        quantity: Number(Number(r.quantity).toFixed(2)),
        invoices,
        credits,
        credit_rate_pct: creditRatePct,
        ytd_sales: Number(ytdSales.toFixed(2)),
        ytd_cost: Number(Number(r.ytd_cost).toFixed(2)),
        ytd_margin: Number(ytdMargin.toFixed(2)),
        ytd_margin_pct: ytdMarginPct,
        ytd_quantity: Number(Number(r.ytd_quantity).toFixed(2)),
        ytd_invoices: Number(r.ytd_invoices),
        ytd_credits: Number(r.ytd_credits)
      };
    });

    // Sort
    formatted.sort((a, b) => {
      let valA = a[sortBy] ?? a.sales;
      let valB = b[sortBy] ?? b.sales;
      if (typeof valA === 'string') {
        return order.toLowerCase() === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return order.toLowerCase() === 'asc' ? valA - valB : valB - valA;
    });

    res.json({ subgroups: formatted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. TOSM Breakdown (Channel)
router.get('/tosm', requireAuth, async (req, res) => {
  try {
    const { date } = req.query;
    let query = db('sales_records');
    applyFilters(query, { date });

    const rows = await query
      .select(
        'tosm',
        'tosm_description',
        db.raw('COALESCE(SUM(sales), 0) as sales'),
        db.raw('COALESCE(SUM(cost), 0) as cost'),
        db.raw('COALESCE(SUM(margin), 0) as margin'),
        db.raw('COALESCE(SUM(quantity), 0) as quantity'),
        db.raw('COALESCE(SUM(invoice_tx_count), 0) as invoices'),
        db.raw('COALESCE(SUM(credit_tx_count), 0) as credits'),
        db.raw('COALESCE(SUM(ytd_sales), 0) as ytd_sales'),
        db.raw('COALESCE(SUM(ytd_margin), 0) as ytd_margin')
      )
      .groupBy('tosm', 'tosm_description')
      .orderBy('sales', 'desc');

    const formatted = rows.map(r => {
      const sales = Number(r.sales);
      const cost = Number(r.cost);
      const margin = Number(r.margin);
      const marginPct = sales > 0 ? Number(((margin / sales) * 100).toFixed(2)) : 0;
      return {
        tosm: r.tosm,
        tosm_description: r.tosm_description,
        sales: Number(sales.toFixed(2)),
        cost: Number(cost.toFixed(2)),
        margin: Number(margin.toFixed(2)),
        margin_pct: marginPct,
        quantity: Number(Number(r.quantity).toFixed(2)),
        invoices: Number(r.invoices),
        credits: Number(r.credits),
        ytd_sales: Number(Number(r.ytd_sales).toFixed(2)),
        ytd_margin: Number(Number(r.ytd_margin).toFixed(2))
      };
    });

    res.json({ channels: formatted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Raw records with pagination & search
router.get('/records', requireAuth, async (req, res) => {
  try {
    const {
      date,
      tosm,
      subgroup,
      search,
      page = 1,
      limit = 50,
      sortBy = 'sales',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * pageLimit;

    let countQuery = db('sales_records');
    applyFilters(countQuery, { date, tosm, subgroup, search });
    const countRes = await countQuery.count('* as count').first();
    const totalCount = parseInt(countRes ? (countRes.count || countRes['count(*)']) : 0, 10);

    let query = db('sales_records');
    applyFilters(query, { date, tosm, subgroup, search });

    // Allowed sort columns
    const allowedSort = [
      'sales', 'cost', 'margin', 'margin_pct', 'quantity',
      'invoice_tx_count', 'credit_tx_count', 'subgroup', 'tosm',
      'ytd_sales', 'ytd_margin', 'ytd_margin_pct'
    ];
    const actualSort = allowedSort.includes(sortBy) ? sortBy : 'sales';
    const actualOrder = ['asc', 'desc'].includes(sortOrder?.toLowerCase()) ? sortOrder.toLowerCase() : 'desc';

    const records = await query
      .orderBy(actualSort, actualOrder)
      .offset(offset)
      .limit(pageLimit);

    res.json({
      records,
      pagination: {
        page: pageNum,
        limit: pageLimit,
        total_records: totalCount,
        total_pages: Math.ceil(totalCount / pageLimit)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. CSV / TSV Upload endpoint (Admin Only)
router.post('/upload', requireAuth, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    let content = '';
    let filename = 'pasted_data.csv';

    if (req.file) {
      content = req.file.buffer.toString('utf8');
      filename = req.file.originalname;
    } else if (req.body.content) {
      content = req.body.content;
      filename = req.body.filename || 'manual_upload.tsv';
    } else {
      return res.status(400).json({ error: 'No file uploaded or content provided.' });
    }

    const rows = parseRoofingCsv(content);
    const totalSales = rows.reduce((acc, r) => acc + r.sales, 0);
    const reportingDate = rows[0]?.record_date || 'N/A';

    // Optional replacement of existing batch for this date
    const overwritePeriod = req.body.overwrite_period === true || req.body.overwrite_period === 'true';
    if (overwritePeriod && reportingDate && reportingDate !== 'N/A') {
      const oldBatches = await db('upload_batches').where('reporting_date', reportingDate).select('id');
      const oldBatchIds = oldBatches.map(b => b.id);
      if (oldBatchIds.length > 0) {
        await db('sales_records').whereIn('batch_id', oldBatchIds).del();
        await db('upload_batches').whereIn('id', oldBatchIds).del();
        console.log(`[UPLOAD] Cleaned up ${oldBatchIds.length} existing batch(es) for period ${reportingDate}`);
      }
    }

    // Insert into upload_batches
    const [batchId] = await db('upload_batches').insert({
      filename,
      row_count: rows.length,
      total_sales: Number(totalSales.toFixed(2)),
      reporting_date: reportingDate,
      notes: req.body.notes || `Uploaded ${rows.length} rows via dashboard`
    }).returning('id');

    const resolvedBatchId = typeof batchId === 'object' ? batchId.id : batchId;

    const recordsToInsert = rows.map(r => ({
      ...r,
      batch_id: resolvedBatchId
    }));

    await db('sales_records').insert(recordsToInsert);

    res.json({
      success: true,
      batch_id: resolvedBatchId,
      filename,
      rows_inserted: recordsToInsert.length,
      total_sales: Number(totalSales.toFixed(2)),
      reporting_date: reportingDate
    });
  } catch (err) {
    console.error('[UPLOAD ERROR]', err);
    res.status(400).json({ error: err.message });
  }
});

// Delete a specific batch and its associated records (Admin Only)
router.delete('/batches/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const batchId = parseInt(req.params.id, 10);
    if (isNaN(batchId)) return res.status(400).json({ error: 'Invalid batch ID' });

    const batch = await db('upload_batches').where('id', batchId).first();
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    await db('sales_records').where('batch_id', batchId).del();
    await db('upload_batches').where('id', batchId).del();

    res.json({ success: true, message: `Batch #${batchId} deleted successfully.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Seed sample data (Admin Only)
router.post('/seed', requireAuth, requireAdmin, async (req, res) => {
  try {
    const force = Boolean(req.body.force);
    const result = await seedInitialData(force);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Export filtered data to CSV
router.get('/export', requireAuth, async (req, res) => {
  try {
    const { date, tosm, subgroup, search } = req.query;
    let query = db('sales_records');
    applyFilters(query, { date, tosm, subgroup, search });
    const records = await query.orderBy('sales', 'desc');

    const headers = [
      'Date', 'TOSM', 'TOSM Description', 'SubGroup', 'SubGroup Description',
      'Sales', 'Cost', 'Margin', 'Margin %', 'Quantity',
      'Invoices', 'Credits',
      'YTD Sales', 'YTD Cost', 'YTD Margin', 'YTD Margin %', 'YTD Quantity',
      'YTD Invoices', 'YTD Credits'
    ];

    const csvRows = [headers.join(',')];

    for (const r of records) {
      csvRows.push([
        r.record_date,
        r.tosm,
        `"${(r.tosm_description || '').replace(/"/g, '""')}"`,
        r.subgroup,
        `"${(r.subgroup_description || '').replace(/"/g, '""')}"`,
        r.sales,
        r.cost,
        r.margin,
        r.margin_pct,
        r.quantity,
        r.invoice_tx_count,
        r.credit_tx_count,
        r.ytd_sales,
        r.ytd_cost,
        r.ytd_margin,
        r.ytd_margin_pct,
        r.ytd_quantity,
        r.ytd_invoice_tx_count,
        r.ytd_credit_tx_count
      ].join(','));
    }

    const csvOutput = csvRows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="roofing_report_${Date.now()}.csv"`);
    res.send(csvOutput);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Batches history
router.get('/batches', requireAuth, async (req, res) => {
  try {
    const batches = await db('upload_batches').orderBy('id', 'desc').limit(20);
    res.json({ batches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Monthly Report: Actual vs Budget vs Prior Year with MoM Variance
router.get('/monthly-report', requireAuth, async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || 2026;

    // 1. Get all monthly budgets for the year
    let budgets = await db('monthly_budgets')
      .where('year', year)
      .orderBy('month', 'asc');

    if (budgets.length === 0) {
      const { seedMonthlyBudgets } = require('../services/seeder');
      await seedMonthlyBudgets(false);
      budgets = await db('monthly_budgets')
        .where('year', year)
        .orderBy('month', 'asc');
    }

    // 2. Aggregate actuals from sales_records
    const actualRecords = await db('sales_records').select(
      'record_date',
      'iso_date',
      'sales',
      'cost',
      'margin'
    );

    // Group actuals by month (1 - 12)
    const actualsByMonth = {};
    for (const r of actualRecords) {
      let m = null;
      if (r.iso_date && r.iso_date.length >= 7) {
        const parts = r.iso_date.split('-');
        if (parseInt(parts[0], 10) === year) {
          m = parseInt(parts[1], 10);
        }
      } else if (r.record_date && r.record_date.includes('/')) {
        const parts = r.record_date.split('/');
        if (parseInt(parts[2], 10) === year) {
          m = parseInt(parts[1], 10);
        }
      }

      if (m && m >= 1 && m <= 12) {
        if (!actualsByMonth[m]) {
          actualsByMonth[m] = { sales: 0, cost: 0, margin: 0 };
        }
        actualsByMonth[m].sales += Number(r.sales || 0);
        actualsByMonth[m].cost += Number(r.cost || 0);
        actualsByMonth[m].margin += Number(r.margin || 0);
      }
    }

    // 3. Build 12-month comparison table & cumulative lines
    let cumBudget = 0;
    let cumPriorYear = 0;
    let latestActualMonth = 0;

    const monthsData = budgets.map(b => {
      const m = b.month;
      const act = actualsByMonth[m];

      // Determine actual sales: manual input takes precedence if explicitly provided, otherwise CSV aggregate
      let actualSales = null;
      let actualMargin = null;
      let actualMarginPct = null;
      let hasActual = false;

      if (b.actual_sales !== null && b.actual_sales !== undefined && b.actual_sales !== '') {
        hasActual = true;
        actualSales = Number(Number(b.actual_sales).toFixed(2));
        actualMarginPct = b.actual_margin_pct !== null && b.actual_margin_pct !== undefined && b.actual_margin_pct !== ''
          ? Number(b.actual_margin_pct)
          : (b.budget_margin_pct ? Number(b.budget_margin_pct) : 26.0);
        actualMargin = b.actual_margin !== null && b.actual_margin !== undefined && b.actual_margin !== ''
          ? Number(Number(b.actual_margin).toFixed(2))
          : Number((actualSales * (actualMarginPct / 100)).toFixed(2));
      } else if (act) {
        hasActual = true;
        actualSales = Number(act.sales.toFixed(2));
        actualMargin = Number(act.margin.toFixed(2));
        actualMarginPct = actualSales > 0 ? Number(((actualMargin / actualSales) * 100).toFixed(2)) : 0;
      }

      const budgetSales = Number(b.budget_sales || 0);
      const budgetMargin = Number(b.budget_margin || 0);
      const budgetMarginPct = Number(b.budget_margin_pct || (budgetSales > 0 ? ((budgetMargin / budgetSales) * 100).toFixed(2) : 0));

      const priorSales = Number(b.prior_year_sales || 0);
      const priorMargin = Number(b.prior_year_margin || 0);
      const priorMarginPct = Number(b.prior_year_margin_pct || (priorSales > 0 ? ((priorMargin / priorSales) * 100).toFixed(2) : 0));

      // Variances vs Budget
      const varBudgetSales = hasActual ? Number((actualSales - budgetSales).toFixed(2)) : null;
      const varBudgetPct = hasActual && budgetSales > 0 ? Number(((varBudgetSales / budgetSales) * 100).toFixed(2)) : null;
      const isUpBudget = hasActual ? actualSales >= budgetSales : null;

      // Variances vs Last Year
      const varPriorSales = hasActual ? Number((actualSales - priorSales).toFixed(2)) : null;
      const varPriorPct = hasActual && priorSales > 0 ? Number(((varPriorSales / priorSales) * 100).toFixed(2)) : null;
      const isUpPrior = hasActual ? actualSales >= priorSales : null;

      // Margin Variances
      const varBudgetMargin = hasActual ? Number((actualMargin - budgetMargin).toFixed(2)) : null;
      const varBudgetMarginPct = hasActual ? Number((actualMarginPct - budgetMarginPct).toFixed(2)) : null;

      cumBudget += budgetSales;
      cumPriorYear += priorSales;
      if (hasActual) {
        latestActualMonth = Math.max(latestActualMonth, m);
      }

      return {
        month: m,
        month_name: b.month_name,
        has_actual: hasActual,
        actual_sales: actualSales,
        actual_margin: actualMargin,
        actual_margin_pct: actualMarginPct,
        budget_sales: budgetSales,
        budget_margin: budgetMargin,
        budget_margin_pct: budgetMarginPct,
        prior_year_sales: priorSales,
        prior_year_margin: priorMargin,
        prior_year_margin_pct: priorMarginPct,
        var_budget_sales: varBudgetSales,
        var_budget_pct: varBudgetPct,
        is_up_budget: isUpBudget,
        var_prior_sales: varPriorSales,
        var_prior_pct: varPriorPct,
        is_up_prior: isUpPrior,
        var_budget_margin: varBudgetMargin,
        var_budget_margin_pct: varBudgetMarginPct,
        cum_actual_sales: null, // Will calculate running sum below
        cum_budget_sales: Number(cumBudget.toFixed(2)),
        cum_prior_year_sales: Number(cumPriorYear.toFixed(2))
      };
    });

    // Calculate running cumulative actuals across completed months
    let runningCumActual = 0;
    for (const item of monthsData) {
      if (item.has_actual) {
        runningCumActual += item.actual_sales;
        item.cum_actual_sales = Number(runningCumActual.toFixed(2));
      } else {
        item.cum_actual_sales = null;
      }
    }

    // 4. Line Chart Series (Simple line chart for Budget, YTD / Actual, and Last Year)
    const chartLabels = monthsData.map(d => d.month_name.slice(0, 3));
    const chartBudgetMonthly = monthsData.map(d => d.budget_sales);
    const chartPriorYearMonthly = monthsData.map(d => d.prior_year_sales);
    const chartActualMonthly = monthsData.map(d => d.actual_sales);

    const chartBudgetYtd = monthsData.map(d => d.cum_budget_sales);
    const chartPriorYearYtd = monthsData.map(d => d.cum_prior_year_sales);
    const chartActualYtd = monthsData.map(d => d.cum_actual_sales);

    res.json({
      year,
      latest_actual_month: latestActualMonth,
      months: monthsData,
      ytd_summary: {
        actual_sales: Number(runningCumActual.toFixed(2)),
        budget_sales: Number(cumBudget.toFixed(2)),
        prior_year_sales: Number(cumPriorYear.toFixed(2)),
        var_budget: Number((runningCumActual - cumBudget).toFixed(2)),
        var_budget_pct: cumBudget > 0 ? Number((((runningCumActual - cumBudget) / cumBudget) * 100).toFixed(2)) : 0,
        var_prior: Number((runningCumActual - cumPriorYear).toFixed(2)),
        var_prior_pct: cumPriorYear > 0 ? Number((((runningCumActual - cumPriorYear) / cumPriorYear) * 100).toFixed(2)) : 0
      },
      chart_series: {
        labels: chartLabels,
        monthly: {
          budget: chartBudgetMonthly,
          actual: chartActualMonthly,
          prior_year: chartPriorYearMonthly
        },
        ytd: {
          budget: chartBudgetYtd,
          actual: chartActualYtd,
          prior_year: chartPriorYearYtd
        }
      }
    });
  } catch (err) {
    console.error('[MONTHLY REPORT ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

// 12. Update / Input Budget, Actual Sales and Last Year Figures for a Specific Month
router.put('/monthly-budgets/:month', requireAuth, requireAdmin, async (req, res) => {
  try {
    const month = parseInt(req.params.month, 10);
    if (isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Month must be an integer between 1 and 12.' });
    }

    const year = parseInt(req.body.year, 10) || 2026;

    // Budget figures
    const budgetSales = req.body.budget_sales !== undefined && req.body.budget_sales !== null && req.body.budget_sales !== ''
      ? Number(req.body.budget_sales)
      : 0;
    let budgetMarginPct = req.body.budget_margin_pct !== undefined && req.body.budget_margin_pct !== ''
      ? Number(req.body.budget_margin_pct)
      : 26.0;
    let budgetMargin = req.body.budget_margin !== undefined && req.body.budget_margin !== ''
      ? Number(req.body.budget_margin)
      : Number((budgetSales * (budgetMarginPct / 100)).toFixed(2));

    // Actual sales figures (can be manually entered, updated or set to null)
    let actualSales = null;
    let actualMargin = null;
    let actualMarginPct = null;
    if (req.body.actual_sales !== undefined && req.body.actual_sales !== null && req.body.actual_sales !== '') {
      actualSales = Number(req.body.actual_sales);
      actualMarginPct = req.body.actual_margin_pct !== undefined && req.body.actual_margin_pct !== ''
        ? Number(req.body.actual_margin_pct)
        : budgetMarginPct;
      actualMargin = req.body.actual_margin !== undefined && req.body.actual_margin !== ''
        ? Number(req.body.actual_margin)
        : Number((actualSales * (actualMarginPct / 100)).toFixed(2));
    }

    // Prior year / Last year figures
    const priorYearSales = req.body.prior_year_sales !== undefined && req.body.prior_year_sales !== null && req.body.prior_year_sales !== ''
      ? Number(req.body.prior_year_sales)
      : 0;
    let priorYearMarginPct = req.body.prior_year_margin_pct !== undefined && req.body.prior_year_margin_pct !== ''
      ? Number(req.body.prior_year_margin_pct)
      : 25.5;
    let priorYearMargin = req.body.prior_year_margin !== undefined && req.body.prior_year_margin !== ''
      ? Number(req.body.prior_year_margin)
      : Number((priorYearSales * (priorYearMarginPct / 100)).toFixed(2));

    const existing = await db('monthly_budgets').where({ year, month }).first();
    const updatePayload = {
      budget_sales: budgetSales,
      budget_margin: budgetMargin,
      budget_margin_pct: budgetMarginPct,
      actual_sales: actualSales,
      actual_margin: actualMargin,
      actual_margin_pct: actualMarginPct,
      prior_year_sales: priorYearSales,
      prior_year_margin: priorYearMargin,
      prior_year_margin_pct: priorYearMarginPct,
      notes: req.body.notes !== undefined ? req.body.notes : (existing ? existing.notes : 'Updated via dashboard'),
      updated_at: db.fn.now()
    };

    if (existing) {
      await db('monthly_budgets').where({ year, month }).update(updatePayload);
    } else {
      const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      await db('monthly_budgets').insert({
        year,
        month,
        month_name: MONTH_NAMES[month - 1],
        ...updatePayload
      });
    }

    const updated = await db('monthly_budgets').where({ year, month }).first();
    res.json({ success: true, budget: updated });
  } catch (err) {
    console.error('[UPDATE BUDGET ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
