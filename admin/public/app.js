const FALLBACK_PLAN_CATALOG = {
  currency: "NPR",
  base_monthly_rate: 100,
  default_label: "monthly",
  plans: [
    {
      id: "monthly",
      label: "monthly",
      months: 1,
      discount_percent: 0,
      description: "1 month at the standard monthly rate.",
      amount: 100
    },
    {
      id: "yearly",
      label: "Yearly",
      months: 12,
      discount_percent: 10,
      description: "12 months with a 10% discount.",
      amount: 1080
    },
    {
      id: "six-months",
      label: "6 Months",
      months: 6,
      discount_percent: 5,
      description: "6 months with a 5% discount.",
      amount: 570
    }
  ]
};
const DEFAULT_PLAN = FALLBACK_PLAN_CATALOG.default_label;
const LEVELS = ["Pre-School", "School", "+2", "Diploma", "Bachelor", "Master", "PhD", "Certification"];
const FIELDS = [
  "Science",
  "Management",
  "Humanities",
  "Education",
  "Engineering",
  "Information Technology",
  "Computer Science",
  "Medical",
  "Nursing",
  "Pharmacy",
  "Public Health",
  "Law",
  "Agriculture",
  "Forestry",
  "Hospitality",
  "Tourism",
  "Arts",
  "Design"
];
const FACILITIES = ["Library", "Science Lab", "Computer Lab", "Canteen", "Sports Ground", "Hostel", "Auditorium", "Parking", "Medical Room", "Wi-Fi Campus"];
const TYPE_EMOJI = {
  School: "🏫",
  College: "🎓",
  University: "🏛️",
  "TVET Institute": "🔧",
  "Training Center": "📚",
  "Coaching Center": "✏️"
};
const APP_LABELS = {
  administration: "Administration",
  reports: "Reports",
  source: "Source App",
  notes: "Make Notes"
};
const PROVINCES = [
  { id: "1", name: "Koshi" },
  { id: "2", name: "Madhesh" },
  { id: "3", name: "Bagmati" },
  { id: "4", name: "Gandaki" },
  { id: "5", name: "Lumbini" },
  { id: "6", name: "Karnali" },
  { id: "7", name: "Sudurpashchim" }
];
const DISTRICTS_BY_PROVINCE = {
  "1": ["Bhojpur", "Dhankuta", "Ilam", "Jhapa", "Khotang", "Morang", "Okhaldhunga", "Panchthar", "Sankhuwasabha", "Solukhumbu", "Sunsari", "Taplejung", "Terhathum", "Udayapur"],
  "2": ["Bara", "Dhanusha", "Mahottari", "Parsa", "Rautahat", "Saptari", "Sarlahi", "Siraha"],
  "3": ["Bhaktapur", "Chitwan", "Dhading", "Dolakha", "Kathmandu", "Kavrepalanchok", "Lalitpur", "Makwanpur", "Nuwakot", "Ramechhap", "Rasuwa", "Sindhuli", "Sindhupalchok"],
  "4": ["Baglung", "Gorkha", "Kaski", "Lamjung", "Manang", "Mustang", "Myagdi", "Nawalpur", "Parbat", "Syangja", "Tanahun"],
  "5": ["Arghakhanchi", "Banke", "Bardiya", "Dang", "Gulmi", "Kapilvastu", "Palpa", "Parasi", "Pyuthan", "Rolpa", "Rukum East", "Rupandehi"],
  "6": ["Dailekh", "Dolpa", "Humla", "Jajarkot", "Jumla", "Kalikot", "Mugu", "Rukum West", "Salyan", "Surkhet"],
  "7": ["Achham", "Baitadi", "Bajhang", "Bajura", "Dadeldhura", "Darchula", "Doti", "Kailali", "Kanchanpur"]
};

const state = {
  businesses: [],
  currentView: "dashboard",
  editorMode: "add",
  selectedSlug: null,
  paymentSlug: null,
  paymentRecord: null,
  paymentEditingId: null,
  modalAction: null,
  toastTimer: null,
  planCatalog: FALLBACK_PLAN_CATALOG,
  filters: {
    dashboard: { search: "", province: "", district: "", status: "all" },
    edit: { search: "", province: "", district: "", status: "all" },
    payments: { search: "", province: "", district: "", status: "all" }
  },
  shell: {
    activeApp: null
  },
  reports: {
    period: "monthly",
    data: { rows: [], totals: {} },
    selectedKey: "",
    expenses: [],
    expenseEditingId: null,
    cache: {},
    inflight: {},
    token: 0
  },
  source: {
    snapshot: null
  },
  notes: {
    items: [],
    selectedId: null
  },
  formTags: {
    programs: [],
    tags: []
  }
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  buildChips("levelChips", LEVELS, "level");
  buildChips("fieldChips", FIELDS, "field");
  buildChips("facilityChips", FACILITIES, "facility");
  populateProvinceSelect("dashProvince", "All provinces");
  populateProvinceSelect("editProvince", "All provinces");
  populateProvinceSelect("payProvince", "All provinces");
  populateProvinceSelect("f_province", "Select province");
  populateDistrictSelect("dashDistrict", "", "", "All districts");
  populateDistrictSelect("editDistrict", "", "", "All districts");
  populateDistrictSelect("payDistrict", "", "", "All districts");
  populateDistrictSelect("f_district", "", "", "Select district");
  await loadPlanCatalog();
  bindEvents();
  resetBusinessForm();
  resetPaymentForm();
  resetExpenseForm();
  showDashboard();
  renderShell();
  startClock();
  startCountdownTicker();
  await Promise.allSettled([
    refreshDirectory({ reloadReport: false, reloadPaymentRecord: false }),
    loadRevenueReport("monthly", { force: true }),
    loadExpenses({ silent: true }),
    loadSourceStatus({ silent: true }),
    refreshNotes()
  ]);
}

function bindEvents() {
  document.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  document.getElementById("businessForm").addEventListener("submit", (event) => {
    event.preventDefault();
    saveBusiness();
  });
  document.getElementById("paymentForm").addEventListener("submit", (event) => {
    event.preventDefault();
    renewSelectedBusiness();
  });
  document.getElementById("expenseForm").addEventListener("submit", (event) => {
    event.preventDefault();
    saveExpense();
  });
  document.getElementById("reportBucketSelect").addEventListener("change", (event) => {
    selectReportBucket(event.target.value);
  });

  document.getElementById("f_name").addEventListener("input", autoSlug);
  document.getElementById("f_slug").addEventListener("input", () => {
    document.getElementById("f_slug").dataset.manual = document.getElementById("f_slug").value ? "true" : "false";
    updateSlugPreview();
  });
  document.getElementById("f_province").addEventListener("change", () => {
    populateDistrictSelect("f_district", valueOf("f_province"), "", "Select district");
  });
  document.getElementById("f_plan").addEventListener("change", () => {
    syncPlanAmount("f_plan", "f_amount");
    updateSubscriptionPreview();
  });
  document.getElementById("p_plan").addEventListener("change", () => {
    syncPlanAmount("p_plan", "p_amount");
  });

  ["f_plan", "f_payment_status", "f_paid_at", "f_amount", "f_currency", "f_payment_method", "f_payment_reference"].forEach((id) => {
    document.getElementById(id).addEventListener("input", updateSubscriptionPreview);
    document.getElementById(id).addEventListener("change", updateSubscriptionPreview);
  });

  bindFilter("dashboard", "dashSearch", "dashProvince", "dashDistrict", "dashStatus", renderDashboard);
  bindFilter("edit", "editSearch", "editProvince", "editDistrict", "editStatus", renderEditList);
  bindFilter("payments", "paySearch", "payProvince", "payDistrict", "payStatus", renderPayments);

  document.getElementById("programInput").addEventListener("keydown", (event) => handleTagInput(event, "programs"));
  document.getElementById("tagInput").addEventListener("keydown", (event) => handleTagInput(event, "tags"));

  document.addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (chip) {
      chip.classList.toggle("selected");
      return;
    }

    const removeTag = event.target.closest("[data-remove-tag]");
    if (removeTag) {
      removeTagValue(removeTag.dataset.group, removeTag.dataset.removeTag);
      return;
    }

    const trigger = event.target.closest("[data-menu-trigger]");
    if (trigger) {
      toggleMenu(trigger.dataset.menuTrigger);
      return;
    }

    if (!event.target.closest(".menu-wrap")) {
      closeMenus();
    }
  });
}

function bindFilter(key, searchId, provinceId, districtId, statusId, renderFn) {
  document.getElementById(searchId).addEventListener("input", (event) => {
    state.filters[key].search = event.target.value.trim();
    renderFn();
  });

  document.getElementById(provinceId).addEventListener("change", (event) => {
    state.filters[key].province = event.target.value;
    state.filters[key].district = "";
    refreshFilterDistrictOptions(key);
    renderFn();
  });

  document.getElementById(districtId).addEventListener("change", (event) => {
    state.filters[key].district = event.target.value;
    renderFn();
  });

  document.getElementById(statusId).addEventListener("change", (event) => {
    state.filters[key].status = event.target.value;
    renderFn();
  });
}

function buildChips(containerId, items, group) {
  document.getElementById(containerId).innerHTML = items
    .map((item) => `<button type="button" class="chip" data-group="${group}" data-value="${escapeHtml(item)}">${escapeHtml(item)}</button>`)
    .join("");
}

function populateProvinceSelect(selectId, blankLabel) {
  const select = document.getElementById(selectId);
  select.innerHTML =
    `<option value="">${blankLabel}</option>` +
    PROVINCES.map((province) => `<option value="${province.id}">${province.name}</option>`).join("");
}

function populateDistrictSelect(selectId, province, currentValue, blankLabel, sourceBusinesses) {
  const select = document.getElementById(selectId);
  const options = getDistrictOptions(province, sourceBusinesses);
  const finalOptions = currentValue && !options.includes(currentValue) ? [...options, currentValue].sort() : options;
  select.innerHTML =
    `<option value="">${blankLabel}</option>` +
    finalOptions.map((district) => `<option value="${escapeHtml(district)}">${escapeHtml(district)}</option>`).join("");
  select.value = currentValue || "";
}

function getDistrictOptions(province, sourceBusinesses) {
  const candidates = (sourceBusinesses || state.businesses)
    .filter((business) => !province || String(business.province || "") === province)
    .map((business) => business.district)
    .filter(Boolean);

  const uniqueFromData = [...new Set(candidates)].sort((left, right) => left.localeCompare(right));
  if (uniqueFromData.length) {
    return uniqueFromData;
  }

  if (province && DISTRICTS_BY_PROVINCE[province]) {
    return DISTRICTS_BY_PROVINCE[province].slice();
  }

  return Object.values(DISTRICTS_BY_PROVINCE)
    .flat()
    .filter((value, index, list) => list.indexOf(value) === index)
    .sort((left, right) => left.localeCompare(right));
}

