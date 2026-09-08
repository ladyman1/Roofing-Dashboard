const { parse } = require('csv-parse/sync');

// Known category map for clean UI fallback when description is blank in source
const KNOWN_SUBGROUPS = {
  'R': 'ROOFING',
  'RA': 'Roofing Accessories',
  'RB': 'Roofing Battens',
  'RC': 'Chimneys',
  'RE': 'Roofing Sundries (RE)',
  'RF': 'Felts',
  'RH': 'Corrugated Clear Sheets',
  'RI': 'Roofing Insulation',
  'RL': 'Lead & Sundries',
  'RM': 'Roofing Membranes (RM)',
  'RP': 'PVCu Fascias & Cladding',
  'RQ': 'Roofing Chemicals & Gas',
  'RR': 'EPDM Roofing',
  'RS': 'Slates & Tiles',
  'RT': 'Concrete Roof Tiles',
  'RV': 'Ventilation',
  'RW': 'Roof Windows'
};

function detectDelimiter(text) {
  const firstLine = text.split(/\r\n|\n|\r/)[0] || '';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;

  if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
  if (semicolonCount > commaCount && semicolonCount > tabCount) return ';';
  return ',';
}

function parseNumber(val, defaultVal = 0) {
  if (val === null || val === undefined) return defaultVal;
  const cleaned = String(val).replace(/[£$€,\s%]/g, '').trim();
  if (cleaned === '') return defaultVal;
  const num = Number(cleaned);
  return isNaN(num) ? defaultVal : num;
}

function parseDateToIso(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  
  // Handle DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Handle YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return str;
}

function normalizeHeaderKey(key) {
  const normalized = String(key || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9%]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  switch (normalized) {
    case 'date': return 'record_date';
    case 'tosm': return 'tosm';
    case 'tosm_description':
    case 'tosm_desc': return 'tosm_description';
    case 'subgroup':
    case 'sub_group': return 'subgroup';
    case 'subgroup_description':
    case 'sub_group_description':
    case 'subgroup_desc': return 'subgroup_description';
    case 'sales': return 'sales';
    case 'cost': return 'cost';
    case 'margin': return 'margin';
    case '%':
    case 'margin_%':
    case 'margin_percent':
    case 'margin_pct': return 'margin_pct';
    case 'quantity':
    case 'qty': return 'quantity';
    case 'number_of_invoice_transactions':
    case 'invoice_transactions':
    case 'invoices': return 'invoice_tx_count';
    case 'number_of_credit_transactions':
    case 'credit_transactions':
    case 'credits': return 'credit_tx_count';
    case 'ytd_sales': return 'ytd_sales';
    case 'ytd_cost': return 'ytd_cost';
    case 'ytd_margin': return 'ytd_margin';
    case 'ytd_%':
    case 'ytd_percent':
    case 'ytd_margin_pct': return 'ytd_margin_pct';
    case 'ytd_quantity':
    case 'ytd_qty': return 'ytd_quantity';
    case 'ytd_number_of_invoice_transactions':
    case 'ytd_invoices': return 'ytd_invoice_tx_count';
    case 'ytd_number_of_credit_transactions':
    case 'ytd_credits': return 'ytd_credit_tx_count';
    default: return normalized;
  }
}

function parseRoofingCsv(content) {
  if (!content || !content.trim()) {
    throw new Error('CSV / TSV content is empty');
  }

  const delimiter = detectDelimiter(content);
  const records = parse(content, {
    delimiter,
    columns: (headers) => headers.map(normalizeHeaderKey),
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  });

  if (!records || records.length === 0) {
    throw new Error('No valid records found in file');
  }

  const parsedRows = records.map((row, idx) => {
    const recordDate = row.record_date ? String(row.record_date).trim() : 'N/A';
    const isoDate = parseDateToIso(recordDate);
    const tosm = parseInt(row.tosm, 10) || 0;
    const tosmDesc = (row.tosm_description ? String(row.tosm_description).trim() : '') ||
      (tosm === 1 ? 'Cash stock sales' : 'Credit stock sales');

    const subgroup = String(row.subgroup || '').trim().toUpperCase();
    let subgroupDesc = String(row.subgroup_description || '').trim();
    if (!subgroupDesc && KNOWN_SUBGROUPS[subgroup]) {
      subgroupDesc = KNOWN_SUBGROUPS[subgroup];
    } else if (!subgroupDesc) {
      subgroupDesc = subgroup ? `Category ${subgroup}` : 'General';
    }

    const sales = parseNumber(row.sales);
    const cost = parseNumber(row.cost);
    let margin = parseNumber(row.margin);
    if (!row.margin && (sales !== 0 || cost !== 0)) {
      margin = Number((sales - cost).toFixed(2));
    }

    let marginPct = parseNumber(row.margin_pct);
    if (!row.margin_pct && sales !== 0) {
      marginPct = Number(((margin / sales) * 100).toFixed(2));
    }

    const quantity = parseNumber(row.quantity);
    const invoiceTxCount = parseInt(parseNumber(row.invoice_tx_count), 10);
    const creditTxCount = parseInt(parseNumber(row.credit_tx_count), 10);

    const ytdSales = parseNumber(row.ytd_sales);
    const ytdCost = parseNumber(row.ytd_cost);
    let ytdMargin = parseNumber(row.ytd_margin);
    if (!row.ytd_margin && (ytdSales !== 0 || ytdCost !== 0)) {
      ytdMargin = Number((ytdSales - ytdCost).toFixed(2));
    }

    let ytdMarginPct = parseNumber(row.ytd_margin_pct);
    if (!row.ytd_margin_pct && ytdSales !== 0) {
      ytdMarginPct = Number(((ytdMargin / ytdSales) * 100).toFixed(2));
    }

    const ytdQuantity = parseNumber(row.ytd_quantity);
    const ytdInvoiceTxCount = parseInt(parseNumber(row.ytd_invoice_tx_count), 10);
    const ytdCreditTxCount = parseInt(parseNumber(row.ytd_credit_tx_count), 10);

    return {
      record_date: recordDate,
      iso_date: isoDate,
      tosm,
      tosm_description: tosmDesc,
      subgroup,
      subgroup_description: subgroupDesc,
      sales,
      cost,
      margin,
      margin_pct: marginPct,
      quantity,
      invoice_tx_count: invoiceTxCount,
      credit_tx_count: creditTxCount,
      ytd_sales: ytdSales,
      ytd_cost: ytdCost,
      ytd_margin: ytdMargin,
      ytd_margin_pct: ytdMarginPct,
      ytd_quantity: ytdQuantity,
      ytd_invoice_tx_count: ytdInvoiceTxCount,
      ytd_credit_tx_count: ytdCreditTxCount
    };
  });

  return parsedRows;
}

module.exports = {
  detectDelimiter,
  parseDateToIso,
  parseRoofingCsv,
  KNOWN_SUBGROUPS
};
