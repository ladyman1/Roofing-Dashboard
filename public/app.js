// Roofing Department Dashboard Controller
document.addEventListener('DOMContentLoaded', () => {
  // Theme State (Default is 'light' / White View)
  let currentTheme = localStorage.getItem('roofing_theme') || 'light';

  // Dashboard Data State & Auth
  const state = {
    token: localStorage.getItem('roofing_token') || null,
    user: JSON.parse(localStorage.getItem('roofing_user') || 'null'),
    activeTab: 'overview', // 'overview' | 'monthly'
    date: '31/08/2026',
    tosm: 'all',
    search: '',
    sortBy: 'sales',
    sortOrder: 'desc',
    selectedFile: null,
    subgroupsData: [],
    kpisData: null,
    monthlyReportData: null,
    monthlyFocus: '8', // Month 8 = August
    lineChartMode: 'monthly' // 'monthly' | 'ytd'
  };

  // Chart instances
  let chartRevMarginInstance = null;
  let chartChannelInstance = null;
  let chartMarginRankInstance = null;
  let chartReturnRiskInstance = null;
  let chartBudgetComparisonInstance = null;

  // Currency & number formatters
  const formatCurrency = (val) => {
    if (val === null || val === undefined) return '—';
    const num = Number(val) || 0;
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  const formatShortCurrency = (val) => {
    if (val === null || val === undefined) return '—';
    const num = Number(val) || 0;
    if (Math.abs(num) >= 1000000) return `£${(num / 1000000).toFixed(1)}m`;
    if (Math.abs(num) >= 1000) return `£${(num / 1000).toFixed(1)}k`;
    return formatCurrency(num);
  };

  const formatNumber = (val, decimals = 0) => {
    if (val === null || val === undefined) return '—';
    const num = Number(val) || 0;
    return new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num);
  };

  const formatPct = (val, withSign = false) => {
    if (val === null || val === undefined) return '—';
    const num = Number(val) || 0;
    const sign = withSign && num > 0 ? '+' : '';
    return `${sign}${num.toFixed(2)}%`;
  };

  // DOM Elements
  const el = {
    btnThemeToggle: document.getElementById('btnThemeToggle'),
    themeIcon: document.getElementById('themeIcon'),
    dbBadge: document.getElementById('dbBadge'),
    dbName: document.getElementById('dbName'),
    filterDate: document.getElementById('filterDate'),
    filterTosm: document.getElementById('filterTosm'),
    filterSearch: document.getElementById('filterSearch'),
    btnRefresh: document.getElementById('btnRefresh'),
    btnExport: document.getElementById('btnExport'),
    btnOpenUpload: document.getElementById('btnOpenUpload'),
    btnOpenBatches: document.getElementById('btnOpenBatches'),
    tableSortBy: document.getElementById('tableSortBy'),
    chartPeriodLabel: document.getElementById('chartPeriodLabel'),

    // Views & Nav Tabs
    tabNavOverview: document.getElementById('tabNavOverview'),
    tabNavMonthly: document.getElementById('tabNavMonthly'),
    viewOverview: document.getElementById('viewOverview'),
    viewMonthly: document.getElementById('viewMonthly'),

    // Cards (Overview)
    cardSales: document.getElementById('cardSales'),
    cardYtdSales: document.getElementById('cardYtdSales'),
    cardMargin: document.getElementById('cardMargin'),
    cardCost: document.getElementById('cardCost'),
    cardMarginPct: document.getElementById('cardMarginPct'),
    cardYtdMarginPct: document.getElementById('cardYtdMarginPct'),
    cardInvoices: document.getElementById('cardInvoices'),
    cardCredits: document.getElementById('cardCredits'),
    cardCreditRate: document.getElementById('cardCreditRate'),

    // Bars
    barQuantity: document.getElementById('barQuantity'),
    barYtdQuantity: document.getElementById('barYtdQuantity'),
    barCreditSales: document.getElementById('barCreditSales'),
    barCreditPct: document.getElementById('barCreditPct'),
    barCashSales: document.getElementById('barCashSales'),
    barCashPct: document.getElementById('barCashPct'),
    kpiRecordCount: document.getElementById('kpiRecordCount'),
    kpiCreditShare: document.getElementById('kpiCreditShare'),

    // Minis
    miniCreditSales: document.getElementById('miniCreditSales'),
    miniCashSales: document.getElementById('miniCashSales'),

    // Subgroups Table
    subgroupsTableBody: document.getElementById('subgroupsTableBody'),
    subgroupsTableFoot: document.getElementById('subgroupsTableFoot'),

    // Monthly Report View Elements
    monthlyFilterMonth: document.getElementById('monthlyFilterMonth'),
    monthlyStatusBadge: document.getElementById('monthlyStatusBadge'),
    btnOpenEditBudget: document.getElementById('btnOpenEditBudget'),
    btnLineChartMonthly: document.getElementById('btnLineChartMonthly'),
    btnLineChartYtd: document.getElementById('btnLineChartYtd'),
    lblActualLegend: document.getElementById('lblActualLegend'),
    lblMonthActual: document.getElementById('lblMonthActual'),
    mbActualSales: document.getElementById('mbActualSales'),
    mbBudgetSales: document.getElementById('mbBudgetSales'),
    mbVarBudgetBadge: document.getElementById('mbVarBudgetBadge'),
    mbVarPriorSales: document.getElementById('mbVarPriorSales'),
    mbPriorSales: document.getElementById('mbPriorSales'),
    mbVarPriorBadge: document.getElementById('mbVarPriorBadge'),
    mbYtdActual: document.getElementById('mbYtdActual'),
    mbYtdBudget: document.getElementById('mbYtdBudget'),
    mbYtdVarianceBadge: document.getElementById('mbYtdVarianceBadge'),
    monthlyTableBody: document.getElementById('monthlyTableBody'),
    monthlyTableFoot: document.getElementById('monthlyTableFoot'),

    // Edit Budget Modal
    editBudgetModal: document.getElementById('editBudgetModal'),
    btnCloseEditBudget: document.getElementById('btnCloseEditBudget'),
    btnCancelEditBudget: document.getElementById('btnCancelEditBudget'),
    formEditBudget: document.getElementById('formEditBudget'),
    editSelectMonth: document.getElementById('editSelectMonth'),
    inputBudgetSales: document.getElementById('inputBudgetSales'),
    inputActualSales: document.getElementById('inputActualSales'),
    inputPriorSales: document.getElementById('inputPriorSales'),
    inputBudgetNotes: document.getElementById('inputBudgetNotes'),
    editBudgetStatus: document.getElementById('editBudgetStatus'),

    // Upload & Batches Modals
    uploadModal: document.getElementById('uploadModal'),
    btnCloseUpload: document.getElementById('btnCloseUpload'),
    btnCancelUpload: document.getElementById('btnCancelUpload'),
    tabBtnFile: document.getElementById('tabBtnFile'),
    tabBtnPaste: document.getElementById('tabBtnPaste'),
    tabContentFile: document.getElementById('tabContentFile'),
    tabContentPaste: document.getElementById('tabContentPaste'),
    dropzone: document.getElementById('dropzone'),
    fileInput: document.getElementById('fileInput'),
    selectedFileInfo: document.getElementById('selectedFileInfo'),
    selectedFileName: document.getElementById('selectedFileName'),
    selectedFileSize: document.getElementById('selectedFileSize'),
    btnRemoveFile: document.getElementById('btnRemoveFile'),
    pasteContent: document.getElementById('pasteContent'),
    btnSubmitUpload: document.getElementById('btnSubmitUpload'),
    btnResetSeed: document.getElementById('btnResetSeed'),
    btnClearAllData: document.getElementById('btnClearAllData'),
    uploadStatus: document.getElementById('uploadStatus'),

    batchesModal: document.getElementById('batchesModal'),
    btnCloseBatches: document.getElementById('btnCloseBatches'),
    btnDismissBatches: document.getElementById('btnDismissBatches'),
    btnClearAllBatches: document.getElementById('btnClearAllBatches'),
    batchesDbDialect: document.getElementById('batchesDbDialect'),
    batchesTableBody: document.getElementById('batchesTableBody'),

    // Auth & Navigation User Controls
    btnManageUsers: document.getElementById('btnManageUsers'),
    userProfileChip: document.getElementById('userProfileChip'),
    navUsername: document.getElementById('navUsername'),
    navUserRoleBadge: document.getElementById('navUserRoleBadge'),
    btnLogout: document.getElementById('btnLogout'),

    // Login Modal
    loginModal: document.getElementById('loginModal'),
    formLogin: document.getElementById('formLogin'),
    loginUsername: document.getElementById('loginUsername'),
    loginPassword: document.getElementById('loginPassword'),
    loginAlert: document.getElementById('loginAlert'),
    btnLoginSubmit: document.getElementById('btnLoginSubmit'),

    // User Management Modal
    userManagementModal: document.getElementById('userManagementModal'),
    btnCloseUserManagement: document.getElementById('btnCloseUserManagement'),
    btnDismissUserManagement: document.getElementById('btnDismissUserManagement'),
    formAddUser: document.getElementById('formAddUser'),
    newUserUsername: document.getElementById('newUserUsername'),
    newUserFullName: document.getElementById('newUserFullName'),
    newUserPassword: document.getElementById('newUserPassword'),
    newUserRole: document.getElementById('newUserRole'),
    addUserAlert: document.getElementById('addUserAlert'),
    btnCreateUser: document.getElementById('btnCreateUser'),
    userCountBadge: document.getElementById('userCountBadge'),
    usersTableBody: document.getElementById('usersTableBody'),

    // Reset Password Modal
    resetPasswordModal: document.getElementById('resetPasswordModal'),
    btnCloseResetPassword: document.getElementById('btnCloseResetPassword'),
    btnCancelResetPassword: document.getElementById('btnCancelResetPassword'),
    formResetPassword: document.getElementById('formResetPassword'),
    resetPasswordUserId: document.getElementById('resetPasswordUserId'),
    resetPasswordInput: document.getElementById('resetPasswordInput'),
    resetPasswordAlert: document.getElementById('resetPasswordAlert'),
    btnSaveNewPassword: document.getElementById('btnSaveNewPassword'),
    resetPasswordTitle: document.getElementById('resetPasswordTitle')
  };

  // --- Theme Management (Light by default) ---
  function applyTheme(theme) {
    currentTheme = theme;
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      el.themeIcon.className = 'fa-solid fa-sun text-amber-400';
      el.btnThemeToggle.title = 'Switch to Light View';
    } else {
      document.documentElement.classList.remove('dark');
      el.themeIcon.className = 'fa-solid fa-moon text-sky-600';
      el.btnThemeToggle.title = 'Switch to Dark View';
    }
    localStorage.setItem('roofing_theme', theme);
  }

  function toggleTheme() {
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    renderCharts();
    if (state.activeTab === 'monthly') {
      renderBudgetLineChart();
    }
    if (state.kpisData) {
      renderChannelChart(state.kpisData.period?.credit_sales, state.kpisData.period?.cash_sales);
    }
  }

  el.btnThemeToggle.addEventListener('click', toggleTheme);
  applyTheme(currentTheme);

  // Helper to get active theme chart colors
  function getChartColors() {
    const isDark = currentTheme === 'dark';
    return {
      textColor: isDark ? '#94a3b8' : '#475569',
      headingColor: isDark ? '#cbd5e1' : '#1e293b',
      gridColor: isDark ? 'rgba(51, 65, 85, 0.35)' : 'rgba(226, 232, 240, 0.8)',
      donutBorder: isDark ? '#0f172a' : '#ffffff',
      isDark
    };
  }

  // --- Authentication & Role-Based Access Control ---
  async function apiFetch(url, options = {}) {
    const headers = new Headers(options.headers || {});
    if (state.token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${state.token}`);
    }
    const updatedOptions = { ...options, headers };
    const res = await fetch(url, updatedOptions);

    if (res.status === 401) {
      handleUnauthorized('Session expired or authentication required. Please sign in.');
      throw new Error('Unauthorized');
    }
    return res;
  }

  function handleUnauthorized(msg = '') {
    state.token = null;
    state.user = null;
    localStorage.removeItem('roofing_token');
    localStorage.removeItem('roofing_user');
    applyUserPermissions(null);
    if (msg) showLoginAlert(msg, 'error');
  }

  function showLoginAlert(msg, type = 'error') {
    if (!el.loginAlert) return;
    el.loginAlert.textContent = msg;
    el.loginAlert.classList.remove('hidden');
    if (type === 'error') {
      el.loginAlert.className = 'p-3 rounded-lg text-xs bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800';
    } else {
      el.loginAlert.className = 'p-3 rounded-lg text-xs bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
    }
  }

  function applyUserPermissions(user) {
    if (!user) {
      if (el.loginModal) el.loginModal.classList.remove('hidden');
      if (el.userProfileChip) el.userProfileChip.classList.add('hidden');
      return;
    }

    if (el.loginModal) el.loginModal.classList.add('hidden');
    if (el.userProfileChip) el.userProfileChip.classList.remove('hidden');
    if (el.navUsername) el.navUsername.textContent = user.full_name || user.username;

    const isAdmin = user.role === 'admin';
    if (el.navUserRoleBadge) {
      el.navUserRoleBadge.textContent = isAdmin ? 'Admin' : 'View Only';
      el.navUserRoleBadge.className = isAdmin
        ? 'text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider'
        : 'text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider';
    }

    // Toggle admin-only elements across the whole UI
    document.querySelectorAll('.admin-only').forEach(elem => {
      if (isAdmin) {
        elem.classList.remove('hidden');
      } else {
        elem.classList.add('hidden');
      }
    });
  }

  // --- Screen Navigation Tabs ---
  function switchTab(tab) {
    state.activeTab = tab;
    if (tab === 'overview') {
      el.tabNavOverview.className = 'py-3 px-4 text-xs font-bold border-b-2 border-sky-600 text-sky-600 dark:text-sky-400 dark:border-sky-400 flex items-center gap-2 transition-all cursor-pointer';
      el.tabNavMonthly.className = 'py-3 px-4 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border-b-2 border-transparent flex items-center gap-2 transition-all cursor-pointer';
      el.viewOverview.classList.remove('hidden');
      el.viewMonthly.classList.add('hidden');
      renderCharts();
    } else {
      el.tabNavMonthly.className = 'py-3 px-4 text-xs font-bold border-b-2 border-sky-600 text-sky-600 dark:text-sky-400 dark:border-sky-400 flex items-center gap-2 transition-all cursor-pointer';
      el.tabNavOverview.className = 'py-3 px-4 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border-b-2 border-transparent flex items-center gap-2 transition-all cursor-pointer';
      el.viewOverview.classList.add('hidden');
      el.viewMonthly.classList.remove('hidden');
      loadMonthlyReport();
    }
  }

  el.tabNavOverview.addEventListener('click', () => switchTab('overview'));
  el.tabNavMonthly.addEventListener('click', () => switchTab('monthly'));

  // 1. Fetch Health
  async function loadHealth() {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (data.status === 'ok') {
        const isPg = data.is_postgres;
        el.dbName.textContent = isPg ? 'PostgreSQL' : 'SQLite';
        if (isPg) {
          el.dbBadge.className = 'text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 font-mono font-semibold flex items-center gap-1.5';
        }
      }
    } catch (e) {
      console.warn('Could not check health endpoint', e);
    }
  }

  // 2. Fetch Dates
  async function loadDates() {
    try {
      const res = await apiFetch('/api/dates');
      const data = await res.json();
      if (data.dates && data.dates.length > 0) {
        const currentSelected = el.filterDate.value;
        el.filterDate.innerHTML = '<option value="all">All Uploaded Periods (Cumulative)</option>';
        
        data.dates.forEach((d, idx) => {
          const opt = document.createElement('option');
          opt.value = d.date;
          opt.textContent = `${d.date}`;
          if (currentSelected === d.date || (!currentSelected && idx === 0)) {
            opt.selected = true;
          }
          el.filterDate.appendChild(opt);
        });

        state.date = el.filterDate.value;
      } else {
        el.filterDate.innerHTML = '<option value="all">No Data Uploaded</option>';
        state.date = 'all';
      }
    } catch (e) {
      console.warn('Could not load dates', e);
    }
  }

  // 3. Fetch KPIs
  async function loadKpis() {
    try {
      const params = new URLSearchParams();
      if (state.date) params.append('date', state.date);
      if (state.tosm && state.tosm !== 'all') params.append('tosm', state.tosm);

      const res = await apiFetch(`/api/kpis?${params.toString()}`);
      const data = await res.json();
      state.kpisData = data;

      const p = data.period || {};
      const y = data.ytd || {};

      el.cardSales.textContent = formatCurrency(p.sales);
      el.cardYtdSales.textContent = formatCurrency(y.sales);
      el.cardMargin.textContent = formatCurrency(p.margin);
      el.cardCost.textContent = formatCurrency(p.cost);
      el.cardMarginPct.textContent = formatPct(p.margin_pct);
      el.cardYtdMarginPct.textContent = formatPct(y.margin_pct);
      el.cardInvoices.textContent = formatNumber(p.invoices);
      el.cardCredits.textContent = `${formatNumber(p.credits)} Credits`;
      el.cardCreditRate.textContent = formatPct(p.credit_rate_pct);

      el.barQuantity.textContent = formatNumber(p.quantity, 2);
      el.barYtdQuantity.textContent = formatNumber(y.quantity, 2);
      el.barCreditSales.textContent = formatCurrency(p.credit_sales);
      el.barCreditPct.textContent = `${p.credit_share_pct || 0}%`;
      el.barCashSales.textContent = formatCurrency(p.cash_sales);
      el.barCashPct.textContent = `${p.cash_share_pct || 0}%`;

      el.kpiRecordCount.textContent = data.record_count || 0;
      el.kpiCreditShare.textContent = `${p.credit_share_pct || 0}%`;

      el.miniCreditSales.textContent = formatShortCurrency(p.credit_sales);
      el.miniCashSales.textContent = formatShortCurrency(p.cash_sales);

      renderChannelChart(p.credit_sales, p.cash_sales);
    } catch (e) {
      console.error('Error loading KPIs', e);
    }
  }

  // 4. Fetch Subgroups
  async function loadSubgroups() {
    try {
      const params = new URLSearchParams();
      if (state.date) params.append('date', state.date);
      if (state.tosm && state.tosm !== 'all') params.append('tosm', state.tosm);
      params.append('sortBy', state.sortBy);
      params.append('order', state.sortOrder);

      const res = await apiFetch(`/api/subgroups?${params.toString()}`);
      const data = await res.json();
      state.subgroupsData = data.subgroups || [];

      if (el.chartPeriodLabel) {
        el.chartPeriodLabel.textContent = state.date === 'all' ? 'All Uploaded Periods' : state.date;
      }

      renderTable();
      renderCharts();
    } catch (e) {
      console.error('Error loading subgroups', e);
    }
  }

  // Render Table
  function renderTable() {
    const q = (state.search || '').trim().toLowerCase();
    const rows = state.subgroupsData.filter(r => {
      if (!q) return true;
      return r.subgroup.toLowerCase().includes(q) ||
             (r.subgroup_description || '').toLowerCase().includes(q);
    });

    if (rows.length === 0) {
      el.subgroupsTableBody.innerHTML = `
        <tr>
          <td colspan="11" class="text-center py-6 text-slate-400">
            No categories matched the current filter.
          </td>
        </tr>
      `;
      el.subgroupsTableFoot.innerHTML = '';
      return;
    }

    let totSales = 0, totCost = 0, totMargin = 0, totQty = 0, totInv = 0, totCr = 0, totYtdSales = 0, totYtdMargin = 0;

    const html = rows.map(r => {
      totSales += r.sales;
      totCost += r.cost;
      totMargin += r.margin;
      totQty += r.quantity;
      totInv += r.invoices;
      totCr += r.credits;
      totYtdSales += r.ytd_sales;
      totYtdMargin += r.ytd_margin;

      let marginBadgeClass = 'badge-margin-medium';
      if (r.margin_pct >= 35) marginBadgeClass = 'badge-margin-high';
      else if (r.margin_pct < 20) marginBadgeClass = 'badge-margin-low';

      let ytdBadgeClass = 'text-amber-600 dark:text-amber-400';
      if (r.ytd_margin_pct >= 35) ytdBadgeClass = 'text-emerald-600 dark:text-emerald-400';
      else if (r.ytd_margin_pct < 20) ytdBadgeClass = 'text-rose-600 dark:text-rose-400';

      return `
        <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
          <td class="py-2.5 px-4 font-mono font-bold text-sky-600 dark:text-sky-400">${r.subgroup}</td>
          <td class="py-2.5 px-4 font-medium text-slate-900 dark:text-slate-100">${r.subgroup_description || '-'}</td>
          <td class="py-2.5 px-4 text-right font-semibold text-slate-900 dark:text-white">${formatCurrency(r.sales)}</td>
          <td class="py-2.5 px-4 text-right text-slate-500 dark:text-slate-400">${formatCurrency(r.cost)}</td>
          <td class="py-2.5 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">${formatCurrency(r.margin)}</td>
          <td class="py-2.5 px-4 text-center">
            <span class="px-2 py-0.5 rounded text-[11px] font-bold ${marginBadgeClass}">
              ${formatPct(r.margin_pct)}
            </span>
          </td>
          <td class="py-2.5 px-4 text-right text-slate-600 dark:text-slate-300 font-mono">${formatNumber(r.quantity, 2)}</td>
          <td class="py-2.5 px-4 text-center text-slate-600 dark:text-slate-300">
            <span class="text-slate-800 dark:text-slate-200">${r.invoices}</span>
            <span class="text-slate-400 dark:text-slate-600">/</span>
            <span class="${r.credits > 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-400'}">${r.credits}</span>
          </td>
          <td class="py-2.5 px-4 text-right font-mono ${r.credit_rate_pct > 5 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-500 dark:text-slate-400'}">
            ${formatPct(r.credit_rate_pct)}
          </td>
          <td class="py-2.5 px-4 text-right text-slate-600 dark:text-slate-300 font-mono">${formatCurrency(r.ytd_sales)}</td>
          <td class="py-2.5 px-4 text-center font-bold ${ytdBadgeClass}">
            ${formatPct(r.ytd_margin_pct)}
          </td>
        </tr>
      `;
    }).join('');

    const overallMarginPct = totSales > 0 ? (totMargin / totSales) * 100 : 0;
    const overallYtdMarginPct = totYtdSales > 0 ? (totYtdMargin / totYtdSales) * 100 : 0;
    const overallReturnRate = (totInv + totCr) > 0 ? (totCr / (totInv + totCr)) * 100 : 0;

    el.subgroupsTableBody.innerHTML = html;

    el.subgroupsTableFoot.innerHTML = `
      <tr>
        <td class="py-3 px-4 font-bold text-sky-600 dark:text-sky-400" colspan="2">TOTAL / WEIGHTED AVERAGE</td>
        <td class="py-3 px-4 text-right text-slate-900 dark:text-white">${formatCurrency(totSales)}</td>
        <td class="py-3 px-4 text-right text-slate-500 dark:text-slate-400">${formatCurrency(totCost)}</td>
        <td class="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">${formatCurrency(totMargin)}</td>
        <td class="py-3 px-4 text-center text-amber-600 dark:text-amber-300">${formatPct(overallMarginPct)}</td>
        <td class="py-3 px-4 text-right text-slate-700 dark:text-slate-200">${formatNumber(totQty, 2)}</td>
        <td class="py-3 px-4 text-center">${totInv} / ${totCr}</td>
        <td class="py-3 px-4 text-right text-rose-600 dark:text-rose-300">${formatPct(overallReturnRate)}</td>
        <td class="py-3 px-4 text-right text-slate-900 dark:text-white">${formatCurrency(totYtdSales)}</td>
        <td class="py-3 px-4 text-center text-amber-600 dark:text-amber-300">${formatPct(overallYtdMarginPct)}</td>
      </tr>
    `;
  }

  // ==================== 5. MONTHLY BUDGET & PRIOR YEAR REPORT LOGIC ====================
  async function loadMonthlyReport() {
    try {
      const res = await apiFetch('/api/monthly-report?year=2026');
      const data = await res.json();
      state.monthlyReportData = data;

      renderMonthlyReport();
    } catch (e) {
      console.error('Error loading monthly report', e);
    }
  }

  function renderMonthlyReport() {
    const data = state.monthlyReportData;
    if (!data || !data.months) return;

    const focusVal = el.monthlyFilterMonth.value;
    state.monthlyFocus = focusVal;

    // 1. Update Scorecards based on focus month or Full Year
    if (focusVal === 'all') {
      const ytd = data.ytd_summary;
      const latestMonthName = ytd.latest_month_name || 'August';
      el.lblMonthActual.textContent = `Full Year / YTD Actual Sales (${latestMonthName} Live)`;
      el.mbActualSales.textContent = formatCurrency(ytd.actual_sales);
      el.mbBudgetSales.textContent = formatCurrency(ytd.budget_sales);
      
      const isUpBud = ytd.var_budget >= 0;
      el.mbVarBudgetBadge.textContent = `${isUpBud ? '+' : ''}${formatCurrency(ytd.var_budget)} (${isUpBud ? '+' : ''}${ytd.var_budget_pct.toFixed(2)}%) ${isUpBud ? '▲ UP' : '▼ DOWN'} vs Budget`;
      el.mbVarBudgetBadge.className = isUpBud
        ? 'px-2 py-0.5 rounded font-bold text-[11px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
        : 'px-2 py-0.5 rounded font-bold text-[11px] bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400 border border-rose-200 dark:border-rose-800';

      const isUpPrior = ytd.var_prior >= 0;
      el.mbVarPriorSales.textContent = `${isUpPrior ? '+' : ''}${formatCurrency(ytd.var_prior)}`;
      el.mbPriorSales.textContent = formatCurrency(ytd.prior_year_sales);
      el.mbVarPriorBadge.textContent = `${isUpPrior ? '+' : ''}${ytd.var_prior_pct.toFixed(2)}% ${isUpPrior ? '▲' : '▼'}`;
      el.mbVarPriorBadge.className = isUpPrior
        ? 'px-2 py-0.5 rounded font-bold text-[11px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
        : 'px-2 py-0.5 rounded font-bold text-[11px] bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400 border border-rose-200 dark:border-rose-800';

      // Scorecard 3: Year-to-Date Performance (cumulative through latest month with live actuals)
      if (el.mbYtdActual) el.mbYtdActual.textContent = formatCurrency(ytd.actual_sales);
      if (el.mbYtdBudget) el.mbYtdBudget.textContent = formatCurrency(ytd.budget_sales);
      if (el.mbYtdVarianceBadge) {
        el.mbYtdVarianceBadge.textContent = `${isUpBud ? '+' : ''}${formatCurrency(ytd.var_budget)} (${isUpBud ? '+' : ''}${ytd.var_budget_pct.toFixed(2)}%) ${isUpBud ? '▲' : '▼'}`;
        el.mbYtdVarianceBadge.className = isUpBud ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'font-bold text-rose-600 dark:text-rose-400';
      }

      el.monthlyStatusBadge.textContent = `Full Year 2026 Overview (${latestMonthName} Actuals Live)`;
    } else {
      const monthNum = parseInt(focusVal, 10);
      const mData = data.months.find(m => m.month === monthNum) || data.months[7]; // Default Aug

      el.lblMonthActual.textContent = `${mData.month_name} Actual Sales`;
      el.mbActualSales.textContent = mData.has_actual ? formatCurrency(mData.actual_sales) : 'Pending Upload';
      el.mbBudgetSales.textContent = formatCurrency(mData.budget_sales);

      if (mData.has_actual) {
        const isUpBud = mData.is_up_budget;
        el.mbVarBudgetBadge.textContent = `${isUpBud ? '+' : ''}${formatCurrency(mData.var_budget_sales)} (${isUpBud ? '+' : ''}${mData.var_budget_pct.toFixed(2)}%) ${isUpBud ? '▲ UP' : '▼ DOWN'} vs Budget`;
        el.mbVarBudgetBadge.className = isUpBud
          ? 'px-2 py-0.5 rounded font-bold text-[11px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
          : 'px-2 py-0.5 rounded font-bold text-[11px] bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400 border border-rose-200 dark:border-rose-800';

        const isUpPrior = mData.is_up_prior;
        el.mbVarPriorSales.textContent = `${isUpPrior ? '+' : ''}${formatCurrency(mData.var_prior_sales)}`;
        el.mbPriorSales.textContent = formatCurrency(mData.prior_year_sales);
        el.mbVarPriorBadge.textContent = `${isUpPrior ? '+' : ''}${mData.var_prior_pct.toFixed(2)}% ${isUpPrior ? '▲' : '▼'}`;
        el.mbVarPriorBadge.className = isUpPrior
          ? 'px-2 py-0.5 rounded font-bold text-[11px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
          : 'px-2 py-0.5 rounded font-bold text-[11px] bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400 border border-rose-200 dark:border-rose-800';

        el.monthlyStatusBadge.textContent = `${mData.month_name} 2026: Actuals Ingested & Verified`;
        el.monthlyStatusBadge.className = 'text-xs px-2.5 py-1 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold';
      } else {
        el.mbVarBudgetBadge.textContent = 'Awaiting Monthly Upload';
        el.mbVarBudgetBadge.className = 'px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-medium';
        el.mbVarPriorSales.textContent = '—';
        el.mbPriorSales.textContent = formatCurrency(mData.prior_year_sales);
        el.mbVarPriorBadge.textContent = 'Target Only';
        el.mbVarPriorBadge.className = 'px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-medium';

        el.monthlyStatusBadge.textContent = `${mData.month_name} 2026: Target Active (No Actuals Uploaded Yet)`;
        el.monthlyStatusBadge.className = 'text-xs px-2.5 py-1 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-semibold';
      }

      // Scorecard 3: Year-to-Date Performance through selected month
      if (mData.cum_actual_sales !== null && mData.cum_actual_sales !== undefined) {
        if (el.mbYtdActual) el.mbYtdActual.textContent = formatCurrency(mData.cum_actual_sales);
        if (el.mbYtdBudget) el.mbYtdBudget.textContent = formatCurrency(mData.cum_budget_sales);
        if (el.mbYtdVarianceBadge) {
          const varYtd = Number((mData.cum_actual_sales - mData.cum_budget_sales).toFixed(2));
          const varYtdPct = mData.cum_budget_sales > 0 ? (varYtd / mData.cum_budget_sales) * 100 : 0;
          const isUpYtd = varYtd >= 0;
          el.mbYtdVarianceBadge.textContent = `${isUpYtd ? '+' : ''}${formatCurrency(varYtd)} (${isUpYtd ? '+' : ''}${varYtdPct.toFixed(2)}%) ${isUpYtd ? '▲' : '▼'}`;
          el.mbYtdVarianceBadge.className = isUpYtd ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'font-bold text-rose-600 dark:text-rose-400';
        }
      } else {
        if (el.mbYtdActual) el.mbYtdActual.textContent = '—';
        if (el.mbYtdBudget) el.mbYtdBudget.textContent = formatCurrency(mData.cum_budget_sales);
        if (el.mbYtdVarianceBadge) {
          el.mbYtdVarianceBadge.textContent = 'Target Only';
          el.mbYtdVarianceBadge.className = 'font-medium text-slate-400';
        }
      }
    }

    // 2. Render Line Chart (Budget, Actual / YTD, Last Year)
    renderBudgetLineChart();

    // 3. Render 12-Month Table
    renderMonthlyTable();
  }

  // Render Line Chart for Budget vs Actual / YTD vs Last Year
  function renderBudgetLineChart() {
    const data = state.monthlyReportData;
    if (!data || !data.chart_series) return;

    const c = getChartColors();
    const mode = state.lineChartMode; // 'monthly' | 'ytd'
    const series = mode === 'ytd' ? data.chart_series.ytd : data.chart_series.monthly;

    el.lblActualLegend.textContent = mode === 'ytd' ? 'Cumulative YTD Actual Sales' : 'Actual Monthly Sales';

    const ctx = document.getElementById('chartBudgetComparison').getContext('2d');
    if (chartBudgetComparisonInstance) chartBudgetComparisonInstance.destroy();

    chartBudgetComparisonInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.chart_series.labels, // ['Jan', 'Feb', ...]
        datasets: [
          {
            label: mode === 'ytd' ? 'YTD Budget (£)' : 'Budget Target (£)',
            data: series.budget,
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            borderWidth: 2.5,
            borderDash: [5, 4],
            pointBackgroundColor: '#6366f1',
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.25
          },
          {
            label: mode === 'ytd' ? 'YTD Actual Sales (£)' : 'Actual Sales (£)',
            data: series.actual,
            borderColor: '#0284c7',
            backgroundColor: 'rgba(2, 132, 199, 0.15)',
            borderWidth: 3.5,
            pointBackgroundColor: '#0284c7',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8,
            tension: 0.25,
            spanGaps: false
          },
          {
            label: mode === 'ytd' ? 'Last Year YTD (£)' : 'Last Year (2025) (£)',
            data: series.prior_year,
            borderColor: '#f59e0b',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [2, 2],
            pointBackgroundColor: '#f59e0b',
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.25
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (ctx.parsed.y === null || ctx.parsed.y === undefined) return `${ctx.dataset.label}: Not recorded`;
                return `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: c.textColor, font: { size: 11, weight: '600' } },
            grid: { color: c.gridColor }
          },
          y: {
            ticks: {
              color: c.textColor,
              font: { size: 10 },
              callback: (val) => formatShortCurrency(val)
            },
            grid: { color: c.gridColor }
          }
        }
      }
    });
  }

  // Render 12-Month Comparison Table
  function renderMonthlyTable() {
    const data = state.monthlyReportData;
    if (!data || !data.months) return;

    let totActual = 0, totBudget = 0, totPrior = 0;

    const html = data.months.map(m => {
      if (m.has_actual) totActual += m.actual_sales;
      totBudget += m.budget_sales;
      totPrior += m.prior_year_sales;

      let statusBadge = '';
      if (m.has_actual) {
        if (m.is_up_budget && m.is_up_prior) {
          statusBadge = '<span class="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">▲ UP (Bud & PY)</span>';
        } else if (m.is_up_budget) {
          statusBadge = '<span class="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">▲ UP vs Bud</span>';
        } else {
          statusBadge = '<span class="px-2 py-0.5 rounded font-bold text-[10px] bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400 border border-rose-200 dark:border-rose-800">▼ DOWN vs Bud</span>';
        }
      } else {
        statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-400 font-medium">Pending</span>';
      }

      const varBudClass = m.has_actual ? (m.is_up_budget ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold') : 'text-slate-400';
      const varPriorClass = m.has_actual ? (m.is_up_prior ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold') : 'text-slate-400';

      return `
        <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
          <td class="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-100">${m.month_name}</td>
          <td class="py-2.5 px-4 text-right font-semibold ${m.has_actual ? 'text-slate-900 dark:text-white' : 'text-slate-400'}">${formatCurrency(m.actual_sales)}</td>
          <td class="py-2.5 px-4 text-right font-mono text-indigo-600 dark:text-indigo-400">${formatCurrency(m.budget_sales)}</td>
          <td class="py-2.5 px-4 text-right font-mono ${varBudClass}">${m.has_actual ? `${m.is_up_budget ? '+' : ''}${formatCurrency(m.var_budget_sales)}` : '—'}</td>
          <td class="py-2.5 px-4 text-center font-mono ${varBudClass}">${m.has_actual ? formatPct(m.var_budget_pct, true) : '—'}</td>
          <td class="py-2.5 px-4 text-right font-mono text-amber-600 dark:text-amber-400">${formatCurrency(m.prior_year_sales)}</td>
          <td class="py-2.5 px-4 text-right font-mono ${varPriorClass}">${m.has_actual ? `${m.is_up_prior ? '+' : ''}${formatCurrency(m.var_prior_sales)}` : '—'}</td>
          <td class="py-2.5 px-4 text-center font-mono ${varPriorClass}">${m.has_actual ? formatPct(m.var_prior_pct, true) : '—'}</td>
          <td class="py-2.5 px-4 text-center">${statusBadge}</td>
          <td class="py-2.5 px-4 text-center">
            ${state.user && state.user.role === 'admin' ? `
            <button class="btnEditRowBudget px-2 py-0.5 rounded text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950 font-medium text-[11px] border border-sky-200 dark:border-sky-900" data-month="${m.month}">
              <i class="fa-solid fa-pen mr-1"></i>Edit
            </button>` : `<span class="text-slate-400 text-[11px] font-mono">—</span>`}
          </td>
        </tr>
      `;
    }).join('');

    el.monthlyTableBody.innerHTML = html;

    const totVarBud = totActual - totBudget;
    const totVarBudPct = totBudget > 0 ? (totVarBud / totBudget) * 100 : 0;
    const totVarPrior = totActual - totPrior;
    const totVarPriorPct = totPrior > 0 ? (totVarPrior / totPrior) * 100 : 0;

    el.monthlyTableFoot.innerHTML = `
      <tr>
        <td class="py-3 px-4 font-bold text-sky-600 dark:text-sky-400">TOTAL 2026</td>
        <td class="py-3 px-4 text-right text-slate-900 dark:text-white">${formatCurrency(totActual)}</td>
        <td class="py-3 px-4 text-right text-indigo-600 dark:text-indigo-400">${formatCurrency(totBudget)}</td>
        <td class="py-3 px-4 text-right ${totVarBud >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">${totVarBud >= 0 ? '+' : ''}${formatCurrency(totVarBud)}</td>
        <td class="py-3 px-4 text-center ${totVarBud >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">${formatPct(totVarBudPct, true)}</td>
        <td class="py-3 px-4 text-right text-amber-600 dark:text-amber-400">${formatCurrency(totPrior)}</td>
        <td class="py-3 px-4 text-right ${totVarPrior >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">${totVarPrior >= 0 ? '+' : ''}${formatCurrency(totVarPrior)}</td>
        <td class="py-3 px-4 text-center ${totVarPrior >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">${formatPct(totVarPriorPct, true)}</td>
        <td class="py-3 px-4 text-center text-slate-400" colspan="2">12 Months Managed</td>
      </tr>
    `;

    // Wire up row edit buttons
    document.querySelectorAll('.btnEditRowBudget').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const m = parseInt(e.currentTarget.getAttribute('data-month'), 10);
        openEditBudgetModal(m);
      });
    });
  }

  // --- Monthly Controls Event Handlers ---
  el.monthlyFilterMonth.addEventListener('change', () => {
    renderMonthlyReport();
  });

  el.btnLineChartMonthly.addEventListener('click', () => {
    state.lineChartMode = 'monthly';
    el.btnLineChartMonthly.className = 'px-3 py-1 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs transition-all';
    el.btnLineChartYtd.className = 'px-3 py-1 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all';
    renderBudgetLineChart();
  });

  el.btnLineChartYtd.addEventListener('click', () => {
    state.lineChartMode = 'ytd';
    el.btnLineChartYtd.className = 'px-3 py-1 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs transition-all';
    el.btnLineChartMonthly.className = 'px-3 py-1 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all';
    renderBudgetLineChart();
  });

  // --- Edit Monthly Figures Modal (Budget, Actual Sales, Last Year) ---
  function openEditBudgetModal(monthNum = 8) {
    el.editBudgetStatus.className = 'hidden';
    el.editSelectMonth.value = String(monthNum);

    const data = state.monthlyReportData;
    if (data && data.months) {
      const mData = data.months.find(m => m.month === monthNum);
      if (mData) {
        el.inputBudgetSales.value = mData.budget_sales !== null && mData.budget_sales !== undefined ? mData.budget_sales : '';
        
        // Actual figures (display if recorded, otherwise blank)
        el.inputActualSales.value = mData.has_actual && mData.actual_sales !== null ? mData.actual_sales : '';

        // Last year figures
        el.inputPriorSales.value = mData.prior_year_sales !== null && mData.prior_year_sales !== undefined ? mData.prior_year_sales : '';
        
        el.inputBudgetNotes.value = '';
      }
    }
    el.editBudgetModal.classList.remove('hidden');
  }

  el.btnOpenEditBudget.addEventListener('click', () => {
    const m = el.monthlyFilterMonth.value === 'all' ? 8 : parseInt(el.monthlyFilterMonth.value, 10);
    openEditBudgetModal(m);
  });

  el.editSelectMonth.addEventListener('change', () => {
    const m = parseInt(el.editSelectMonth.value, 10);
    openEditBudgetModal(m);
  });

  const closeEditBudgetModal = () => {
    el.editBudgetModal.classList.add('hidden');
  };

  el.btnCloseEditBudget.addEventListener('click', closeEditBudgetModal);
  el.btnCancelEditBudget.addEventListener('click', closeEditBudgetModal);

  el.formEditBudget.addEventListener('submit', async (e) => {
    e.preventDefault();
    const month = parseInt(el.editSelectMonth.value, 10);
    const budgetSales = el.inputBudgetSales.value !== '' ? Number(el.inputBudgetSales.value) : 0;

    // Actual sales: null if blank (clears manual or falls back to CSV), number if filled
    const actualSales = el.inputActualSales.value !== '' ? Number(el.inputActualSales.value) : null;

    // Last year / Prior year figures
    const priorYearSales = el.inputPriorSales.value !== '' ? Number(el.inputPriorSales.value) : 0;
    const notes = el.inputBudgetNotes.value.trim();

    try {
      const res = await apiFetch(`/api/monthly-budgets/${month}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: 2026,
          budget_sales: budgetSales,
          actual_sales: actualSales,
          prior_year_sales: priorYearSales,
          notes
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update monthly figures');

      el.editBudgetStatus.textContent = 'Monthly figures (Budget, Actual & Last Year) updated successfully!';
      el.editBudgetStatus.className = 'p-2.5 rounded-lg text-xs bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';

      await loadMonthlyReport();
      setTimeout(closeEditBudgetModal, 1000);
    } catch (err) {
      el.editBudgetStatus.textContent = err.message;
      el.editBudgetStatus.className = 'p-2.5 rounded-lg text-xs bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800';
    }
  });

  // --- Overview Charts (Revenue & Channel & Risk) ---
  function renderCharts() {
    const c = getChartColors();
    const data = [...state.subgroupsData];
    if (data.length === 0) return;

    data.sort((a, b) => b.sales - a.sales);
    const labels = data.map(d => `${d.subgroup} - ${d.subgroup_description}`);
    const salesArr = data.map(d => d.sales);
    const marginArr = data.map(d => d.margin);

    const ctxRevMargin = document.getElementById('chartRevenueMargin').getContext('2d');
    if (chartRevMarginInstance) chartRevMarginInstance.destroy();

    chartRevMarginInstance = new Chart(ctxRevMargin, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Sales Revenue (£)',
            data: salesArr,
            backgroundColor: 'rgba(2, 132, 199, 0.85)',
            borderColor: '#0284c7',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Gross Margin (£)',
            data: marginArr,
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            borderColor: '#10b981',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: c.textColor, font: { size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: c.textColor,
              font: { size: 10 },
              maxRotation: 45,
              minRotation: 30,
              callback: function(val, index) {
                const item = data[index];
                return item ? item.subgroup : '';
              }
            },
            grid: { display: false }
          },
          y: {
            ticks: {
              color: c.textColor,
              font: { size: 10 },
              callback: (val) => formatShortCurrency(val)
            },
            grid: { color: c.gridColor }
          }
        }
      }
    });

    const marginRankData = [...data].sort((a, b) => b.margin_pct - a.margin_pct);
    const rankLabels = marginRankData.map(d => `${d.subgroup} (${d.subgroup_description})`);
    const rankPct = marginRankData.map(d => d.margin_pct);
    const rankColors = marginRankData.map(d => {
      if (d.margin_pct >= 35) return 'rgba(16, 185, 129, 0.85)';
      if (d.margin_pct >= 25) return 'rgba(245, 158, 11, 0.85)';
      return 'rgba(244, 63, 94, 0.85)';
    });

    const ctxRank = document.getElementById('chartMarginRank').getContext('2d');
    if (chartMarginRankInstance) chartMarginRankInstance.destroy();

    chartMarginRankInstance = new Chart(ctxRank, {
      type: 'bar',
      data: {
        labels: rankLabels,
        datasets: [{
          label: 'Gross Margin %',
          data: rankPct,
          backgroundColor: rankColors,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `Gross Margin: ${formatPct(ctx.parsed.x)}`
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: c.textColor,
              font: { size: 10 },
              callback: (val) => `${val}%`
            },
            grid: { color: c.gridColor }
          },
          y: {
            ticks: { color: c.textColor, font: { size: 10 } },
            grid: { display: false }
          }
        }
      }
    });

    const riskData = [...data].filter(d => d.credits > 0 || d.invoices > 50).sort((a, b) => b.credit_rate_pct - a.credit_rate_pct);
    const riskLabels = riskData.map(d => d.subgroup);
    const riskRates = riskData.map(d => d.credit_rate_pct);

    const ctxRisk = document.getElementById('chartReturnRisk').getContext('2d');
    if (chartReturnRiskInstance) chartReturnRiskInstance.destroy();

    chartReturnRiskInstance = new Chart(ctxRisk, {
      type: 'bar',
      data: {
        labels: riskLabels,
        datasets: [
          {
            label: 'Credit Return Rate (%)',
            data: riskRates,
            backgroundColor: 'rgba(244, 63, 94, 0.85)',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: c.textColor, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const item = riskData[ctx.dataIndex];
                return `Return Rate: ${formatPct(ctx.parsed.y)} (${item.credits} credits / ${item.invoices} invoices)`;
              }
            }
          }
        },
        scales: {
          x: { ticks: { color: c.textColor, font: { size: 10 } }, grid: { display: false } },
          y: {
            ticks: { color: c.textColor, font: { size: 10 }, callback: (val) => `${val}%` },
            grid: { color: c.gridColor }
          }
        }
      }
    });
  }

  function renderChannelChart(creditSales = 0, cashSales = 0) {
    const c = getChartColors();
    const ctxChannel = document.getElementById('chartChannelSplit').getContext('2d');
    if (chartChannelInstance) chartChannelInstance.destroy();

    chartChannelInstance = new Chart(ctxChannel, {
      type: 'doughnut',
      data: {
        labels: ['Credit Stock Sales', 'Cash Stock Sales'],
        datasets: [{
          data: [creditSales, cashSales],
          backgroundColor: ['#0284c7', '#14b8a6'],
          hoverBackgroundColor: ['#0369a1', '#0d9488'],
          borderColor: c.donutBorder,
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: c.textColor, font: { size: 11 }, padding: 12 }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total = creditSales + cashSales;
                const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                return `${ctx.label}: ${formatCurrency(ctx.parsed)} (${pct}%)`;
              }
            }
          }
        },
        cutout: '70%'
      }
    });
  }

  // Load All Dashboard Data
  async function reloadAll() {
    await Promise.all([
      loadKpis(),
      loadSubgroups(),
      loadMonthlyReport()
    ]);
  }

  // Global Filter Events
  el.filterDate.addEventListener('change', () => {
    state.date = el.filterDate.value;
    reloadAll();
  });

  el.filterTosm.addEventListener('change', () => {
    state.tosm = el.filterTosm.value;
    reloadAll();
  });

  el.filterSearch.addEventListener('input', (e) => {
    state.search = e.target.value;
    renderTable();
  });

  el.tableSortBy.addEventListener('change', () => {
    state.sortBy = el.tableSortBy.value;
    loadSubgroups();
  });

  el.btnRefresh.addEventListener('click', () => {
    el.btnRefresh.classList.add('animate-spin');
    reloadAll().finally(() => {
      setTimeout(() => el.btnRefresh.classList.remove('animate-spin'), 400);
    });
  });

  el.btnExport.addEventListener('click', () => {
    const params = new URLSearchParams();
    if (state.date) params.append('date', state.date);
    if (state.tosm && state.tosm !== 'all') params.append('tosm', state.tosm);
    if (state.search) params.append('search', state.search);
    if (state.token) params.append('token', state.token);
    window.location.href = `/api/export?${params.toString()}`;
  });

  // Modal Handling: Upload
  el.btnOpenUpload.addEventListener('click', () => {
    el.uploadStatus.className = 'hidden';
    el.uploadModal.classList.remove('hidden');
  });

  const closeUploadModal = () => {
    el.uploadModal.classList.add('hidden');
    state.selectedFile = null;
    el.fileInput.value = '';
    el.selectedFileInfo.classList.add('hidden');
    el.dropzone.classList.remove('hidden');
    el.pasteContent.value = '';
  };

  el.btnCloseUpload.addEventListener('click', closeUploadModal);
  el.btnCancelUpload.addEventListener('click', closeUploadModal);

  el.tabBtnFile.addEventListener('click', () => {
    el.tabBtnFile.className = 'py-2 px-4 text-sky-600 dark:text-sky-400 border-b-2 border-sky-500 transition-colors font-semibold';
    el.tabBtnPaste.className = 'py-2 px-4 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors';
    el.tabContentFile.classList.remove('hidden');
    el.tabContentPaste.classList.add('hidden');
  });

  el.tabBtnPaste.addEventListener('click', () => {
    el.tabBtnPaste.className = 'py-2 px-4 text-sky-600 dark:text-sky-400 border-b-2 border-sky-500 transition-colors font-semibold';
    el.tabBtnFile.className = 'py-2 px-4 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors';
    el.tabContentPaste.classList.remove('hidden');
    el.tabContentFile.classList.add('hidden');
  });

  // Drag & Drop
  el.dropzone.addEventListener('click', () => el.fileInput.click());
  el.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.dropzone.classList.add('dragover');
  });
  el.dropzone.addEventListener('dragleave', () => el.dropzone.classList.remove('dragover'));
  el.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    el.dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  el.fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  });

  function handleFileSelected(file) {
    state.selectedFile = file;
    el.selectedFileName.textContent = file.name;
    el.selectedFileSize.textContent = `(${(file.size / 1024).toFixed(1)} KB)`;
    el.dropzone.classList.add('hidden');
    el.selectedFileInfo.classList.remove('hidden');
  }

  el.btnRemoveFile.addEventListener('click', () => {
    state.selectedFile = null;
    el.fileInput.value = '';
    el.selectedFileInfo.classList.add('hidden');
    el.dropzone.classList.remove('hidden');
  });

  // Submit Upload
  el.btnSubmitUpload.addEventListener('click', async () => {
    el.uploadStatus.className = 'hidden';
    const modeRadio = document.querySelector('input[name="uploadMode"]:checked');
    const overwritePeriod = modeRadio ? modeRadio.value === 'overwrite' : false;

    if (state.selectedFile) {
      const formData = new FormData();
      formData.append('file', state.selectedFile);
      formData.append('overwrite_period', overwritePeriod);

      el.btnSubmitUpload.disabled = true;
      el.btnSubmitUpload.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ingesting...';

      try {
        const res = await apiFetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');

        showUploadStatus(`Successfully ingested ${data.rows_inserted} records! Batch #${data.batch_id} (${data.reporting_date})`, 'success');
        await loadDates();
        if (data.reporting_date) {
          el.filterDate.value = data.reporting_date;
          state.date = data.reporting_date;
        }
        await reloadAll();
        setTimeout(closeUploadModal, 1400);
      } catch (err) {
        showUploadStatus(err.message, 'error');
      } finally {
        el.btnSubmitUpload.disabled = false;
        el.btnSubmitUpload.innerHTML = '<i class="fa-solid fa-check"></i> Process & Ingest';
      }
      return;
    }

    const pasted = el.pasteContent.value.trim();
    if (pasted) {
      el.btnSubmitUpload.disabled = true;
      el.btnSubmitUpload.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ingesting...';

      try {
        const res = await apiFetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: pasted,
            filename: 'monthly_upload.tsv',
            overwrite_period: overwritePeriod
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');

        showUploadStatus(`Successfully parsed & stored ${data.rows_inserted} records! Period: ${data.reporting_date}`, 'success');
        await loadDates();
        if (data.reporting_date) {
          el.filterDate.value = data.reporting_date;
          state.date = data.reporting_date;
        }
        await reloadAll();
        setTimeout(closeUploadModal, 1400);
      } catch (err) {
        showUploadStatus(err.message, 'error');
      } finally {
        el.btnSubmitUpload.disabled = false;
        el.btnSubmitUpload.innerHTML = '<i class="fa-solid fa-check"></i> Process & Ingest';
      }
      return;
    }

    showUploadStatus('Please select a file or paste text before submitting.', 'error');
  });

  function showUploadStatus(msg, type) {
    el.uploadStatus.textContent = msg;
    if (type === 'success') {
      el.uploadStatus.className = 'p-3 rounded-lg text-xs bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
    } else {
      el.uploadStatus.className = 'p-3 rounded-lg text-xs bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800';
    }
  }

  // Reset to Baseline Sample
  el.btnResetSeed.addEventListener('click', async () => {
    if (!confirm('Reset database to the baseline August 2026 dataset? All incremental batches will be replaced.')) {
      return;
    }
    try {
      const res = await apiFetch('/api/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true })
      });
      const data = await res.json();
      if (data.success) {
        showUploadStatus(`Database reset to ${data.count} baseline records!`, 'success');
        await loadDates();
        await reloadAll();
        setTimeout(closeUploadModal, 1200);
      } else {
        showUploadStatus(data.error || 'Failed to reset seed data', 'error');
      }
    } catch (e) {
      showUploadStatus(e.message, 'error');
    }
  });

  // Clear All Imported Data (Admin Only)
  async function clearAllImportedData() {
    if (!confirm('Are you sure you want to delete ALL imported batches and sales records? This will clear all data and start completely fresh. This cannot be undone.')) {
      return;
    }
    try {
      const res = await apiFetch('/api/clear-all-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        showUploadStatus(`All imported data cleared! (${data.deleted_records} records removed)`, 'success');
        await loadDates();
        await reloadAll();
        if (el.batchesModal && !el.batchesModal.classList.contains('hidden')) {
          await refreshBatchesList();
        }
        setTimeout(() => {
          closeUploadModal();
        }, 1200);
      } else {
        alert(data.error || 'Failed to clear data');
      }
    } catch (e) {
      alert('Error clearing data: ' + e.message);
    }
  }

  if (el.btnClearAllData) {
    el.btnClearAllData.addEventListener('click', clearAllImportedData);
  }

  if (el.btnClearAllBatches) {
    el.btnClearAllBatches.addEventListener('click', clearAllImportedData);
  }

  // Batches Modal with Delete Batch support
  async function refreshBatchesList() {
    try {
      const healthRes = await fetch('/api/health');
      const healthData = await healthRes.json();
      el.batchesDbDialect.textContent = healthData.database || 'SQLite';

      const batchesRes = await apiFetch('/api/batches');
      const batchesData = await batchesRes.json();
      const batches = batchesData.batches || [];

      if (batches.length === 0) {
        el.batchesTableBody.innerHTML = '<tr><td colspan="7" class="p-3 text-center text-slate-400">No batches found</td></tr>';
      } else {
        const isAdmin = state.user && state.user.role === 'admin';
        el.batchesTableBody.innerHTML = batches.map(b => `
          <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <td class="p-2.5 font-mono text-sky-600 dark:text-sky-400 font-bold">#${b.id}</td>
            <td class="p-2.5 font-medium text-slate-800 dark:text-white">${b.filename}</td>
            <td class="p-2.5 text-right font-mono">${b.row_count}</td>
            <td class="p-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">${formatCurrency(b.total_sales)}</td>
            <td class="p-2.5 font-semibold text-slate-700 dark:text-slate-300">${b.reporting_date || '-'}</td>
            <td class="p-2.5 text-slate-500 dark:text-slate-400 text-[11px]">${new Date(b.uploaded_at).toLocaleDateString()}</td>
            <td class="p-2.5 text-center">
              ${isAdmin ? `
              <button data-batch-id="${b.id}" class="btnDeleteBatch px-2 py-0.5 rounded text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 font-medium text-[11px] border border-rose-200 dark:border-rose-900 transition-colors">
                <i class="fa-solid fa-trash-can mr-1"></i>Delete
              </button>` : `<span class="text-slate-400 text-[11px] font-mono">—</span>`}
            </td>
          </tr>
        `).join('');

        if (isAdmin) {
          document.querySelectorAll('.btnDeleteBatch').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              const batchId = e.currentTarget.getAttribute('data-batch-id');
              if (!confirm(`Delete Batch #${batchId} and all associated records?`)) return;

              try {
                const delRes = await apiFetch(`/api/batches/${batchId}`, { method: 'DELETE' });
                const delJson = await delRes.json();
                if (delJson.success) {
                  await refreshBatchesList();
                  await loadDates();
                  await reloadAll();
                } else {
                  alert(delJson.error || 'Failed to delete batch');
                }
              } catch (err) {
                alert('Error deleting batch: ' + err.message);
              }
            });
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  el.btnOpenBatches.addEventListener('click', async () => {
    await refreshBatchesList();
    el.batchesModal.classList.remove('hidden');
  });

  el.btnCloseBatches.addEventListener('click', () => el.batchesModal.classList.add('hidden'));
  el.btnDismissBatches.addEventListener('click', () => el.batchesModal.classList.add('hidden'));

  // ==================== USER MANAGEMENT (ADMIN ONLY) ====================
  async function loadUsers() {
    try {
      const res = await apiFetch('/api/users');
      const data = await res.json();
      const users = data.users || [];

      if (el.userCountBadge) {
        el.userCountBadge.textContent = `${users.length} ${users.length === 1 ? 'user' : 'users'}`;
      }

      if (users.length === 0) {
        el.usersTableBody.innerHTML = '<tr><td colspan="5" class="p-3 text-center text-slate-400">No users found</td></tr>';
        return;
      }

      el.usersTableBody.innerHTML = users.map(u => {
        const isCurrent = state.user && state.user.id === u.id;
        const isAdminRole = u.role === 'admin';
        const roleBadge = isAdminRole
          ? '<span class="px-2 py-0.5 rounded font-bold text-[10px] bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800">Admin</span>'
          : '<span class="px-2 py-0.5 rounded font-medium text-[10px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">Viewer</span>';

        const createdDate = u.created_at ? new Date(u.created_at).toLocaleDateString() : '—';

        return `
          <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
            <td class="p-2.5 font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <span>${u.username}</span>
              ${isCurrent ? '<span class="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold">(You)</span>' : ''}
            </td>
            <td class="p-2.5 text-slate-600 dark:text-slate-300">${u.full_name || '—'}</td>
            <td class="p-2.5 text-center">${roleBadge}</td>
            <td class="p-2.5 text-slate-500 dark:text-slate-400 text-[11px]">${createdDate}</td>
            <td class="p-2.5 text-center space-x-1">
              <button class="btnOpenResetPass px-2 py-0.5 rounded text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950 font-medium text-[11px] border border-amber-200 dark:border-amber-900 transition-colors" data-id="${u.id}" data-username="${u.username}">
                <i class="fa-solid fa-key mr-1"></i>Password
              </button>
              ${!isCurrent ? `
              <button class="btnDeleteUserRow px-2 py-0.5 rounded text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 font-medium text-[11px] border border-rose-200 dark:border-rose-900 transition-colors" data-id="${u.id}" data-username="${u.username}">
                <i class="fa-solid fa-trash-can mr-1"></i>Delete
              </button>` : ''}
            </td>
          </tr>
        `;
      }).join('');

      // Wire up reset password buttons
      document.querySelectorAll('.btnOpenResetPass').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          const username = e.currentTarget.getAttribute('data-username');
          openResetPasswordModal(id, username);
        });
      });

      // Wire up delete user buttons
      document.querySelectorAll('.btnDeleteUserRow').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          const username = e.currentTarget.getAttribute('data-username');
          if (!confirm(`Are you sure you want to delete user account "${username}"?`)) return;

          try {
            const delRes = await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
            const delData = await delRes.json();
            if (!delRes.ok) throw new Error(delData.error || 'Failed to delete user');
            await loadUsers();
          } catch (err) {
            alert(err.message);
          }
        });
      });
    } catch (err) {
      console.error('Error loading users:', err);
    }
  }

  function openUserManagementModal() {
    if (el.addUserAlert) el.addUserAlert.className = 'hidden';
    if (el.formAddUser) el.formAddUser.reset();
    loadUsers();
    el.userManagementModal.classList.remove('hidden');
  }

  if (el.btnManageUsers) {
    el.btnManageUsers.addEventListener('click', openUserManagementModal);
  }
  if (el.btnCloseUserManagement) {
    el.btnCloseUserManagement.addEventListener('click', () => el.userManagementModal.classList.add('hidden'));
  }
  if (el.btnDismissUserManagement) {
    el.btnDismissUserManagement.addEventListener('click', () => el.userManagementModal.classList.add('hidden'));
  }

  // Create User Form
  if (el.formAddUser) {
    el.formAddUser.addEventListener('submit', async (e) => {
      e.preventDefault();
      el.addUserAlert.className = 'hidden';

      const username = el.newUserUsername.value.trim();
      const full_name = el.newUserFullName.value.trim();
      const password = el.newUserPassword.value;
      const role = el.newUserRole.value;

      el.btnCreateUser.disabled = true;
      el.btnCreateUser.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';

      try {
        const res = await apiFetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, full_name, password, role })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create user');

        el.addUserAlert.textContent = `User "${data.user.username}" created successfully with ${data.user.role === 'admin' ? 'Administrator' : 'View Only'} access!`;
        el.addUserAlert.className = 'p-2.5 rounded-lg text-xs bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';

        el.formAddUser.reset();
        await loadUsers();
      } catch (err) {
        el.addUserAlert.textContent = err.message;
        el.addUserAlert.className = 'p-2.5 rounded-lg text-xs bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800';
      } finally {
        el.btnCreateUser.disabled = false;
        el.btnCreateUser.innerHTML = '<i class="fa-solid fa-plus"></i> Create User';
      }
    });
  }

  // Reset / Assign Password Modal
  function openResetPasswordModal(userId, username) {
    if (el.resetPasswordAlert) el.resetPasswordAlert.className = 'hidden';
    el.resetPasswordUserId.value = userId;
    el.resetPasswordTitle.textContent = `Assign Password for "${username}"`;
    el.resetPasswordInput.value = '';
    el.resetPasswordModal.classList.remove('hidden');
    el.resetPasswordInput.focus();
  }

  if (el.btnCloseResetPassword) {
    el.btnCloseResetPassword.addEventListener('click', () => el.resetPasswordModal.classList.add('hidden'));
  }
  if (el.btnCancelResetPassword) {
    el.btnCancelResetPassword.addEventListener('click', () => el.resetPasswordModal.classList.add('hidden'));
  }

  if (el.formResetPassword) {
    el.formResetPassword.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userId = el.resetPasswordUserId.value;
      const newPassword = el.resetPasswordInput.value;

      el.btnSaveNewPassword.disabled = true;
      el.btnSaveNewPassword.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

      try {
        const res = await apiFetch(`/api/users/${userId}/password`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: newPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update password');

        el.resetPasswordAlert.textContent = data.message || 'Password updated successfully!';
        el.resetPasswordAlert.className = 'p-2.5 rounded-lg text-xs bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';

        setTimeout(() => {
          el.resetPasswordModal.classList.add('hidden');
        }, 1200);
      } catch (err) {
        el.resetPasswordAlert.textContent = err.message;
        el.resetPasswordAlert.className = 'p-2.5 rounded-lg text-xs bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800';
      } finally {
        el.btnSaveNewPassword.disabled = false;
        el.btnSaveNewPassword.innerHTML = 'Save Password';
      }
    });
  }

  // ==================== LOGIN & LOGOUT HANDLERS ====================
  if (el.formLogin) {
    el.formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      el.loginAlert.classList.add('hidden');
      const username = el.loginUsername.value.trim();
      const password = el.loginPassword.value;

      el.btnLoginSubmit.disabled = true;
      el.btnLoginSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Invalid credentials.');
        }

        state.token = data.token;
        state.user = data.user;
        localStorage.setItem('roofing_token', data.token);
        localStorage.setItem('roofing_user', JSON.stringify(data.user));

        applyUserPermissions(data.user);
        await loadDates();
        await reloadAll();
      } catch (err) {
        showLoginAlert(err.message, 'error');
      } finally {
        el.btnLoginSubmit.disabled = false;
        el.btnLoginSubmit.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In';
      }
    });
  }

  if (el.btnLogout) {
    el.btnLogout.addEventListener('click', () => {
      handleUnauthorized('You have signed out successfully.');
    });
  }

  // ==================== BOOT APPLICATION ====================
  async function initApp() {
    loadHealth();

    if (!state.token) {
      applyUserPermissions(null);
      return;
    }

    try {
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        state.user = data.user;
        localStorage.setItem('roofing_user', JSON.stringify(data.user));
        applyUserPermissions(state.user);
        await loadDates();
        await reloadAll();
      } else {
        handleUnauthorized();
      }
    } catch (e) {
      console.warn('Authentication check failed:', e);
      handleUnauthorized();
    }
  }

  initApp();
});