function refreshFilterDistrictOptions(key) {
  const mapping = {
    dashboard: ["dashDistrict", "All districts"],
    edit: ["editDistrict", "All districts"],
    payments: ["payDistrict", "All districts"]
  };
  const [selectId, label] = mapping[key];
  populateDistrictSelect(selectId, state.filters[key].province, state.filters[key].district, label, state.businesses);
}

async function loadPlanCatalog() {
  try {
    const response = await fetch("/api/meta/plans");
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || "Unable to load plan catalog.");
    }
    state.planCatalog = normalizePlanCatalog(payload.data);
  } catch {
    state.planCatalog = normalizePlanCatalog(FALLBACK_PLAN_CATALOG);
  }

  populatePlanSelect("f_plan");
  populatePlanSelect("p_plan");
}

function normalizePlanCatalog(catalog) {
  const baseMonthlyRate = Number(catalog?.base_monthly_rate) || 100;
  const currency = String(catalog?.currency || "NPR").trim() || "NPR";
  const plans = Array.isArray(catalog?.plans)
    ? catalog.plans
        .map((plan, index) => normalizePlanRecord(plan, index, currency, baseMonthlyRate))
        .filter(Boolean)
    : [];
  const fallbackPlans = FALLBACK_PLAN_CATALOG.plans.map((plan, index) =>
    normalizePlanRecord(plan, index, currency, baseMonthlyRate)
  );
  const normalizedPlans = plans.length ? plans : fallbackPlans;

  return {
    currency,
    base_monthly_rate: baseMonthlyRate,
    default_label: String(catalog?.default_label || normalizedPlans[0]?.label || DEFAULT_PLAN).trim(),
    plans: normalizedPlans
  };
}

function normalizePlanRecord(plan, index, currency, baseMonthlyRate) {
  if (!plan || typeof plan !== "object") {
    return null;
  }

  const label = String(plan.label || `Plan ${index + 1}`).trim();
  const months = Math.max(1, Number.parseInt(plan.months, 10) || 12);
  const discountPercent = Math.min(100, Math.max(0, Number(plan.discount_percent) || 0));

  return {
    id: slugify(plan.id || label) || `plan-${index + 1}`,
    label,
    months,
    discount_percent: discountPercent,
    description: String(plan.description || "").trim(),
    currency,
    amount: Number((baseMonthlyRate * months * (1 - discountPercent / 100)).toFixed(2))
  };
}

function getPlanList() {
  return state.planCatalog?.plans?.length ? state.planCatalog.plans : FALLBACK_PLAN_CATALOG.plans;
}

function getDefaultPlanLabel() {
  return state.planCatalog?.default_label || getPlanList()[0]?.label || DEFAULT_PLAN;
}

function getPlanDefinition(planLabel) {
  const normalized = slugify(planLabel);
  if (!normalized) {
    return getPlanList()[0] || null;
  }

  return (
    getPlanList().find(
      (plan) =>
        plan.id === normalized ||
        slugify(plan.label) === normalized ||
        normalized.includes(plan.id) ||
        normalized.includes(slugify(plan.label))
    ) ||
    getPlanList()[0] ||
    null
  );
}

function hasCatalogPlan(planLabel) {
  const normalized = slugify(planLabel);
  if (!normalized) {
    return false;
  }

  return getPlanList().some(
    (plan) => plan.id === normalized || slugify(plan.label) === normalized
  );
}

function populatePlanSelect(selectId) {
  const select = document.getElementById(selectId);
  const currentValue = select.value.trim();
  select.innerHTML = getPlanList()
    .map(
      (plan) =>
        `<option value="${escapeHtml(plan.label)}">${escapeHtml(
          `${plan.label} · ${plan.currency} ${plan.amount.toLocaleString()}`
        )}</option>`
    )
    .join("");
  setPlanSelectValue(selectId, currentValue || getDefaultPlanLabel());
}

function setPlanSelectValue(selectId, planLabel) {
  const select = document.getElementById(selectId);
  const nextValue = String(planLabel || "").trim() || getDefaultPlanLabel();
  const matchingOption = [...select.options].find(
    (option) => slugify(option.value) === slugify(nextValue)
  );

  if (!matchingOption && nextValue) {
    const option = document.createElement("option");
    option.value = nextValue;
    option.textContent = nextValue;
    select.append(option);
  }

  select.value = matchingOption?.value || nextValue;
}

function syncPlanAmount(planSelectId, amountInputId, options = {}) {
  const { force = true } = options;
  const plan = getPlanDefinition(valueOf(planSelectId));
  const amountInput = document.getElementById(amountInputId);
  if (!plan || !amountInput) {
    return;
  }

  if (force || !amountInput.value.trim()) {
    amountInput.value = String(plan.amount);
  }
}

async function refreshDirectory(options = {}) {
  const { reloadReport = true, reloadPaymentRecord = Boolean(state.paymentSlug && state.currentView === "payments") } = options;
  setStatus("Loading directory data...", "");
  try {
    const response = await fetch("/api/list");
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || "Unable to load directory.");
    }

    state.businesses = payload.data || [];
    if (state.selectedSlug && !getBusinessBySlug(state.selectedSlug)) {
      state.selectedSlug = null;
    }
    if (state.paymentSlug && !getBusinessBySlug(state.paymentSlug)) {
      state.paymentSlug = null;
      state.paymentRecord = null;
    }
    refreshFilterDistrictOptions("dashboard");
    refreshFilterDistrictOptions("edit");
    refreshFilterDistrictOptions("payments");
    updateStats();
    renderDashboard();
    renderEditList();
    renderPayments();
    updateSelectedSummary();
    updatePaymentFocus();
    setStatus("Directory loaded.", `${state.businesses.length} businesses`);

    const followUpTasks = [];
    if (reloadReport) {
      followUpTasks.push(loadRevenueReport(state.reports.period, { force: true, silent: true }));
    }
    if (reloadPaymentRecord && state.paymentSlug) {
      followUpTasks.push(loadPaymentRecord(state.paymentSlug, true));
    }
    if (followUpTasks.length) {
      await Promise.allSettled(followUpTasks);
    }
  } catch (error) {
    toast("❌ Load Error", error.message, "error");
    setStatus("Unable to load directory.", "");
  }
}

function renderShell() {
  const activeApp = state.shell.activeApp;
  document.getElementById("administrationApp").classList.toggle("hidden", activeApp !== "administration");
  document.getElementById("reportsApp").classList.toggle("hidden", activeApp !== "reports");
  document.getElementById("sourceApp").classList.toggle("hidden", activeApp !== "source");
  document.getElementById("notesApp").classList.toggle("hidden", activeApp !== "notes");
  document.getElementById("taskbarAppLabel").textContent = activeApp ? APP_LABELS[activeApp] : "Desktop";
}

function openApp(appName) {
  state.shell.activeApp = appName;
  renderShell();
}

function closeApp(appName) {
  if (state.shell.activeApp === appName) {
    state.shell.activeApp = null;
  }
  renderShell();
}

function openAdministration() {
  openApp("administration");
  showDashboard();
}

function openReportsApp() {
  openApp("reports");
  loadRevenueReport(state.reports.period || "monthly");
  loadExpenses({ silent: true });
}

function openSourceApp() {
  openApp("source");
  loadSourceStatus({ silent: true });
}

function openNotesApp() {
  openApp("notes");
  refreshNotes();
}

function invalidateRevenueReportCache() {
  state.reports.cache = {};
  state.reports.inflight = {};
  state.reports.token += 1;
}

async function loadRevenueReport(period = state.reports.period, options = {}) {
  const { force = false, silent = false } = options;
  state.reports.period = period;
  updateReportPeriodButtons();
  const requestToken = state.reports.token;
  let request = null;

  if (!force && state.reports.cache[period]) {
    state.reports.data = state.reports.cache[period];
    syncSelectedReportKey(state.reports.data.rows || []);
    renderRevenueReport();
    return state.reports.data;
  }

  try {
    request = state.reports.inflight[period];
    if (!request || force) {
      request = (async () => {
        const response = await fetch(`/api/reports/analytics?period=${encodeURIComponent(period)}`);
        const payload = await response.json();
        if (!payload.success) {
          throw new Error(payload.error || "Unable to load business analytics.");
        }
        return payload.data;
      })();
      state.reports.inflight[period] = request;
    }

    const data = await request;
    if (requestToken !== state.reports.token) {
      return data;
    }

    state.reports.cache[period] = data;
    if (state.reports.period === period) {
      state.reports.data = data;
      syncSelectedReportKey(data.rows || []);
      renderRevenueReport();
    }
    return data;
  } catch (error) {
    if (!silent) {
      document.getElementById("reportStatus").textContent = error.message;
      toast("❌ Report Error", error.message, "error");
    }
    return null;
  } finally {
    if (state.reports.inflight[period] === request) {
      delete state.reports.inflight[period];
    }
  }
}

function syncSelectedReportKey(rows) {
  const availableRows = Array.isArray(rows) ? rows : [];
  if (!availableRows.length) {
    state.reports.selectedKey = "";
    return;
  }

  const selectedExists = availableRows.some((row) => row.key === state.reports.selectedKey);
  if (!selectedExists) {
    state.reports.selectedKey = availableRows[0].key;
  }
}

function selectReportBucket(key) {
  state.reports.selectedKey = String(key || "");
  renderRevenueReport();
  if (!state.reports.expenseEditingId) {
    resetExpenseForm();
  }
}

function getSelectedReportRow(report = state.reports.data) {
  const rows = report?.rows || [];
  if (!rows.length) {
    return null;
  }

  return rows.find((row) => row.key === state.reports.selectedKey) || rows[0] || null;
}

function renderRevenueReport() {
  const report = state.reports.data || { rows: [], totals: {} };
  const rows = report.rows || [];
  syncSelectedReportKey(rows);
  const selectedRow = getSelectedReportRow(report);
  const lifetimeSummary = report.totals?.lifetime || {};
  const activeSummary = selectedRow || {};

  document.getElementById("reportPeriodLabel").textContent = `${state.reports.period.toUpperCase()} VIEW`;
  document.getElementById("reportVisibleCount").textContent = `${rows.length} periods`;
  document.getElementById("reportCurrentRevenue").textContent = formatCurrencyBreakdown(activeSummary.revenue_breakdown);
  document.getElementById("reportCurrentExpenses").textContent = formatCurrencyBreakdown(activeSummary.expense_breakdown);
  document.getElementById("reportCurrentNet").textContent = formatCurrencyBreakdown(activeSummary.net_breakdown);
  document.getElementById("reportLifetimeNet").textContent = formatCurrencyBreakdown(lifetimeSummary.net_breakdown);
  document.getElementById("reportPaymentCount").textContent = String(activeSummary.payment_count || 0);
  document.getElementById("reportExpenseCount").textContent = String(activeSummary.expense_count || 0);
  document.getElementById("reportBusinessCount").textContent = String(activeSummary.business_count || 0);
  document.getElementById("reportSelectionSummary").textContent = selectedRow
    ? `${selectedRow.label} · ${formatDate(selectedRow.start_at)} to ${formatDate(selectedRow.end_at)}`
    : "Choose a monthly, quarterly, or yearly time window.";
  document.getElementById("reportExpenseScope").textContent = selectedRow
    ? `Expenses are filtered to ${selectedRow.label}. New expenses default inside this time window.`
    : "Expenses follow the selected report time.";
  document.getElementById("reportEmpty").classList.toggle("hidden", rows.length > 0);
  document.getElementById("reportStatus").textContent = selectedRow
    ? `Showing ${selectedRow.label} in ${state.reports.period} mode.`
    : "No payments or expenses are available for this report yet.";

  renderReportBucketOptions(rows);
  renderReportChart(rows, selectedRow);
  document.getElementById("reportTableBody").innerHTML = rows
    .map(
      (row) => `
        <tr class="${row.key === state.reports.selectedKey ? "report-row-selected" : ""}" onclick="selectReportBucket('${escapeHtml(row.key)}')">
          <td>${escapeHtml(row.label)}</td>
          <td>${escapeHtml(formatCurrencyBreakdown(row.revenue_breakdown))}</td>
          <td>${escapeHtml(formatCurrencyBreakdown(row.expense_breakdown))}</td>
          <td>${escapeHtml(formatCurrencyBreakdown(row.net_breakdown))}</td>
          <td>${escapeHtml(String(row.payment_count || 0))}</td>
          <td>${escapeHtml(String(row.expense_count || 0))}</td>
          <td>${escapeHtml(String(row.business_count || 0))}</td>
        </tr>
      `
    )
    .join("");

  renderExpenses();
}

function renderReportBucketOptions(rows) {
  const select = document.getElementById("reportBucketSelect");
  if (!rows.length) {
    select.innerHTML = `<option value="">No periods available</option>`;
    select.value = "";
    return;
  }

  select.innerHTML = rows
    .map((row) => `<option value="${escapeHtml(row.key)}">${escapeHtml(row.label)}</option>`)
    .join("");
  select.value = state.reports.selectedKey;
}

function renderReportChart(rows, selectedRow) {
  const chart = document.getElementById("reportChart");
  if (!rows.length) {
    chart.innerHTML = "";
    return;
  }

  const maxValue = rows.reduce(
    (highest, row) =>
      Math.max(
        highest,
        Number(row.revenue_total || 0),
        Number(row.expense_total || 0),
        Math.abs(Number(row.net_total || 0))
      ),
    0
  );

  chart.innerHTML = rows
    .map((row) => {
      const isActive = selectedRow?.key === row.key;
      const coverage = `${formatDate(row.start_at)} to ${formatDate(row.end_at)}`;
      return `
        <button type="button" class="report-chart-row ${isActive ? "active" : ""}" onclick="selectReportBucket('${escapeHtml(row.key)}')">
          <div class="report-chart-head">
            <span class="report-chart-title">${escapeHtml(row.label)}</span>
            <span class="report-chart-meta">${escapeHtml(coverage)}</span>
          </div>
          <div class="report-bar-stack">
            ${buildReportBarLine("Revenue", row.revenue_total, maxValue, "revenue", formatCurrencyBreakdown(row.revenue_breakdown))}
            ${buildReportBarLine("Expenses", row.expense_total, maxValue, "expense", formatCurrencyBreakdown(row.expense_breakdown))}
            ${buildReportBarLine("Net", row.net_total, maxValue, row.net_total < 0 ? "net loss" : "net", formatCurrencyBreakdown(row.net_breakdown))}
          </div>
        </button>
      `;
    })
    .join("");
}

function buildReportBarLine(label, value, maxValue, cssClass, displayValue) {
  const numericValue = Math.abs(Number(value || 0));
  const width = maxValue > 0 && numericValue > 0 ? Math.max((numericValue / maxValue) * 100, 2) : 0;
  return `
    <div class="report-bar-line">
      <span class="report-bar-label">${escapeHtml(label)}</span>
      <div class="report-bar-track">
        <div class="report-bar-fill ${escapeHtml(cssClass)}" style="width:${width.toFixed(1)}%"></div>
      </div>
      <span class="summary-meta">${escapeHtml(displayValue)}</span>
    </div>
  `;
}

function updateReportPeriodButtons() {
  document.getElementById("reportMonthlyBtn").classList.toggle("active", state.reports.period === "monthly");
  document.getElementById("reportQuarterlyBtn").classList.toggle("active", state.reports.period === "quarterly");
  document.getElementById("reportYearlyBtn").classList.toggle("active", state.reports.period === "yearly");
}

async function exportRevenueReport(period = state.reports.period) {
  try {
    const response = await fetch(`/api/reports/analytics?period=${encodeURIComponent(period)}`);
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || "Unable to export analytics report.");
    }

    const rows = payload.data.rows || [];
    const csvLines = [
      ["Period", "Revenue", "Expenses", "Net", "Payments", "Expense Entries", "Businesses", "Start Date", "End Date"].join(","),
      ...rows.map((row) =>
        [
          csvCell(row.label),
          csvCell(formatCurrencyBreakdown(row.revenue_breakdown)),
          csvCell(formatCurrencyBreakdown(row.expense_breakdown)),
          csvCell(formatCurrencyBreakdown(row.net_breakdown)),
          csvCell(row.payment_count),
          csvCell(row.expense_count),
          csvCell(row.business_count),
          csvCell(formatDate(row.start_at)),
          csvCell(formatDate(row.end_at))
        ].join(",")
      )
    ];
    const blob = new Blob([csvLines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `business-analytics-${period}-${todayString()}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    document.getElementById("reportStatus").textContent = `${period} analytics exported.`;
  } catch (error) {
    toast("❌ Export Error", error.message, "error");
  }
}

function buildReportHighlightsMarkup(highlights, activeSummary, lifetimeSummary) {
  const activeMargin =
    activeSummary.margin_percent === null || activeSummary.margin_percent === undefined
      ? "No revenue yet"
      : `${activeSummary.margin_percent}%`;
  const averagePayment = activeSummary.payment_count
    ? formatCurrency(activeSummary.average_payment_value, state.planCatalog?.currency || "NPR")
    : "NPR 0";

  return [
    buildHighlightCard(
      "Best Net Period",
      highlights.strongest_net_period
        ? `${highlights.strongest_net_period.label} · ${formatCurrencyBreakdown(highlights.strongest_net_period.breakdown)}`
        : "No net-positive period yet."
    ),
    buildHighlightCard(
      "Highest Revenue",
      highlights.highest_revenue_period
        ? `${highlights.highest_revenue_period.label} · ${formatCurrencyBreakdown(highlights.highest_revenue_period.breakdown)}`
        : "No payment periods yet."
    ),
    buildHighlightCard(
      "Highest Expense",
      highlights.highest_expense_period
        ? `${highlights.highest_expense_period.label} · ${formatCurrencyBreakdown(highlights.highest_expense_period.breakdown)}`
        : "No expense periods yet."
    ),
    buildHighlightCard(
      "Active Margin",
      `${activeMargin} · Avg payment ${averagePayment}`
    ),
    buildHighlightCard(
      "Lifetime Revenue",
      formatCurrencyBreakdown(lifetimeSummary.revenue_breakdown)
    ),
    buildHighlightCard(
      "Lifetime Expenses",
      formatCurrencyBreakdown(lifetimeSummary.expense_breakdown)
    )
  ].join("");
}

function buildHighlightCard(title, body) {
  return `
    <div class="analysis-card">
      <div class="analysis-title">${escapeHtml(title)}</div>
      <div class="analysis-copy">${escapeHtml(body)}</div>
    </div>
  `;
}

function buildExpenseCategoryRows(categories) {
  const rows = (categories || []).slice(0, 8);
  if (!rows.length) {
    return "";
  }

  return rows
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.category)}</td>
          <td>${escapeHtml(formatCurrency(item.amount, state.planCatalog?.currency || "NPR"))}</td>
          <td>${escapeHtml(String(item.entries || 0))}</td>
          <td>${escapeHtml(`${item.share_percent || 0}%`)}</td>
        </tr>
      `
    )
    .join("");
}

async function loadExpenses(options = {}) {
  const { silent = false } = options;
  try {
    const response = await fetch("/api/reports/expenses");
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || "Unable to load expenses.");
    }

    state.reports.expenses = payload.data || [];
    renderExpenses();
    return state.reports.expenses;
  } catch (error) {
    if (!silent) {
      toast("❌ Expense Error", error.message, "error");
    }
    document.getElementById("expensesStatus").textContent = error.message;
    return [];
  }
}

function renderExpenses() {
  const selectedRow = getSelectedReportRow();
  const expenses = getExpensesForSelectedReport();
  document.getElementById("expenseVisibleCount").textContent = `${expenses.length} entries`;
  document.getElementById("expenseEmpty").classList.toggle("hidden", expenses.length > 0);
  document.getElementById("expenseTableBody").innerHTML = expenses
    .map(
      (expense) => `
        <tr>
          <td>
            <div class="edit-title">${escapeHtml(expense.title)}</div>
            <div class="summary-meta">${escapeHtml(expense.notes || "No notes")}</div>
          </td>
          <td>${escapeHtml(expense.category || "Operations")}</td>
          <td>${escapeHtml(formatCurrency(expense.amount, expense.currency))}</td>
          <td>${escapeHtml(formatDate(expense.incurred_at))}</td>
          <td>
            <div class="table-actions">
              <button type="button" class="row-btn" onclick="editExpense('${escapeHtml(expense.id)}')">Edit</button>
              <button type="button" class="row-btn warn" onclick="deleteExpense('${escapeHtml(expense.id)}')">Delete</button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");

  if (!state.reports.expenseEditingId) {
    document.getElementById("expensesStatus").textContent = selectedRow
      ? expenses.length
        ? `Showing expenses for ${selectedRow.label}.`
        : `No expenses recorded for ${selectedRow.label}.`
      : expenses.length
        ? "Showing all recorded expenses."
        : "No expenses recorded yet.";
  }
}

function resetExpenseForm() {
  state.reports.expenseEditingId = null;
  document.getElementById("expenseId").value = "";
  document.getElementById("expenseTitle").value = "";
  document.getElementById("expenseCategory").value = "Operations";
  document.getElementById("expenseAmount").value = "";
  document.getElementById("expenseCurrency").value = state.planCatalog?.currency || "NPR";
  document.getElementById("expenseDate").value = getDefaultExpenseDate();
  document.getElementById("expenseNotes").value = "";
  document.getElementById("expenseDeleteBtn").classList.add("hidden");
  document.getElementById("expenseSubmitBtn").textContent = "Save Expense";
  const selectedRow = getSelectedReportRow();
  document.getElementById("expensesStatus").textContent = selectedRow
    ? `Add an expense for ${selectedRow.label}.`
    : "Add an expense to improve report accuracy.";
}

function fillExpenseForm(expense) {
  state.reports.expenseEditingId = expense.id;
  document.getElementById("expenseId").value = expense.id || "";
  document.getElementById("expenseTitle").value = expense.title || "";
  document.getElementById("expenseCategory").value = expense.category || "Operations";
  document.getElementById("expenseAmount").value = expense.amount ?? "";
  document.getElementById("expenseCurrency").value = expense.currency || state.planCatalog?.currency || "NPR";
  document.getElementById("expenseDate").value = toDateInput(expense.incurred_at) || todayString();
  document.getElementById("expenseNotes").value = expense.notes || "";
  document.getElementById("expenseDeleteBtn").classList.remove("hidden");
  document.getElementById("expenseSubmitBtn").textContent = "Update Expense";
  document.getElementById("expensesStatus").textContent = `Editing ${expense.title}.`;
}

function editExpense(expenseId) {
  const expense = (state.reports.expenses || []).find((item) => item.id === expenseId);
  if (!expense) {
    toast("⚠️ Missing Expense", "That expense record could not be found.", "error");
    return;
  }

  const matchingRow = (state.reports.data?.rows || []).find((row) => matchesExpenseToReportRow(expense, row));
  if (matchingRow) {
    state.reports.selectedKey = matchingRow.key;
    renderRevenueReport();
  }
  fillExpenseForm(expense);
}

async function saveExpense() {
  const payload = {
    id: valueOf("expenseId"),
    title: valueOf("expenseTitle"),
    category: valueOf("expenseCategory") || "Operations",
    amount: numberOrNull("expenseAmount"),
    currency: valueOf("expenseCurrency") || state.planCatalog?.currency || "NPR",
    incurred_at: valueOf("expenseDate"),
    notes: valueOf("expenseNotes")
  };

  try {
    const response = await fetch("/api/reports/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || "Unable to save expense.");
    }

    invalidateRevenueReportCache();
    await Promise.allSettled([
      loadExpenses({ silent: true }),
      loadRevenueReport(state.reports.period, { force: true, silent: true })
    ]);
    resetExpenseForm();
    toast(
      "💼 Expense Saved",
      payload.id ? "The expense record was updated." : "A new expense was added to reports.",
      "success"
    );
  } catch (error) {
    toast("❌ Expense Error", error.message, "error");
    document.getElementById("expensesStatus").textContent = error.message;
  }
}

function deleteCurrentExpense() {
  if (!state.reports.expenseEditingId) {
    toast("⚠️ No Expense", "Select an expense to delete first.", "error");
    return;
  }
  deleteExpense(state.reports.expenseEditingId);
}

function deleteExpense(expenseId) {
  const expense = (state.reports.expenses || []).find((item) => item.id === expenseId);
  if (!expense) {
    toast("⚠️ Missing Expense", "That expense record could not be found.", "error");
    return;
  }

  showModal({
    title: "Delete Expense",
    icon: "🗑️",
    body: `Delete <b>${escapeHtml(expense.title)}</b> from the expense report ledger? This cannot be undone.`,
    confirmLabel: "Delete",
    confirmClass: "danger",
    onConfirm: async () => {
      try {
        const response = await fetch(`/api/reports/expenses/${expenseId}`, { method: "DELETE" });
        const payload = await response.json();
        if (!payload.success) {
          throw new Error(payload.error || "Unable to delete expense.");
        }

        invalidateRevenueReportCache();
        await Promise.allSettled([
          loadExpenses({ silent: true }),
          loadRevenueReport(state.reports.period, { force: true, silent: true })
        ]);
        resetExpenseForm();
        toast("🗑️ Expense Deleted", `${expense.title} was removed from analytics.`, "success");
      } catch (error) {
        toast("❌ Expense Error", error.message, "error");
        document.getElementById("expensesStatus").textContent = error.message;
      }
    }
  });
}

function getExpensesForSelectedReport() {
  const selectedRow = getSelectedReportRow();
  if (!selectedRow) {
    return state.reports.expenses || [];
  }

  return (state.reports.expenses || []).filter((expense) => matchesExpenseToReportRow(expense, selectedRow));
}

function matchesExpenseToReportRow(expense, row) {
  if (!expense || !row) {
    return false;
  }

  return getReportBucketKeyForDate(expense.incurred_at, state.reports.period) === row.key;
}

function getReportBucketKeyForDate(value, period) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth();
  if (period === "quarterly") {
    return `${year}-Q${Math.floor(monthIndex / 3) + 1}`;
  }
  if (period === "yearly") {
    return String(year);
  }
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function getDefaultExpenseDate() {
  const selectedRow = getSelectedReportRow();
  if (!selectedRow) {
    return todayString();
  }

  const today = todayString();
  return getReportBucketKeyForDate(today, state.reports.period) === selectedRow.key
    ? today
    : toDateInput(selectedRow.start_at) || today;
}

async function loadSourceStatus(options = {}) {
  const { silent = false } = options;
  try {
    const response = await fetch("/api/source/status");
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || "Unable to load source control status.");
    }

    state.source.snapshot = payload.data || null;
    renderSourceStatus();
    return state.source.snapshot;
  } catch (error) {
    document.getElementById("sourceStatus").textContent = error.message;
    document.getElementById("sourceActionStatus").textContent = error.message;
    if (!silent) {
      toast("❌ Source Error", error.message, "error");
    }
    return null;
  }
}

function renderSourceStatus() {
  const snapshot = state.source.snapshot || {};
  const files = snapshot.changed_files || [];
  document.getElementById("sourceModePill").textContent = snapshot.is_clean ? "CLEAN" : "CHANGED";
  document.getElementById("sourceBranchStat").textContent = snapshot.branch || "-";
  document.getElementById("sourceChangedStat").textContent = String(snapshot.changed_count || files.length || 0);
  document.getElementById("sourceStagedStat").textContent = String(snapshot.staged_count || 0);
  document.getElementById("sourceAheadBehindStat").textContent = `${snapshot.ahead || 0} / ${snapshot.behind || 0}`;
  document.getElementById("sourceRepoPath").value = snapshot.repo_root || "";
  document.getElementById("sourceRemoteUrl").value = snapshot.remote_url || "";
  document.getElementById("sourceFileCount").textContent = `${files.length} files`;
  document.getElementById("sourceFileEmpty").classList.toggle("hidden", files.length > 0);
  document.getElementById("sourceFileList").innerHTML = files
    .map(
      (file) => `
        <div class="source-file-item">
          <div class="source-file-badge">${escapeHtml(file.status || "--")}</div>
          <div>
            <div class="source-file-path">${escapeHtml(file.path || "")}</div>
            <div class="source-file-meta">${escapeHtml(file.summary || "Tracked file change")}</div>
          </div>
        </div>
      `
    )
    .join("");
  document.getElementById("sourceLog").textContent = snapshot.last_output || snapshot.status_text || "No git command has been run yet.";
  document.getElementById("sourceActionStatus").textContent = snapshot.last_summary || snapshot.status_summary || "Source control is ready.";
  document.getElementById("sourceStatus").textContent = snapshot.status_summary || "Source control is ready.";

  if (!valueOf("sourceCommitMessage")) {
    document.getElementById("sourceCommitMessage").value = buildDefaultSourceCommitMessage();
  }
}

function buildDefaultSourceCommitMessage() {
  return `Update directory data ${todayString()}`;
}

function getSourceCommitMessage() {
  return valueOf("sourceCommitMessage") || buildDefaultSourceCommitMessage();
}

async function runSourceCommand(endpoint, payload = {}, successTitle = "Git command completed.") {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || "Git command failed.");
    }

    state.source.snapshot = data.data || null;
    renderSourceStatus();
    const summary = data.data?.last_summary || successTitle;
    document.getElementById("sourceActionStatus").textContent = summary;
    document.getElementById("sourceStatus").textContent = summary;
    toast("🧰 Source Updated", summary, "success");
    return data.data;
  } catch (error) {
    document.getElementById("sourceActionStatus").textContent = error.message;
    document.getElementById("sourceStatus").textContent = error.message;
    toast("❌ Source Error", error.message, "error");
    return null;
  }
}

function pullSourceUpdates() {
  return runSourceCommand("/api/source/pull", {}, "Latest changes pulled from the remote.");
}

function stageSourceChanges() {
  return runSourceCommand("/api/source/stage", {}, "All changes were staged.");
}

function commitSourceChanges() {
  return runSourceCommand(
    "/api/source/commit",
    { message: getSourceCommitMessage() },
    "Changes were committed."
  );
}

function pushSourceChanges() {
  return runSourceCommand("/api/source/push", {}, "Changes were pushed to GitHub.");
}

function quickPublishSourceChanges() {
  return runSourceCommand(
    "/api/source/publish",
    { message: getSourceCommitMessage() },
    "Quick publish completed."
  );
}

async function refreshNotes() {
  try {
    const response = await fetch("/api/notes");
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || "Unable to load notes.");
    }

    state.notes.items = payload.data || [];
    if (state.notes.selectedId && !state.notes.items.some((note) => note.id === state.notes.selectedId)) {
      state.notes.selectedId = null;
    }
    if (!state.notes.selectedId && state.notes.items.length) {
      state.notes.selectedId = state.notes.items[0].id;
    }
    renderNotes();
  } catch (error) {
    document.getElementById("notesStatus").textContent = error.message;
    toast("❌ Notes Error", error.message, "error");
  }
}

function renderNotes() {
  const note = getSelectedNote();
  const list = document.getElementById("noteList");
  list.innerHTML = state.notes.items
    .map(
      (item) => `
        <button class="note-item ${item.id === state.notes.selectedId ? "active" : ""}" onclick="selectNote('${item.id}')">
          <div class="note-item-title">${escapeHtml(item.title || "Untitled note")}</div>
          <div class="note-item-meta">${escapeHtml(formatDate(item.updated_at))}</div>
        </button>
      `
    )
    .join("");
  document.getElementById("noteListEmpty").classList.toggle("hidden", state.notes.items.length > 0);

  if (!note) {
    document.getElementById("noteId").value = "";
    document.getElementById("noteTitle").value = "";
    document.getElementById("noteContent").value = "";
    document.getElementById("notesStatus").textContent = state.notes.items.length
      ? "Select a note or create a new one."
      : "No note selected.";
    return;
  }

  document.getElementById("noteId").value = note.id;
  document.getElementById("noteTitle").value = note.title || "";
  document.getElementById("noteContent").value = note.content || "";
  document.getElementById("notesStatus").textContent = `Editing ${note.title || "Untitled note"}.`;
}

function getSelectedNote() {
  return state.notes.items.find((note) => note.id === state.notes.selectedId) || null;
}

function selectNote(noteId) {
  state.notes.selectedId = noteId;
  renderNotes();
}

function newNote() {
  state.notes.selectedId = null;
  renderNotes();
  document.getElementById("notesStatus").textContent = "New note ready.";
}

async function saveCurrentNote() {
  const noteId = document.getElementById("noteId").value.trim();
  const title = document.getElementById("noteTitle").value.trim();
  const content = document.getElementById("noteContent").value;

  if (!title && !content.trim()) {
    toast("⚠️ Empty Note", "Add a title or note content before saving.", "error");
    return;
  }

  try {
    const response = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: noteId,
        title,
        content
      })
    });
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || "Unable to save note.");
    }

    state.notes.selectedId = payload.data.id;
    await refreshNotes();
    document.getElementById("notesStatus").textContent = "Note saved locally.";
    toast("📝 Note Saved", "The note was saved locally.", "success");
  } catch (error) {
    toast("❌ Notes Error", error.message, "error");
  }
}

async function deleteCurrentNote() {
  const note = getSelectedNote();
  if (!note) {
    toast("⚠️ No Note", "Select a saved note before deleting.", "error");
    return;
  }

  try {
    const response = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || "Unable to delete note.");
    }

    state.notes.selectedId = null;
    await refreshNotes();
    document.getElementById("notesStatus").textContent = "Note deleted.";
    toast("🗑️ Note Deleted", "The note was removed.", "success");
  } catch (error) {
    toast("❌ Notes Error", error.message, "error");
  }
}

function showDashboard() {
  setActiveView("dashboard");
  renderDashboard();
}

function openAddView() {
  state.editorMode = "add";
  state.selectedSlug = null;
  configureEditorView();
  resetBusinessForm();
  setActiveView("editor");
  renderEditList();
  updateSelectedSummary();
  setStatus("Add mode ready.", "");
}

function openEditView(slug) {
  state.editorMode = "edit";
  configureEditorView();
  setActiveView("editor");
  renderEditList();

  if (slug) {
    loadBusinessIntoEditor(slug);
    return;
  }

  if (state.selectedSlug) {
    loadBusinessIntoEditor(state.selectedSlug);
    return;
  }

  resetBusinessForm();
  setStatus("Edit mode ready. Select a business from the filtered list.", "");
}

function openPaymentsView(slug) {
  setActiveView("payments");
  renderPayments();

  if (slug) {
    loadPaymentRecord(slug);
    return;
  }

  if (state.paymentSlug) {
    loadPaymentRecord(state.paymentSlug, true);
    return;
  }

  if (state.selectedSlug) {
    loadPaymentRecord(state.selectedSlug, true);
  }
}

function setActiveView(view) {
  state.currentView = view;
  closeMenus();
  ["dashboardView", "editorView", "paymentsView"].forEach((id) => {
    document.getElementById(id).classList.toggle("hidden", id !== `${view}View`);
  });

  document.getElementById("toolDashboard").classList.toggle("active", view === "dashboard");
  document.getElementById("toolAdd").classList.toggle("active", view === "editor" && state.editorMode === "add");
  document.getElementById("toolEdit").classList.toggle("active", view === "editor" && state.editorMode === "edit");
  document.getElementById("toolPayments").classList.toggle("active", view === "payments");

  updateChrome();
  document.getElementById("mainContent").scrollTop = 0;
}

function configureEditorView() {
  const addMode = state.editorMode === "add";
  document.getElementById("editBrowser").classList.toggle("hidden", addMode);
  document.getElementById("editorTitle").textContent = addMode ? "Add Business" : "Edit Businesses";
  document.getElementById("editorSubtitle").textContent = addMode
    ? "Create a new listing and configure the first subscription from the active plan catalog."
    : "Filter by province and district, then update or delete the selected business.";
  document.getElementById("editorModePill").textContent = addMode ? "ADD MODE" : "EDIT MODE";
  document.getElementById("editorPrimaryBtn").textContent = addMode ? "Add Business" : "Update Business";
  document.getElementById("editorSecondaryBtn").textContent = addMode ? "Clear Form" : "Reload Selected";
  document.getElementById("editorDeleteBtn").classList.toggle("hidden", addMode);
  document.getElementById("editorInfoBox").textContent = addMode
    ? "Add mode includes business details plus payment setup so the listing can go live immediately."
    : "Edit mode includes province and district filters, a matching business list, and full update/delete actions.";
}

function updateChrome() {
  const selected = getBusinessBySlug(state.currentView === "payments" ? state.paymentSlug : state.selectedSlug);
  let label = "Directory Overview";
  let path = "Desktop\\Directory Overview";

  if (state.currentView === "editor") {
    if (state.editorMode === "add") {
      label = "Add Business";
      path = "Desktop\\Add Business";
    } else {
      label = selected ? `Edit ${selected.name}` : "Edit Businesses";
      path = selected ? `Desktop\\Edit Businesses\\${selected.slug}.json` : "Desktop\\Edit Businesses";
    }
  }

  if (state.currentView === "payments") {
    label = selected ? `Payment Center - ${selected.name}` : "Payment Center";
    path = selected ? `Desktop\\Payment Center\\${selected.slug}.json` : "Desktop\\Payment Center";
  }

  document.getElementById("windowTitle").textContent = `Administration - ${label}`;
  document.getElementById("addressPath").textContent = path;
  if (state.shell.activeApp === "administration") {
    document.getElementById("taskbarAppLabel").textContent = APP_LABELS.administration;
  }
}

function updateStats() {
  const total = state.businesses.length;
  const active = state.businesses.filter((business) => getStatus(business) === "active").length;
  const expired = state.businesses.filter((business) => getStatus(business) === "expired").length;
  const pending = state.businesses.filter((business) => getStatus(business) === "pending").length;
  const expiring = state.businesses.filter(isExpiringSoon).length;
  const revenue = state.businesses.reduce((sum, business) => {
    const amount = Number(business.subscription?.amount);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);

  document.getElementById("statTotal").textContent = total;
  document.getElementById("statActive").textContent = active;
  document.getElementById("statExpired").textContent = expired;
  document.getElementById("statPending").textContent = pending;
  document.getElementById("statExpiring").textContent = expiring;

  document.getElementById("paymentActiveStat").textContent = active;
  document.getElementById("paymentExpiredStat").textContent = expired;
  document.getElementById("paymentPendingStat").textContent = pending;
  document.getElementById("paymentRevenueStat").textContent = formatCompactAmount(revenue);
}

function renderDashboard() {
  const items = getFilteredBusinesses("dashboard");
  const body = document.getElementById("dashboardTableBody");
  document.getElementById("dashboardVisibleCount").textContent = `${items.length} visible`;
  document.getElementById("dashboardEmpty").classList.toggle("hidden", items.length > 0);

  body.innerHTML = items
    .map((business) => {
      const icon = TYPE_EMOJI[business.type] || "🏫";
      const displayStatus = getDisplayStatus(business);
      return `
        <tr class="dashboard-row ${business.slug === state.selectedSlug ? "selected" : ""}" onclick="selectBusiness('${business.slug}')">
          <td>
            <div class="summary-title">${icon} ${escapeHtml(business.name)}</div>
            <div class="summary-meta">${escapeHtml(business.slug)}</div>
          </td>
          <td>${escapeHtml(business.type || "—")}</td>
          <td>${escapeHtml(business.location_label || "—")}</td>
          <td>${escapeHtml(business.subscription?.plan || getDefaultPlanLabel())}</td>
          <td>${renderStatusBadge(displayStatus)}</td>
          <td>${escapeHtml(formatDate(business.subscription?.expires_at))}</td>
          <td><span data-expiry="${escapeHtml(business.subscription?.expires_at || "")}" data-status="${getStatus(business)}">${escapeHtml(formatCountdown(business.subscription?.expires_at, getStatus(business)))}</span></td>
          <td>
            <div class="table-actions">
              <button class="row-btn" onclick="event.stopPropagation(); selectBusiness('${business.slug}')">${business.slug === state.selectedSlug ? "Selected" : "Select"}</button>
              <button class="row-btn" onclick="event.stopPropagation(); openEditView('${business.slug}')">Edit</button>
              <button class="row-btn primary" onclick="event.stopPropagation(); openPaymentsView('${business.slug}')">Payments</button>
            </div>
          </td>
        </tr>`;
    })
    .join("");

  if (state.currentView === "dashboard") {
    setStatus("Main screen filters applied.", `${items.length} visible / ${state.businesses.length} total`);
  }
}

function renderEditList() {
  const items = getFilteredBusinesses("edit");
  const list = document.getElementById("editList");
  document.getElementById("editVisibleCount").textContent = `${items.length} visible`;
  document.getElementById("editEmpty").classList.toggle("hidden", items.length > 0);

  list.innerHTML = items
    .map((business) => `
      <div class="edit-item ${business.slug === state.selectedSlug ? "active" : ""}" onclick="loadBusinessIntoEditor('${business.slug}')">
        <div class="edit-title">${escapeHtml(business.name)}</div>
        <div class="edit-sub">${escapeHtml(business.location_label || "No location")} · ${escapeHtml(business.type || "Type not set")}</div>
        <div class="summary-badges">${renderStatusBadge(getDisplayStatus(business))}</div>
      </div>
    `)
    .join("");

  if (state.currentView === "editor" && state.editorMode === "edit") {
    setStatus("Edit filters ready.", `${items.length} visible / ${state.businesses.length} total`);
  }
}

function renderPayments() {
  const items = getFilteredBusinesses("payments");
  const body = document.getElementById("paymentsTableBody");
  document.getElementById("paymentsVisibleCount").textContent = `${items.length} visible`;
  document.getElementById("paymentsEmpty").classList.toggle("hidden", items.length > 0);

  body.innerHTML = items
    .map((business) => `
      <tr class="payment-row-active ${business.slug === state.paymentSlug ? "selected" : ""}" onclick="loadPaymentRecord('${business.slug}')">
        <td>
          <div class="edit-title">${escapeHtml(business.name)}</div>
          <div class="summary-meta">${escapeHtml(business.location_label || "No location")}</div>
        </td>
        <td>${renderStatusBadge(getDisplayStatus(business))}</td>
        <td>${escapeHtml(formatDate(business.subscription?.paid_at))}</td>
        <td>${escapeHtml(formatDate(business.subscription?.expires_at))}</td>
        <td><span data-expiry="${escapeHtml(business.subscription?.expires_at || "")}" data-status="${getStatus(business)}">${escapeHtml(formatCountdown(business.subscription?.expires_at, getStatus(business)))}</span></td>
        <td>${escapeHtml(formatCurrency(business.subscription?.amount, business.subscription?.currency))}</td>
      </tr>
    `)
    .join("");

  if (state.currentView === "payments") {
    setStatus("Payment filters applied.", `${items.length} visible / ${state.businesses.length} total`);
  }
}

function getFilteredBusinesses(key) {
  const filters = state.filters[key];
  return state.businesses.filter((business) => {
    const haystack =
      business.search_text ||
      [
        business.name,
        business.slug,
        business.type,
        business.district,
        business.province_name,
        business.subscription?.payment_reference
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    if (filters.search && !haystack.includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.province && String(business.province || "") !== filters.province) {
      return false;
    }
    if (filters.district && business.district !== filters.district) {
      return false;
    }
    if (!matchesStatusFilter(business, filters.status)) {
      return false;
    }
    return true;
  });
}

function matchesStatusFilter(business, filterStatus) {
  if (!filterStatus || filterStatus === "all") {
    return true;
  }
  if (filterStatus === "expiring") {
    return isExpiringSoon(business);
  }
  return getStatus(business) === filterStatus;
}

function selectBusiness(slug) {
  state.selectedSlug = slug;
  updateSelectedSummary();
  renderDashboard();
  renderEditList();
  renderPayments();
  updateChrome();
  const business = getBusinessBySlug(slug);
  if (business) {
    setStatus(`Selected ${business.name}.`, "");
  }
}

async function loadBusinessIntoEditor(slug) {
  try {
    setStatus(`Loading ${slug}...`, "");
    const response = await fetch(`/api/get/${slug}`);
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || "Unable to load business.");
    }

    state.selectedSlug = slug;
    fillBusinessForm(payload.data);
    updateSelectedSummary();
    renderEditList();
    renderPayments();
    updateChrome();
    setStatus(`Loaded ${payload.data.name}.`, "");
  } catch (error) {
    toast("❌ Load Error", error.message, "error");
  }
}

async function loadPaymentRecord(slug, silent = false) {
  try {
    const response = await fetch(`/api/get/${slug}`);
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || "Unable to load payment record.");
    }

    state.paymentSlug = slug;
    state.selectedSlug = slug;
    state.paymentRecord = payload.data;
    updatePaymentFocus();
    updateSelectedSummary();
    renderPayments();
    renderEditList();
    updateChrome();
    if (!silent) {
      setStatus(`Payment record loaded for ${payload.data.name}.`, "");
    }
  } catch (error) {
    toast("❌ Payment Error", error.message, "error");
  }
}

async function saveBusiness() {
  if (state.currentView !== "editor") {
    toast("⚠️ Save Unavailable", "Open the Add or Edit section before saving.", "error");
    return;
  }

  const payload = collectBusinessPayload();
  if (!payload.name || !payload.slug) {
    toast("⚠️ Validation Error", "Business name and slug are required.", "error");
    return;
  }

  try {
    setStatus("Saving business...", "");
    const response = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || "Save failed.");
    }

    invalidateRevenueReportCache();
    await Promise.allSettled([
      refreshDirectory({ reloadReport: false, reloadPaymentRecord: false }),
      loadRevenueReport(state.reports.period, { force: true })
    ]);
    toast("💾 Saved", `${payload.name} has been saved to the directory.`, "success");

    if (state.editorMode === "add") {
      openEditView(data.slug);
    } else {
      await loadBusinessIntoEditor(data.slug);
    }
  } catch (error) {
    toast("❌ Save Error", error.message, "error");
    setStatus("Save failed.", "");
  }
}

async function renewSelectedBusiness() {
  if (!state.paymentSlug) {
    toast("⚠️ Select A Business", "Choose a business in the Payment Center before renewing.", "error");
    return;
  }

  const editingId = valueOf("p_payment_id");
  const payload = {
    id: editingId,
    plan: valueOf("p_plan") || getDefaultPlanLabel(),
    amount: numberOrNull("p_amount"),
    currency: valueOf("p_currency") || state.planCatalog?.currency || "NPR",
    payment_method: valueOf("p_payment_method"),
    payment_reference: valueOf("p_payment_reference"),
    paid_at: valueOf("p_paid_at") || todayString(),
    notes: valueOf("p_notes")
  };

  try {
    setStatus(`${editingId ? "Updating" : "Saving"} payment for ${state.paymentSlug}...`, "");
    const response = await fetch(`/api/payment/${state.paymentSlug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || "Renewal failed.");
    }

    state.paymentRecord = data.data;
    state.selectedSlug = data.data.slug;
    invalidateRevenueReportCache();
    await Promise.allSettled([
      refreshDirectory({ reloadReport: false, reloadPaymentRecord: false }),
      loadRevenueReport(state.reports.period, { force: true })
    ]);
    updatePaymentFocus();
    toast(
      "✅ Payment Saved",
      editingId
        ? "The selected payment record was updated."
        : `The business was renewed on the ${valueOf("p_plan") || getDefaultPlanLabel()} plan.`,
      "success"
    );
    setStatus(`${editingId ? "Updated" : "Renewed"} ${data.data.name}.`, "");
  } catch (error) {
    toast("❌ Renewal Error", error.message, "error");
  }
}

function collectBusinessPayload() {
  const paymentStatus = valueOf("f_payment_status");
  const paidAt =
    paymentStatus === "active" || paymentStatus === "expired"
      ? valueOf("f_paid_at") || todayString()
      : "";
  return {
    original_slug: valueOf("f_original_slug"),
    slug: valueOf("f_slug"),
    name: valueOf("f_name"),
    name_np: valueOf("f_name_np"),
    type: valueOf("f_type"),
    affiliation: valueOf("f_affiliation"),
    district: valueOf("f_district"),
    province: valueOf("f_province"),
    established_year: integerOrNull("f_established"),
    is_verified: checked("f_verified"),
    is_featured: checked("f_featured"),
    level: getSelected("level"),
    field: getSelected("field"),
    programs: state.formTags.programs.slice(),
    tags: state.formTags.tags.slice(),
    description: valueOf("f_description"),
    contact: {
      address: valueOf("f_address"),
      phone: valueOf("f_phone") ? [valueOf("f_phone")] : [],
      email: valueOf("f_email"),
      website: valueOf("f_website"),
      map: {
        lat: numberOrNull("f_lat"),
        lng: numberOrNull("f_lng")
      }
    },
    stats: {
      students: integerOrNull("f_students"),
      faculty: integerOrNull("f_faculty"),
      rating: numberOrNull("f_rating"),
      programs_count: state.formTags.programs.length || null
    },
    media: {
      logo: valueOf("f_logo"),
      cover: valueOf("f_cover"),
      gallery: listValueOf("f_gallery"),
      videos: listValueOf("f_videos")
    },
    facilities: getSelected("facility"),
    social: {
      facebook: valueOf("f_facebook"),
      instagram: valueOf("f_instagram"),
      youtube: valueOf("f_youtube"),
      twitter: valueOf("f_twitter")
    },
    subscription: {
      plan: valueOf("f_plan") || getDefaultPlanLabel(),
      payment_status: paymentStatus,
      amount: numberOrNull("f_amount"),
      currency: valueOf("f_currency") || state.planCatalog?.currency || "NPR",
      payment_method: valueOf("f_payment_method"),
      payment_reference: valueOf("f_payment_reference"),
      paid_at: paidAt,
      auto_renew: valueOf("f_auto_renew") === "true",
      notes: valueOf("f_payment_notes")
    }
  };
}

function fillBusinessForm(record) {
  resetBusinessForm();
  document.getElementById("f_original_slug").value = record.slug || "";
  document.getElementById("f_name").value = record.name || "";
  document.getElementById("f_name_np").value = record.name_np || "";
  document.getElementById("f_slug").value = record.slug || "";
  document.getElementById("f_slug").dataset.manual = "true";
  document.getElementById("f_type").value = record.type || "";
  document.getElementById("f_affiliation").value = record.affiliation || "";
  document.getElementById("f_established").value = record.established_year || "";
  document.getElementById("f_province").value = String(record.province || "");
  populateDistrictSelect("f_district", valueOf("f_province"), record.district || "", "Select district");
  document.getElementById("f_address").value = record.contact?.address || "";
  document.getElementById("f_phone").value = record.contact?.phone?.[0] || "";
  document.getElementById("f_email").value = record.contact?.email || "";
  document.getElementById("f_website").value = record.contact?.website || "";
  document.getElementById("f_lat").value = record.contact?.map?.lat ?? "";
  document.getElementById("f_lng").value = record.contact?.map?.lng ?? "";
  document.getElementById("f_description").value = record.description || "";
  document.getElementById("f_students").value = record.stats?.students ?? "";
  document.getElementById("f_faculty").value = record.stats?.faculty ?? "";
  document.getElementById("f_rating").value = record.stats?.rating ?? "";
  document.getElementById("f_logo").value = record.media?.logo || "";
  document.getElementById("f_cover").value = record.media?.cover || "";
  document.getElementById("f_gallery").value = formatListValue(record.media?.gallery);
  document.getElementById("f_videos").value = formatListValue(record.media?.videos);
  document.getElementById("f_facebook").value = record.social?.facebook || "";
  document.getElementById("f_instagram").value = record.social?.instagram || "";
  document.getElementById("f_youtube").value = record.social?.youtube || "";
  document.getElementById("f_twitter").value = record.social?.twitter || "";
  document.getElementById("f_verified").checked = Boolean(record.is_verified);
  document.getElementById("f_featured").checked = Boolean(record.is_featured);

  setSelected("level", record.level || []);
  setSelected("field", record.field || []);
  setSelected("facility", record.facilities || []);
  state.formTags.programs = (record.programs || []).slice();
  state.formTags.tags = (record.tags || []).slice();
  renderTags("programs");
  renderTags("tags");

  setPlanSelectValue("f_plan", record.subscription?.plan || getDefaultPlanLabel());
  document.getElementById("f_payment_status").value = record.subscription?.payment_status || "pending";
  document.getElementById("f_amount").value =
    record.subscription?.amount ?? getPlanDefinition(record.subscription?.plan)?.amount ?? "";
  document.getElementById("f_currency").value = record.subscription?.currency || state.planCatalog?.currency || "NPR";
  document.getElementById("f_payment_method").value = record.subscription?.payment_method || "";
  document.getElementById("f_payment_reference").value = record.subscription?.payment_reference || "";
  document.getElementById("f_paid_at").value = toDateInput(record.subscription?.paid_at) || "";
  document.getElementById("f_auto_renew").value = record.subscription?.auto_renew ? "true" : "false";
  document.getElementById("f_payment_notes").value = record.subscription?.notes || "";
  updateSlugPreview();
  updateSubscriptionPreview();
}

function resetBusinessForm() {
  [
    "f_original_slug",
    "f_name",
    "f_name_np",
    "f_slug",
    "f_affiliation",
    "f_established",
    "f_address",
    "f_phone",
    "f_email",
    "f_website",
    "f_lat",
    "f_lng",
    "f_description",
    "f_students",
    "f_faculty",
    "f_rating",
    "f_logo",
    "f_cover",
    "f_gallery",
    "f_videos",
    "f_facebook",
    "f_instagram",
    "f_youtube",
    "f_twitter",
    "f_payment_reference",
    "f_payment_notes",
    "f_amount"
  ].forEach((id) => {
    document.getElementById(id).value = "";
  });

  document.getElementById("f_slug").dataset.manual = "false";
  document.getElementById("f_type").value = "";
  document.getElementById("f_province").value = "";
  populateDistrictSelect("f_district", "", "", "Select district");
  document.getElementById("f_verified").checked = false;
  document.getElementById("f_featured").checked = false;
  setPlanSelectValue("f_plan", getDefaultPlanLabel());
  document.getElementById("f_payment_status").value = "pending";
  syncPlanAmount("f_plan", "f_amount");
  document.getElementById("f_currency").value = state.planCatalog?.currency || "NPR";
  document.getElementById("f_payment_method").value = "";
  document.getElementById("f_paid_at").value = "";
  document.getElementById("f_auto_renew").value = "false";
  clearChipSelection();
  state.formTags.programs = [];
  state.formTags.tags = [];
  renderTags("programs");
  renderTags("tags");
  updateSlugPreview();
  updateSubscriptionPreview();
}

function resetPaymentForm() {
  state.paymentEditingId = null;
  document.getElementById("p_payment_id").value = "";
  setPlanSelectValue("p_plan", getDefaultPlanLabel());
  syncPlanAmount("p_plan", "p_amount");
  document.getElementById("p_currency").value = state.planCatalog?.currency || "NPR";
  document.getElementById("p_payment_method").value = "";
  document.getElementById("p_payment_reference").value = "";
  document.getElementById("p_paid_at").value = todayString();
  document.getElementById("p_notes").value = "";
  document.getElementById("paymentSubmitBtn").textContent = "Save New Renewal";
}

function handleEditorSecondaryAction() {
  if (state.editorMode === "add") {
    resetBusinessForm();
    return;
  }

  if (!state.selectedSlug) {
    toast("⚠️ No Selection", "Select a business in edit mode first.", "error");
    return;
  }

  loadBusinessIntoEditor(state.selectedSlug);
}

function saveFromMenu() {
  closeMenus();
  saveBusiness();
}

function editSelectedBusiness() {
  closeMenus();
  const slug = state.selectedSlug || state.paymentSlug;
  if (!slug) {
    toast("⚠️ No Selection", "Select a business first.", "error");
    return;
  }
  openEditView(slug);
}

function openEditFromPayment() {
  if (!state.paymentSlug) {
    toast("⚠️ No Selection", "Select a business in the Payment Center first.", "error");
    return;
  }
  openEditView(state.paymentSlug);
}

function deleteCurrentBusiness() {
  closeMenus();
  const slug =
    state.currentView === "payments"
      ? state.paymentSlug || state.selectedSlug
      : state.currentView === "editor" && state.editorMode === "edit"
        ? valueOf("f_original_slug") || state.selectedSlug
        : state.selectedSlug;
  if (!slug) {
    toast("⚠️ Nothing To Delete", "Select a business in edit mode before deleting.", "error");
    return;
  }

  showModal({
    title: "Delete Business",
    icon: "🗑️",
    body: `Delete <b>${escapeHtml(slug)}</b> from <code>data/basic/_cards.json</code>, <code>data/detailed/${escapeHtml(slug)}.json</code>, and <code>data/payments/${escapeHtml(slug)}</code>? This cannot be undone.`,
    confirmLabel: "Delete",
    confirmClass: "danger",
    onConfirm: async () => {
      try {
        const response = await fetch(`/api/delete/${slug}`, { method: "DELETE" });
        const payload = await response.json();
        if (!payload.success) {
          throw new Error(payload.error || "Delete failed.");
        }

        if (state.selectedSlug === slug) {
          state.selectedSlug = null;
        }
        if (state.paymentSlug === slug) {
          state.paymentSlug = null;
          state.paymentRecord = null;
        }
        resetBusinessForm();
        invalidateRevenueReportCache();
        await Promise.allSettled([
          refreshDirectory({ reloadReport: false, reloadPaymentRecord: false }),
          loadRevenueReport(state.reports.period, { force: true })
        ]);
        if (state.currentView === "editor" && state.editorMode === "edit") {
          renderEditList();
        }
        updatePaymentFocus();
        updateChrome();
        toast("🗑️ Deleted", `${slug} was removed from the directory.`, "success");
      } catch (error) {
        toast("❌ Delete Error", error.message, "error");
      }
    }
  });
}

function showExpiringSoon() {
  closeMenus();
  state.filters.payments.status = "expiring";
  document.getElementById("payStatus").value = "expiring";
  openPaymentsView();
}

function showActiveOnly() {
  closeMenus();
  state.filters.dashboard.status = "active";
  document.getElementById("dashStatus").value = "active";
  showDashboard();
}

function renewSelectedFromTools() {
  closeMenus();
  if (!state.selectedSlug && !state.paymentSlug) {
    toast("⚠️ No Selection", "Select a business before opening renewal tools.", "error");
    return;
  }
  openPaymentsView(state.paymentSlug || state.selectedSlug);
}

function clearSelection() {
  state.selectedSlug = null;
  state.paymentSlug = null;
  state.paymentRecord = null;
  updateSelectedSummary();
  updatePaymentFocus();
  renderDashboard();
  renderEditList();
  renderPayments();
  updateChrome();
  setStatus("Selection cleared.", "");
}

function updateSelectedSummary() {
  const summary = document.getElementById("selectedSummary");
  const lookupSlug = state.selectedSlug || state.paymentSlug;
  const business = getBusinessBySlug(lookupSlug);
  document.getElementById("selectionEditBtn").disabled = !business;
  document.getElementById("selectionPaymentBtn").disabled = !business;
  document.getElementById("selectionClearBtn").disabled = !business;
  if (!business) {
    summary.className = "selected-summary empty";
    summary.textContent = "Pick a business from the directory, edit manager, or payment center to keep it selected here.";
    return;
  }

  summary.className = "selected-summary";
  summary.innerHTML = `
    <div class="summary-title">${escapeHtml(business.name)}</div>
    <div class="summary-meta">${escapeHtml(business.slug)} · ${escapeHtml(business.location_label || "No location")}</div>
    <div class="summary-badges">${renderStatusBadge(getDisplayStatus(business))}</div>
    <div>Type: <b>${escapeHtml(business.type || "Not set")}</b></div>
    <div>Plan: <b>${escapeHtml(business.subscription?.plan || getDefaultPlanLabel())}</b></div>
    <div>Expires: <b>${escapeHtml(formatDate(business.subscription?.expires_at))}</b></div>
    <div>Timer: <b>${escapeHtml(formatCountdown(business.subscription?.expires_at, getStatus(business)))}</b></div>
  `;
}

function updatePaymentFocus() {
  const focus = document.getElementById("paymentFocus");
  const history = document.getElementById("paymentHistoryList");
  if (!state.paymentRecord) {
    focus.className = "payment-focus empty";
    focus.textContent = "Select a business to renew the subscription or review payment history.";
    history.innerHTML = "";
    resetPaymentForm();
    return;
  }

  const business = state.paymentRecord;
  focus.className = "payment-focus";
  focus.innerHTML = `
    <div class="summary-title">${escapeHtml(business.name)}</div>
    <div class="summary-meta">${escapeHtml(business.location_label || "No location")}</div>
    <div class="summary-badges">${renderStatusBadge(getDisplayStatus(business))}</div>
    <div class="focus-countdown" data-expiry="${escapeHtml(business.subscription?.expires_at || "")}" data-status="${getStatus(business)}">${escapeHtml(formatCountdown(business.subscription?.expires_at, getStatus(business)))}</div>
    <div>Last paid: <b>${escapeHtml(formatDate(business.subscription?.paid_at))}</b></div>
    <div>Current expiry: <b>${escapeHtml(formatDate(business.subscription?.expires_at))}</b></div>
    <div>Amount: <b>${escapeHtml(formatCurrency(business.subscription?.amount, business.subscription?.currency))}</b></div>
  `;

  if (state.paymentEditingId) {
    const paymentToEdit = (business.payment_history || []).find((item) => item.id === state.paymentEditingId);
    if (paymentToEdit) {
      fillPaymentForm(paymentToEdit);
    } else {
      resetPaymentForm();
      applyPaymentDefaults(business);
    }
  } else {
    resetPaymentForm();
    applyPaymentDefaults(business);
  }

  const items = (business.payment_history || []).slice().reverse();
  history.innerHTML = items.length
    ? items
        .map((item) => `
          <div class="history-item ${item.id === state.paymentEditingId ? "active" : ""}">
            <div><b>${escapeHtml(formatDate(item.paid_at))}</b> · ${escapeHtml(formatCurrency(item.amount, item.currency))}</div>
            <div>${escapeHtml(item.payment_method || "Method not set")} · ${escapeHtml(item.payment_reference || "No reference")}</div>
            <div>Covered until <b>${escapeHtml(formatDate(item.expires_at))}</b></div>
            <div class="table-actions space-top">
              <button type="button" class="row-btn" onclick="editPaymentHistoryItem('${escapeHtml(item.id)}')">Edit</button>
            </div>
          </div>
        `)
        .join("")
    : `<div class="empty-state">No payment history recorded yet.</div>`;
}

function applyPaymentDefaults(business) {
  setPlanSelectValue("p_plan", business.subscription?.plan || getDefaultPlanLabel());
  const usesCurrentCatalogPlan = hasCatalogPlan(business.subscription?.plan);
  document.getElementById("p_amount").value =
    usesCurrentCatalogPlan
      ? getPlanDefinition(business.subscription?.plan)?.amount ??
        business.subscription?.amount ??
        ""
      : business.subscription?.amount ??
        getPlanDefinition(getDefaultPlanLabel())?.amount ??
        "";
  document.getElementById("p_currency").value = business.subscription?.currency || state.planCatalog?.currency || "NPR";
  document.getElementById("p_payment_method").value = business.subscription?.payment_method || "";
  document.getElementById("p_payment_reference").value = "";
  document.getElementById("p_paid_at").value = todayString();
  document.getElementById("p_notes").value = "";
}

function fillPaymentForm(payment) {
  state.paymentEditingId = payment.id;
  document.getElementById("p_payment_id").value = payment.id || "";
  setPlanSelectValue("p_plan", payment.plan || getDefaultPlanLabel());
  document.getElementById("p_amount").value = payment.amount ?? getPlanDefinition(payment.plan)?.amount ?? "";
  document.getElementById("p_currency").value = payment.currency || state.planCatalog?.currency || "NPR";
  document.getElementById("p_payment_method").value = payment.payment_method || "";
  document.getElementById("p_payment_reference").value = payment.payment_reference || "";
  document.getElementById("p_paid_at").value = toDateInput(payment.paid_at) || todayString();
  document.getElementById("p_notes").value = payment.notes || "";
  document.getElementById("paymentSubmitBtn").textContent = "Update Payment Record";
}

function editPaymentHistoryItem(paymentId) {
  if (!state.paymentRecord) {
    toast("⚠️ No Selection", "Select a business in the Payment Center first.", "error");
    return;
  }

  const payment = (state.paymentRecord.payment_history || []).find((item) => item.id === paymentId);
  if (!payment) {
    toast("⚠️ Missing Payment", "That payment record could not be found.", "error");
    return;
  }

  fillPaymentForm(payment);
  updatePaymentFocus();
  setStatus(`Editing payment from ${formatDate(payment.paid_at)}.`, "");
}

function clearPaymentEditor() {
  resetPaymentForm();
  if (state.paymentRecord) {
    applyPaymentDefaults(state.paymentRecord);
    updatePaymentFocus();
    setStatus(`Ready to add a new payment for ${state.paymentRecord.name}.`, "");
  }
}

function autoSlug() {
  if (state.editorMode !== "add") {
    return;
  }
  const slugInput = document.getElementById("f_slug");
  if (slugInput.dataset.manual === "true") {
    return;
  }
  slugInput.value = slugify(valueOf("f_name"));
  updateSlugPreview();
}

function updateSlugPreview() {
  const slug = valueOf("f_slug");
  document.getElementById("slugPreview").textContent = slug
    ? `Card index: data/basic/_cards.json · Detail file: data/detailed/${slug}.json`
    : "Slug will be generated from the business name.";
}

function updateSubscriptionPreview() {
  const status = valueOf("f_payment_status") || "pending";
  const plan = getPlanDefinition(valueOf("f_plan"));
  const paidAt = valueOf("f_paid_at");
  const preview = document.getElementById("subscriptionPreview");

  if (status === "pending") {
    preview.textContent = plan
      ? `Pending payment. ${plan.label} will run for ${plan.months} months at ${formatCurrency(plan.amount, plan.currency)}${plan.discount_percent ? ` with ${plan.discount_percent}% discount.` : "."}`
      : "Pending payment. Save a paid listing to start the selected subscription term.";
    return;
  }

  if (!paidAt) {
    preview.textContent = plan
      ? `Choose the paid date. ${plan.label} will expire ${plan.months} months after that date.`
      : "Choose the paid date to calculate the subscription expiry.";
    return;
  }

  const start = new Date(paidAt);
  if (Number.isNaN(start.getTime())) {
    preview.textContent = "Enter a valid paid date to calculate the subscription expiry.";
    return;
  }
  const planMonths = plan?.months || 12;
  const expiry = addMonthsSafe(start, planMonths);
  const amountText = formatCurrency(
    numberOrNull("f_amount") ?? plan?.amount,
    valueOf("f_currency") || plan?.currency || "NPR"
  );
  const discountText = plan?.discount_percent ? ` · ${plan.discount_percent}% discount` : "";
  preview.textContent = `${status === "expired" ? "Expired cycle" : "Active cycle"}: ${formatDate(start.toISOString())} to ${formatDate(expiry.toISOString())} · ${amountText}${discountText}`;
}

function handleTagInput(event, group) {
  if (event.key !== "Enter" && event.key !== ",") {
    return;
  }
  event.preventDefault();
  const value = event.target.value.trim().replace(/,$/, "");
  if (!value || state.formTags[group].includes(value)) {
    event.target.value = "";
    return;
  }
  state.formTags[group].push(value);
  event.target.value = "";
  renderTags(group);
}

function renderTags(group) {
  const container = document.getElementById(group === "programs" ? "programsContainer" : "tagsContainer");
  const input = document.getElementById(group === "programs" ? "programInput" : "tagInput");
  container.querySelectorAll(".tag-badge").forEach((element) => element.remove());
  state.formTags[group].forEach((value) => {
    const badge = document.createElement("span");
    badge.className = "tag-badge";
    badge.append(document.createTextNode(value));
    const remove = document.createElement("span");
    remove.className = "tag-remove";
    remove.dataset.group = group;
    remove.dataset.removeTag = value;
    remove.textContent = "×";
    badge.append(document.createTextNode(" "));
    badge.append(remove);
    container.insertBefore(badge, input);
  });
}

function removeTagValue(group, value) {
  state.formTags[group] = state.formTags[group].filter((item) => item !== value);
  renderTags(group);
}

function clearChipSelection() {
  document.querySelectorAll(".chip.selected").forEach((chip) => chip.classList.remove("selected"));
}

function getSelected(group) {
  return [...document.querySelectorAll(`.chip[data-group="${group}"].selected`)].map((chip) => chip.dataset.value);
}

function setSelected(group, values) {
  const selected = new Set(values || []);
  document.querySelectorAll(`.chip[data-group="${group}"]`).forEach((chip) => {
    chip.classList.toggle("selected", selected.has(chip.dataset.value));
  });
}

function toggleMenu(menuId) {
  const menu = document.getElementById(menuId);
  const wrap = menu.closest(".menu-wrap");
  const opening = !wrap.classList.contains("open");
  closeMenus();
  wrap.classList.toggle("open", opening);
}

function closeMenus() {
  document.querySelectorAll(".menu-wrap.open").forEach((wrap) => wrap.classList.remove("open"));
}

function showAdminGuide() {
  closeMenus();
  showModal({
    title: "Admin Guide",
    icon: "📘",
    body: [
      "1. Use <b>Directory Overview</b> to filter by province, district, and payment status.",
      "2. Use <b>Add Business</b> to create a listing with initial payment details.",
      "3. Use <b>Edit Businesses</b> to filter, update, and delete existing listings.",
      "4. Use <b>Payment Center</b> to renew listings with the current plan catalog rates.",
      "5. Use <b>Reports</b> to track revenue, expenses, net performance, and category trends."
    ].join("<br><br>"),
    confirmLabel: "Close",
    hideCancel: true
  });
}

function showAboutDialog() {
  closeMenus();
  showModal({
    title: "About XP Admin",
    icon: "🏛️",
    body: "EduData Nepal XP Directory Admin uses a single basic card index, per-business detailed files, separate add/edit flows, and plan-based payment tracking.",
    confirmLabel: "Close",
    hideCancel: true
  });
}

function showModal({ title, icon, body, confirmLabel, confirmClass = "primary", hideCancel = false, onConfirm = null }) {
  state.modalAction = onConfirm;
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalIcon").textContent = icon;
  document.getElementById("modalBody").innerHTML = body;
  const confirmBtn = document.getElementById("modalConfirmBtn");
  confirmBtn.textContent = confirmLabel;
  confirmBtn.className = `tb-btn ${confirmClass}`;
  document.getElementById("modalCancelBtn").classList.toggle("hidden", hideCancel);
  document.getElementById("modalOverlay").classList.add("show");
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("show");
  state.modalAction = null;
}

function confirmModalAction() {
  const action = state.modalAction;
  closeModal();
  if (typeof action === "function") {
    action();
  }
}

function toast(title, message, type = "success") {
  const element = document.getElementById("toast");
  document.getElementById("toastTitle").textContent = title;
  document.getElementById("toastMsg").textContent = message;
  document.getElementById("toastIcon").textContent = type === "error" ? "❌" : "✅";
  element.className = `xp-toast show ${type}`;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => element.classList.remove("show"), 4200);
}

function closeToast() {
  document.getElementById("toast").classList.remove("show");
}

function startClock() {
  const tick = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    document.getElementById("trayTime").textContent = `${hh}:${mm}`;
    document.getElementById("statusTime").textContent = `${formatDate(now.toISOString())} ${hh}:${mm}`;
  };
  tick();
  setInterval(tick, 10000);
}

function startCountdownTicker() {
  const refreshCountdowns = () => {
    document.querySelectorAll("[data-expiry]").forEach((element) => {
      const status = element.dataset.status || "pending";
      element.textContent = formatCountdown(element.dataset.expiry, status);
    });
  };
  refreshCountdowns();
  setInterval(refreshCountdowns, 1000);
}

function setStatus(message, countText) {
  document.getElementById("statusMsg").textContent = message;
  if (countText !== "") {
    document.getElementById("statusCount").textContent = countText;
  }
}

function getBusinessBySlug(slug) {
  return state.businesses.find((business) => business.slug === slug) || null;
}

function getStatus(business) {
  return business?.subscription?.payment_status || "pending";
}

function getDisplayStatus(business) {
  return isExpiringSoon(business) ? "expiring" : getStatus(business);
}

function isExpiringSoon(business) {
  const days = business?.subscription?.days_remaining;
  return getStatus(business) === "active" && typeof days === "number" && days >= 0 && days <= 7;
}

function renderStatusBadge(status) {
  const label = status === "active" ? "Active" : status === "expired" ? "Expired" : status === "expiring" ? "Expiring Soon" : "Pending";
  const css = status === "active" ? "active" : status === "expired" ? "expired" : status === "expiring" ? "expiring" : "pending";
  return `<span class="badge ${css}">${label}</span>`;
}

function formatDate(value) {
  if (!value) {
    return "Not set";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatCountdown(value, status) {
  if (!value) {
    return status === "pending" ? "Pending payment" : "No timer";
  }
  const expiry = new Date(value);
  if (Number.isNaN(expiry.getTime())) {
    return "Invalid timer";
  }
  const diff = expiry.getTime() - Date.now();
  if (diff <= 0) {
    return `Expired ${formatDuration(Math.abs(diff))} ago`;
  }
  return `${formatDuration(diff)} left`;
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${Math.max(minutes, 0)}m`;
}

function formatCurrency(amount, currency = "NPR") {
  if (amount === null || amount === undefined || amount === "") {
    return "—";
  }
  const number = Number(amount);
  if (!Number.isFinite(number)) {
    return "—";
  }
  return `${currency} ${number.toLocaleString()}`;
}

function formatCurrencyBreakdown(breakdown) {
  const entries = Object.entries(breakdown || {}).filter(([, amount]) => Number.isFinite(Number(amount)));
  if (!entries.length) {
    return "NPR 0";
  }
  return entries
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, amount]) => formatCurrency(amount, currency))
    .join(" / ");
}

function formatCompactAmount(amount) {
  if (!amount) {
    return "0";
  }
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`;
  }
  return String(Math.round(amount));
}

function todayString() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function addMonthsSafe(date, monthCount) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();
  const milliseconds = date.getUTCMilliseconds();
  const lastDayOfTargetMonth = new Date(
    Date.UTC(year, month + monthCount + 1, 0, hours, minutes, seconds, milliseconds)
  );
  const nextDay = Math.min(day, lastDayOfTargetMonth.getUTCDate());
  return new Date(
    Date.UTC(
      lastDayOfTargetMonth.getUTCFullYear(),
      lastDayOfTargetMonth.getUTCMonth(),
      nextDay,
      hours,
      minutes,
      seconds,
      milliseconds
    )
  );
}

function toDateInput(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function valueOf(id) {
  return document.getElementById(id).value.trim();
}

function listValueOf(id) {
  return document.getElementById(id).value
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function formatListValue(values) {
  return Array.isArray(values) ? values.filter(Boolean).join("\n") : "";
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function checked(id) {
  return document.getElementById(id).checked;
}

function integerOrNull(id) {
  const value = valueOf(id);
  return value ? Number.parseInt(value, 10) : null;
}

function numberOrNull(id) {
  const value = valueOf(id);
  return value ? Number.parseFloat(value) : null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
