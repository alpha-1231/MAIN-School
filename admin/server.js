const express = require("express");
const cors = require("cors");
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ENV = loadEnvFile(path.join(__dirname, "..", ".env"));
const app = express();
const PORT = normalizeInteger(ENV.ADMIN_PORT) ?? 3000;
const HOST = stringOrDefault(ENV.ADMIN_HOST, "0.0.0.0");
const SERVE_USER_BUILD = normalizeBoolean(ENV.ADMIN_SERVE_USER_BUILD, true);
const USER_STATIC_ROUTE = normalizeRoutePath(ENV.ADMIN_USER_ROUTE, "/user");
const SOURCE_REMOTE_NAME = stringOrDefault(ENV.ADMIN_GIT_REMOTE, "origin");
const SOURCE_DEFAULT_BRANCH = stringOrDefault(ENV.ADMIN_GIT_DEFAULT_BRANCH);
const SOURCE_REPO_CONFIG_PATH = path.resolve(
  path.join(__dirname, ".."),
  stringOrDefault(ENV.ADMIN_GIT_REPO_PATH, ".")
);
const DB_REPO_CONFIG_VALUE = String(ENV.ADMIN_DB_REPO_PATH || "").trim();
const DB_REPO_CONFIG_PATH = DB_REPO_CONFIG_VALUE
  ? path.resolve(path.join(__dirname, ".."), DB_REPO_CONFIG_VALUE)
  : "";
const DB_REMOTE_NAME = stringOrDefault(ENV.ADMIN_DB_REMOTE, "origin");
const DB_DEFAULT_BRANCH = stringOrDefault(ENV.ADMIN_DB_DEFAULT_BRANCH);
const DB_BASIC_TARGET_PATH = normalizeRepoSubpath(ENV.ADMIN_DB_BASIC_TARGET, "basic");
const DB_DETAILED_TARGET_PATH = normalizeRepoSubpath(ENV.ADMIN_DB_DETAILED_TARGET, "detailed");

const DATA_DIR = path.join(__dirname, "data");
const BASIC_DIR = path.join(DATA_DIR, "basic");
const DETAILED_DIR = path.join(DATA_DIR, "detailed");
const PAYMENTS_DIR = path.join(DATA_DIR, "payments");
const EXPENSES_FILE = path.join(DATA_DIR, "expenses.json");
const PLAN_CATALOG_FILE = path.join(__dirname, "config", "plan-catalog.json");
const NOTES_FILE = path.join(DATA_DIR, "notes.json");
const BASIC_INDEX_FILE = path.join(BASIC_DIR, "_cards.json");
const BASIC_INDEX_NAME = path.basename(BASIC_INDEX_FILE);
const USER_DIST_DIR = path.join(__dirname, "..", "user", "dist");

const PLAN_CATALOG = loadPlanCatalog();
const DEFAULT_SUBSCRIPTION_PLAN = PLAN_CATALOG.default_label;
const DEFAULT_SUBSCRIPTION_CURRENCY = PLAN_CATALOG.currency;
const PROVINCE_NAMES = {
  "1": "Koshi",
  "2": "Madhesh",
  "3": "Bagmati",
  "4": "Gandaki",
  "5": "Lumbini",
  "6": "Karnali",
  "7": "Sudurpashchim",
};

[BASIC_DIR, DETAILED_DIR, PAYMENTS_DIR].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));
if (!fs.existsSync(NOTES_FILE)) {
  writeJson(NOTES_FILE, []);
}
if (!fs.existsSync(EXPENSES_FILE)) {
  writeJson(EXPENSES_FILE, []);
}

let basicCards = loadBasicCards();
let basicCardsBySlug = buildBasicCardMap(basicCards);
let revenuePaymentsCache = null;

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));
if (SERVE_USER_BUILD && fs.existsSync(USER_DIST_DIR)) {
  app.use(USER_STATIC_ROUTE, express.static(USER_DIST_DIR));
  app.get(new RegExp(`^${escapeRegExp(USER_STATIC_ROUTE)}(?:/.*)?$`), (req, res) => {
    res.sendFile(path.join(USER_DIST_DIR, "index.html"));
  });
}

app.get("/api/list", (req, res) => {
  try {
    res.json({
      success: true,
      data: basicCards.map((card) =>
        decorateRecord(card, {
          includePaymentHistory: false,
          includePaymentReferenceInSearch: true,
        })
      ),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/public/list", (req, res) => {
  try {
    const publicCards = basicCards
      .map((card) =>
        decorateRecord(card, {
          includePaymentHistory: false,
          includePaymentReferenceInSearch: false,
        })
      )
      .filter((record) => isPublicRecordVisible(record));

    res.json({
      success: true,
      data: publicCards.map((record) => toPublicRecord(record)),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/get/:slug", (req, res) => {
  try {
    const slug = sanitizeSlug(req.params.slug);
    const basic = basicCardsBySlug.get(slug) || readLegacyBasicCard(slug) || {};
    const detailed = readJson(filePathFor(DETAILED_DIR, slug), null);

    if (!detailed && !basic.slug) {
      return res.status(404).json({ success: false, error: "Not found" });
    }

    res.json({
      success: true,
      data: decorateRecord(mergeBusinessRecords(basic, detailed || {}), {
        includePaymentHistory: true,
        includePaymentReferenceInSearch: true,
      }),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/public/get/:slug", (req, res) => {
  try {
    const slug = sanitizeSlug(req.params.slug);
    const basic = basicCardsBySlug.get(slug) || readLegacyBasicCard(slug) || {};
    const detailed = readJson(filePathFor(DETAILED_DIR, slug), null);

    if (!detailed && !basic.slug) {
      return res.status(404).json({ success: false, error: "Not found" });
    }

    const record = decorateRecord(mergeBusinessRecords(basic, detailed || {}), {
      includePaymentHistory: false,
      includePaymentReferenceInSearch: false,
    });
    if (!isPublicRecordVisible(record)) {
      return res.status(404).json({ success: false, error: "Not found" });
    }

    res.json({
      success: true,
      data: toPublicRecord(record),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/meta/plans", (req, res) => {
  res.json({
    success: true,
    data: PLAN_CATALOG,
  });
});

app.post("/api/save", (req, res) => {
  try {
    const payload = req.body || {};
    const name = stringOrDefault(payload.name);
    const slug = sanitizeSlug(payload.slug);
    const originalSlug = sanitizeSlug(payload.original_slug || payload.slug);

    if (!name || !slug) {
      return res.status(400).json({ success: false, error: "name and slug are required" });
    }

    const sourceSlug = originalSlug || slug;
    const existingBasic =
      basicCardsBySlug.get(sourceSlug) ||
      readLegacyBasicCard(sourceSlug) ||
      basicCardsBySlug.get(slug) ||
      readLegacyBasicCard(slug) ||
      {};
    const existingDetailed = readJson(
      filePathFor(DETAILED_DIR, sourceSlug),
      readJson(filePathFor(DETAILED_DIR, slug), {})
    );

    if (sourceSlug !== slug) {
      const conflictingCard = basicCardsBySlug.get(slug) || readLegacyBasicCard(slug);
      const conflictingDetailed = readJson(filePathFor(DETAILED_DIR, slug), null);
      const currentId = existingBasic.id || existingDetailed.id || "";
      const conflictingId = conflictingCard?.id || conflictingDetailed?.id || "";

      if (conflictingId && conflictingId !== currentId) {
        return res.status(409).json({
          success: false,
          error: `A business with slug "${slug}" already exists.`,
        });
      }
    }

    const now = new Date().toISOString();
    const existingSubscription = existingDetailed.subscription || existingBasic.subscription || {};
    const existingPaymentHistory = loadPaymentHistory(
      sourceSlug || slug,
      existingDetailed.payment_history || []
    );
    const subscription = buildSubscriptionFromSave(payload.subscription, existingSubscription, now);
    const paymentHistory = buildPaymentHistory(
      existingPaymentHistory,
      subscription,
      existingSubscription,
      payload.subscription
    );
    const basic = buildBasicCard(payload, existingBasic, existingDetailed, subscription, now);
    const existingMedia = existingDetailed.media || {};
    const incomingMedia = payload.media || {};

    const detailed = {
      ...basic,
      description: stringOrDefault(payload.description),
      contact: {
        address: stringOrDefault(payload.contact?.address),
        phone: cleanStringArray(payload.contact?.phone),
        email: stringOrDefault(payload.contact?.email),
        website: stringOrDefault(payload.contact?.website),
        map: {
          lat: normalizeFloat(payload.contact?.map?.lat),
          lng: normalizeFloat(payload.contact?.map?.lng),
        },
      },
      stats: {
        students: normalizeInteger(payload.stats?.students),
        faculty: normalizeInteger(payload.stats?.faculty),
        rating: normalizeFloat(payload.stats?.rating),
        programs_count:
          normalizeInteger(payload.stats?.programs_count) ??
          (cleanStringArray(payload.programs).length || null),
      },
      media: {
        logo: basic.logo,
        cover: basic.cover,
        gallery: cleanStringArray(
          Array.isArray(incomingMedia.gallery) ? incomingMedia.gallery : existingMedia.gallery
        ),
        videos: cleanStringArray(
          Array.isArray(incomingMedia.videos) ? incomingMedia.videos : existingMedia.videos
        ),
      },
      facilities: cleanStringArray(payload.facilities),
      social: {
        facebook: stringOrDefault(payload.social?.facebook),
        instagram: stringOrDefault(payload.social?.instagram),
        youtube: stringOrDefault(payload.social?.youtube),
        twitter: stringOrDefault(payload.social?.twitter),
      },
    };

    writeJson(filePathFor(DETAILED_DIR, slug), detailed);
    savePaymentHistory(slug, paymentHistory);
    saveBasicCard(basic, sourceSlug);

    removeIfExists(filePathFor(BASIC_DIR, slug));
    if (sourceSlug && sourceSlug !== slug) {
      removeIfExists(filePathFor(DETAILED_DIR, sourceSlug));
      removeIfExists(filePathFor(BASIC_DIR, sourceSlug));
      removePaymentHistory(sourceSlug);
    }
    invalidateRevenueCache();

    res.json({
      success: true,
      slug,
      basic: decorateRecord(basic, {
        includePaymentHistory: false,
        includePaymentReferenceInSearch: true,
      }),
      detailed: decorateRecord(detailed, {
        includePaymentHistory: true,
        includePaymentReferenceInSearch: true,
      }),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/payment/:slug", (req, res) => {
  try {
    const slug = sanitizeSlug(req.params.slug);
    const detailedPath = filePathFor(DETAILED_DIR, slug);
    const basic = basicCardsBySlug.get(slug) || readLegacyBasicCard(slug) || {};
    const detailed = readJson(detailedPath, null);

    if (!detailed && !basic.slug) {
      return res.status(404).json({ success: false, error: "Business not found" });
    }

    const current = mergeBusinessRecords(basic, detailed || {});
    const existingSubscription = current.subscription || {};
    const existingPaymentHistory = loadPaymentHistory(slug, current.payment_history);
    const paymentPayload = req.body || {};
    const editingPaymentId = stringOrDefault(paymentPayload.id);
    const editingPayment = existingPaymentHistory.find((entry) => entry.id === editingPaymentId) || null;
    const paymentDate = normalizeDateInput(paymentPayload.paid_at) || new Date();
    const resolvedPlan = stringOrDefault(
      paymentPayload.plan,
      editingPayment?.plan || existingSubscription.plan || DEFAULT_SUBSCRIPTION_PLAN
    );
    const cycleStart = editingPayment
      ? normalizeDateInput(paymentPayload.starts_at || editingPayment.starts_at) ||
        normalizeDateInput(editingPayment.paid_at) ||
        paymentDate
      : getRenewalStart(existingSubscription.expires_at, paymentDate);
    const expiresAt =
      normalizeDateInput(paymentPayload.expires_at) ||
      getPlanExpiryDate(cycleStart, resolvedPlan);
    const renewed = stripSubscriptionForStorage({
      ...hydrateStoredSubscription(existingSubscription),
      plan: resolvedPlan,
      amount:
        normalizeFloat(paymentPayload.amount) ??
        normalizeFloat(editingPayment?.amount) ??
        (editingPayment ? normalizeFloat(existingSubscription.amount) : null) ??
        getDefaultPlanAmount(resolvedPlan),
      currency: stringOrDefault(
        paymentPayload.currency,
        editingPayment?.currency || existingSubscription.currency || DEFAULT_SUBSCRIPTION_CURRENCY
      ),
      payment_method: stringOrDefault(
        paymentPayload.payment_method,
        editingPayment?.payment_method || existingSubscription.payment_method || ""
      ),
      payment_reference: stringOrDefault(
        paymentPayload.payment_reference,
        editingPayment?.payment_reference || ""
      ),
      notes: stringOrDefault(
        paymentPayload.notes,
        editingPayment?.notes || existingSubscription.notes || ""
      ),
      auto_renew: Boolean(paymentPayload.auto_renew ?? existingSubscription.auto_renew),
      paid_at: paymentDate.toISOString(),
      starts_at: cycleStart.toISOString(),
      expires_at: expiresAt.toISOString(),
      payment_status: expiresAt.getTime() > Date.now() ? "active" : "expired",
      last_updated_at: new Date().toISOString(),
    });

    const historyEntry = sanitizePaymentRecord(
      {
        id: editingPaymentId || generateId(),
        slug,
        plan: renewed.plan,
        amount: renewed.amount,
        currency: renewed.currency,
        paid_at: renewed.paid_at,
        starts_at: renewed.starts_at,
        expires_at: renewed.expires_at,
        payment_method: renewed.payment_method,
        payment_reference: renewed.payment_reference,
        notes: renewed.notes,
        created_at: editingPayment?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      slug
    );
    const nextPaymentHistory = upsertPaymentHistory(existingPaymentHistory, historyEntry);
    const effectiveSubscription = editingPayment
      ? deriveSubscriptionFromPaymentHistory(nextPaymentHistory, existingSubscription)
      : renewed;

    const updatedAt = new Date().toISOString();
    const nextBasic = buildBasicCard(
      {
        ...current,
        subscription: effectiveSubscription,
        updated_at: updatedAt,
      },
      basic,
      detailed || {},
      effectiveSubscription,
      updatedAt
    );
    const nextDetailed = {
      ...current,
      ...nextBasic,
      subscription: effectiveSubscription,
      updated_at: updatedAt,
      media: {
        logo: nextBasic.logo,
        cover: nextBasic.cover,
        gallery: cleanStringArray(current.media?.gallery),
        videos: cleanStringArray(current.media?.videos),
      },
    };

    writeJson(detailedPath, nextDetailed);
    savePaymentHistory(slug, nextPaymentHistory);
    saveBasicCard(nextBasic);
    removeIfExists(filePathFor(BASIC_DIR, slug));
    invalidateRevenueCache();

    res.json({
      success: true,
      data: decorateRecord(nextDetailed, {
        includePaymentHistory: true,
        includePaymentReferenceInSearch: true,
      }),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/api/delete/:slug", (req, res) => {
  try {
    const slug = sanitizeSlug(req.params.slug);
    removeBasicCard(slug);
    removeIfExists(filePathFor(DETAILED_DIR, slug));
    removeIfExists(filePathFor(BASIC_DIR, slug));
    removePaymentHistory(slug);
    invalidateRevenueCache();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/reports/analytics", handleAnalyticsReportRequest);
app.get("/api/reports/revenue", (req, res) => {
  handleAnalyticsReportRequest(req, res);
});

app.get("/api/reports/expenses", (req, res) => {
  try {
    res.json({
      success: true,
      data: loadExpenses(),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/reports/expenses", (req, res) => {
  try {
    const payload = req.body || {};
    const title = stringOrDefault(payload.title);
    const amount = normalizeFloat(payload.amount);
    const incurredAt = normalizeDateInput(payload.incurred_at);

    if (!title) {
      return res.status(400).json({ success: false, error: "Expense title is required." });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: "Expense amount must be greater than 0." });
    }
    if (!incurredAt) {
      return res.status(400).json({ success: false, error: "Expense date is required." });
    }

    const expenses = loadExpenses();
    const expenseId = stringOrDefault(payload.id) || generateId();
    const existingExpense = expenses.find((expense) => expense.id === expenseId);
    const expense = sanitizeExpenseRecord({
      id: expenseId,
      title,
      category: stringOrDefault(payload.category, existingExpense?.category || "Operations"),
      amount,
      currency: stringOrDefault(
        payload.currency,
        existingExpense?.currency || DEFAULT_SUBSCRIPTION_CURRENCY
      ),
      incurred_at: incurredAt.toISOString(),
      notes: stringOrDefault(payload.notes, existingExpense?.notes || ""),
      created_at: existingExpense?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const nextExpenses = expenses.filter((expenseItem) => expenseItem.id !== expenseId);
    nextExpenses.push(expense);
    saveExpenses(nextExpenses);

    res.json({ success: true, data: expense });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/api/reports/expenses/:id", (req, res) => {
  try {
    const expenseId = stringOrDefault(req.params.id);
    const nextExpenses = loadExpenses().filter((expense) => expense.id !== expenseId);
    saveExpenses(nextExpenses);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/notes", (req, res) => {
  try {
    const notes = loadNotes().sort((left, right) => right.updated_at.localeCompare(left.updated_at));
    res.json({ success: true, data: notes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/notes", (req, res) => {
  try {
    const payload = req.body || {};
    const title = stringOrDefault(payload.title, "Untitled note");
    const content = String(payload.content ?? "");
    if (!title && !content.trim()) {
      return res.status(400).json({ success: false, error: "A note needs a title or content." });
    }

    const notes = loadNotes();
    const noteId = stringOrDefault(payload.id) || generateId();
    const existing = notes.find((note) => note.id === noteId);
    const now = new Date().toISOString();
    const nextNote = {
      id: noteId,
      title,
      content,
      created_at: existing?.created_at || now,
      updated_at: now,
    };
    const nextNotes = notes.filter((note) => note.id !== noteId);
    nextNotes.push(nextNote);
    saveNotes(nextNotes);

    res.json({ success: true, data: nextNote });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/api/notes/:id", (req, res) => {
  try {
    const noteId = stringOrDefault(req.params.id);
    const notes = loadNotes();
    const nextNotes = notes.filter((note) => note.id !== noteId);
    saveNotes(nextNotes);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/source/status", (req, res) => {
  try {
    res.json({
      success: true,
      data: buildSourceSnapshot(),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/source/pull", (req, res) => {
  try {
    const branch = getSourceBranchName();
    const snapshot = executeSourceWorkflow([
      { args: ["pull", "--rebase", SOURCE_REMOTE_NAME, branch], summary: `Pulled latest changes from ${SOURCE_REMOTE_NAME}/${branch}.` },
    ]);
    res.json({ success: true, data: snapshot });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/source/stage", (req, res) => {
  try {
    const snapshot = executeSourceWorkflow([
      { args: ["add", "-A"], summary: "All repository changes were staged." },
    ]);
    res.json({ success: true, data: snapshot });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/source/commit", (req, res) => {
  try {
    const message = stringOrDefault(req.body?.message);
    if (!message) {
      return res.status(400).json({ success: false, error: "A commit message is required." });
    }

    const snapshot = executeSourceWorkflow([
      { args: ["commit", "-m", message], summary: "Commit created.", allowNoop: true, noopSummary: "No staged changes were available to commit." },
    ]);
    res.json({ success: true, data: snapshot });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/source/push", (req, res) => {
  try {
    const branch = getSourceBranchName();
    const snapshot = executeSourceWorkflow([
      { args: ["push", SOURCE_REMOTE_NAME, `HEAD:${branch}`], summary: `Changes were pushed to ${SOURCE_REMOTE_NAME}/${branch}.` },
    ]);
    res.json({ success: true, data: snapshot });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/source/publish", (req, res) => {
  try {
    const message = stringOrDefault(req.body?.message);
    if (!message) {
      return res.status(400).json({ success: false, error: "A commit message is required." });
    }

    const branch = getSourceBranchName();
    const snapshot = executeSourceWorkflow([
      { args: ["add", "-A"], summary: "All repository changes were staged." },
      { args: ["commit", "-m", message], summary: "Commit created.", allowNoop: true, noopSummary: "No staged changes were available to commit." },
      { args: ["pull", "--rebase", SOURCE_REMOTE_NAME, branch], summary: `Pulled latest changes from ${SOURCE_REMOTE_NAME}/${branch}.` },
      { args: ["push", SOURCE_REMOTE_NAME, `HEAD:${branch}`], summary: `Changes were pushed to ${SOURCE_REMOTE_NAME}/${branch}.` },
    ]);
    res.json({ success: true, data: snapshot });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/db/status", (req, res) => {
  try {
    res.json({
      success: true,
      data: buildDbSnapshot(),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/db/mirror", (req, res) => {
  try {
    const mirrored = mirrorBusinessDataToDbRepo();
    res.json({
      success: true,
      data: buildDbSnapshot({
        output: mirrored.log,
        summary: mirrored.summary,
      }),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/db/pull", (req, res) => {
  try {
    const branch = getDbBranchName();
    const snapshot = executeDbWorkflow([
      {
        args: ["pull", "--rebase", DB_REMOTE_NAME, branch],
        summary: `Pulled latest data changes from ${DB_REMOTE_NAME}/${branch}.`,
      },
    ]);
    res.json({ success: true, data: snapshot });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/db/stage", (req, res) => {
  try {
    const snapshot = executeDbWorkflow([
      { args: ["add", "-A"], summary: "All DB repository changes were staged." },
    ]);
    res.json({ success: true, data: snapshot });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/db/commit", (req, res) => {
  try {
    const message = stringOrDefault(req.body?.message);
    if (!message) {
      return res.status(400).json({ success: false, error: "A commit message is required." });
    }

    const snapshot = executeDbWorkflow([
      {
        args: ["commit", "-m", message],
        summary: "DB repository commit created.",
        allowNoop: true,
        noopSummary: "No staged DB changes were available to commit.",
      },
    ]);
    res.json({ success: true, data: snapshot });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/db/push", (req, res) => {
  try {
    const branch = getDbBranchName();
    const snapshot = executeDbWorkflow([
      {
        args: ["push", DB_REMOTE_NAME, `HEAD:${branch}`],
        summary: `DB changes were pushed to ${DB_REMOTE_NAME}/${branch}.`,
      },
    ]);
    res.json({ success: true, data: snapshot });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/db/publish", (req, res) => {
  try {
    const message = stringOrDefault(req.body?.message);
    if (!message) {
      return res.status(400).json({ success: false, error: "A commit message is required." });
    }

    const branch = getDbBranchName();
    const snapshot = executeDbWorkflow([
      {
        args: ["pull", "--rebase", DB_REMOTE_NAME, branch],
        summary: `Pulled latest data changes from ${DB_REMOTE_NAME}/${branch}.`,
      },
      {
        run: () => mirrorBusinessDataToDbRepo(),
      },
      { args: ["add", "-A"], summary: "All DB repository changes were staged." },
      {
        args: ["commit", "-m", message],
        summary: "DB repository commit created.",
        allowNoop: true,
        noopSummary: "No staged DB changes were available to commit.",
      },
      {
        args: ["push", DB_REMOTE_NAME, `HEAD:${branch}`],
        summary: `DB changes were pushed to ${DB_REMOTE_NAME}/${branch}.`,
      },
    ]);
    res.json({ success: true, data: snapshot });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

function decorateRecord(record, options = {}) {
  const {
    includePaymentHistory = false,
    includePaymentReferenceInSearch = false,
  } = options;
  const normalized = mergeBusinessRecords(record, {});
  const subscription = hydrateStoredSubscription(normalized.subscription || {});
  const provinceName = PROVINCE_NAMES[String(normalized.province || "")] || "";
  const paymentHistory = includePaymentHistory
    ? loadPaymentHistory(normalized.slug, normalized.payment_history)
    : [];
  const decorated = {
    ...normalized,
    province_name: provinceName,
    location_label: [normalized.district, provinceName].filter(Boolean).join(", "),
    subscription,
    search_text: buildSearchText(normalized, provinceName, {
      includePaymentReference: includePaymentReferenceInSearch,
    }),
  };

  if (includePaymentHistory) {
    decorated.payment_history = paymentHistory;
  } else {
    delete decorated.payment_history;
  }

  return decorated;
}

function mergeBusinessRecords(basic, detailed) {
  const basicRecord = basic || {};
  const detailedRecord = detailed || {};
  const mergedMedia = {
    ...(basicRecord.media || {}),
    ...(detailedRecord.media || {}),
  };
  const logo = stringOrDefault(
    detailedRecord.logo ||
      mergedMedia.logo ||
      basicRecord.logo ||
      basicRecord.media?.logo
  );
  const cover = stringOrDefault(
    detailedRecord.cover ||
      mergedMedia.cover ||
      basicRecord.cover ||
      basicRecord.media?.cover
  );

  return {
    ...basicRecord,
    ...detailedRecord,
    logo,
    cover,
    contact: {
      ...(basicRecord.contact || {}),
      ...(detailedRecord.contact || {}),
    },
    stats: {
      ...(basicRecord.stats || {}),
      ...(detailedRecord.stats || {}),
    },
    media: {
      ...mergedMedia,
      logo,
      cover,
      gallery: cleanStringArray(mergedMedia.gallery),
      videos: cleanStringArray(mergedMedia.videos),
    },
    social: {
      ...(basicRecord.social || {}),
      ...(detailedRecord.social || {}),
    },
    level: cleanStringArray(detailedRecord.level || basicRecord.level),
    field: cleanStringArray(detailedRecord.field || basicRecord.field),
    programs: cleanStringArray(detailedRecord.programs || basicRecord.programs),
    tags: cleanStringArray(detailedRecord.tags || basicRecord.tags),
    facilities: cleanStringArray(detailedRecord.facilities || basicRecord.facilities),
    subscription: stripSubscriptionForStorage(
      detailedRecord.subscription || basicRecord.subscription || {}
    ),
    payment_history: ensureArray(detailedRecord.payment_history),
  };
}

function buildBasicCard(payload, existingBasic, existingDetailed, subscription, nowIso) {
  const source = payload || {};
  const media = source.media || {};
  return sanitizeBasicCard({
    id: existingBasic.id || existingDetailed.id || source.id || generateId(),
    slug: source.slug,
    name: source.name,
    name_np: source.name_np,
    type: source.type,
    level: source.level,
    field: source.field,
    affiliation: source.affiliation,
    district: source.district,
    province: source.province,
    is_verified: source.is_verified,
    is_featured: source.is_featured,
    tags: source.tags,
    logo: source.logo ?? media.logo,
    cover: source.cover ?? media.cover,
    subscription,
    updated_at: nowIso,
    created_at: existingBasic.created_at || existingDetailed.created_at || nowIso,
  });
}

function sanitizeBasicCard(record) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const media = record.media || {};
  const slug = sanitizeSlug(record.slug);
  const name = stringOrDefault(record.name);
  if (!slug || !name) {
    return null;
  }

  return {
    id: stringOrDefault(record.id),
    slug,
    name,
    name_np: stringOrDefault(record.name_np),
    type: stringOrDefault(record.type),
    level: cleanStringArray(record.level),
    field: cleanStringArray(record.field),
    affiliation: stringOrDefault(record.affiliation),
    district: stringOrDefault(record.district),
    province: normalizeProvince(record.province),
    is_verified: Boolean(record.is_verified),
    is_featured: Boolean(record.is_featured),
    tags: cleanStringArray(record.tags),
    logo: stringOrDefault(record.logo || media.logo),
    cover: stringOrDefault(record.cover || media.cover),
    subscription: stripSubscriptionForStorage(record.subscription || {}),
    updated_at: stringOrDefault(record.updated_at),
    created_at: stringOrDefault(record.created_at),
  };
}

function loadBasicCards() {
  const stored = readJson(BASIC_INDEX_FILE, null);
  if (Array.isArray(stored)) {
    return sortBasicCards(stored.map((item) => sanitizeBasicCard(item)).filter(Boolean));
  }

  const migrated = migrateBasicCards();
  writeJson(BASIC_INDEX_FILE, migrated, null);
  return migrated;
}

function migrateBasicCards() {
  const legacyCards = fs
    .readdirSync(BASIC_DIR)
    .filter((file) => file.endsWith(".json") && file !== BASIC_INDEX_NAME)
    .map((file) => sanitizeBasicCard(readJson(path.join(BASIC_DIR, file), null)))
    .filter(Boolean);

  if (legacyCards.length) {
    return sortBasicCards(legacyCards);
  }

  const detailedCards = fs
    .readdirSync(DETAILED_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => sanitizeBasicCard(readJson(path.join(DETAILED_DIR, file), null)))
    .filter(Boolean);

  return sortBasicCards(detailedCards);
}

function saveBasicCard(card, sourceSlug = card.slug) {
  const normalized = sanitizeBasicCard(card);
  if (!normalized) {
    return;
  }

  const next = basicCards.filter(
    (item) => item.slug !== normalized.slug && item.slug !== sanitizeSlug(sourceSlug)
  );
  next.push(normalized);
  basicCards = sortBasicCards(next);
  basicCardsBySlug = buildBasicCardMap(basicCards);
  writeJson(BASIC_INDEX_FILE, basicCards, null);
}

function removeBasicCard(slug) {
  const normalizedSlug = sanitizeSlug(slug);
  if (!normalizedSlug) {
    return;
  }

  const next = basicCards.filter((card) => card.slug !== normalizedSlug);
  if (next.length === basicCards.length) {
    return;
  }

  basicCards = next;
  basicCardsBySlug = buildBasicCardMap(basicCards);
  writeJson(BASIC_INDEX_FILE, basicCards, null);
}

function buildBasicCardMap(cards) {
  return new Map(cards.map((card) => [card.slug, card]));
}

function sortBasicCards(cards) {
  return cards.sort((left, right) => {
    const nameCompare = left.name.localeCompare(right.name);
    return nameCompare || left.slug.localeCompare(right.slug);
  });
}

function readLegacyBasicCard(slug) {
  const normalizedSlug = sanitizeSlug(slug);
  if (!normalizedSlug) {
    return null;
  }
  return sanitizeBasicCard(readJson(filePathFor(BASIC_DIR, normalizedSlug), null));
}

function buildSearchText(record, provinceName, options = {}) {
  const { includePaymentReference = false } = options;
  return [
    record.name,
    record.slug,
    record.type,
    ...(record.level || []),
    ...(record.field || []),
    ...(record.programs || []),
    record.district,
    provinceName,
    record.affiliation,
    ...(record.tags || []),
    ...(includePaymentReference ? [record.subscription?.payment_reference] : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function toPublicRecord(record) {
  return {
    id: stringOrDefault(record.id),
    slug: stringOrDefault(record.slug),
    name: stringOrDefault(record.name),
    name_np: stringOrDefault(record.name_np),
    type: stringOrDefault(record.type),
    level: cleanStringArray(record.level),
    field: cleanStringArray(record.field),
    affiliation: stringOrDefault(record.affiliation),
    district: stringOrDefault(record.district),
    province: stringOrDefault(record.province),
    province_name: stringOrDefault(record.province_name),
    location_label: stringOrDefault(record.location_label),
    is_verified: Boolean(record.is_verified),
    is_featured: Boolean(record.is_featured),
    tags: cleanStringArray(record.tags),
    logo: stringOrDefault(record.logo || record.media?.logo),
    cover: stringOrDefault(record.cover || record.media?.cover),
    description: stringOrDefault(record.description),
    programs: cleanStringArray(record.programs),
    facilities: cleanStringArray(record.facilities),
    contact: {
      address: stringOrDefault(record.contact?.address),
      phone: cleanStringArray(record.contact?.phone),
      email: stringOrDefault(record.contact?.email),
      website: stringOrDefault(record.contact?.website),
      map: {
        lat: normalizeFloat(record.contact?.map?.lat),
        lng: normalizeFloat(record.contact?.map?.lng),
      },
    },
    stats: {
      students: normalizeInteger(record.stats?.students),
      faculty: normalizeInteger(record.stats?.faculty),
      rating: normalizeFloat(record.stats?.rating),
      programs_count: normalizeInteger(record.stats?.programs_count),
    },
    media: {
      logo: stringOrDefault(record.media?.logo || record.logo),
      cover: stringOrDefault(record.media?.cover || record.cover),
      gallery: cleanStringArray(record.media?.gallery),
      videos: cleanStringArray(record.media?.videos),
    },
    social: {
      facebook: stringOrDefault(record.social?.facebook),
      instagram: stringOrDefault(record.social?.instagram),
      youtube: stringOrDefault(record.social?.youtube),
      twitter: stringOrDefault(record.social?.twitter),
    },
    created_at: stringOrDefault(record.created_at),
    updated_at: stringOrDefault(record.updated_at),
    search_text: buildSearchText(record, record.province_name, {
      includePaymentReference: false,
    }),
  };
}

function isPublicRecordVisible(record) {
  return hydrateStoredSubscription(record?.subscription || {}).is_active;
}

function paymentDirFor(slug) {
  return path.join(PAYMENTS_DIR, sanitizeSlug(slug));
}

function paymentFilePath(slug, paymentId) {
  return path.join(paymentDirFor(slug), `${stringOrDefault(paymentId)}.json`);
}

function readStoredPaymentHistory(slug) {
  const normalizedSlug = sanitizeSlug(slug);
  if (!normalizedSlug) {
    return [];
  }

  const dir = paymentDirFor(normalizedSlug);
  if (!fs.existsSync(dir)) {
    return [];
  }

  return sanitizePaymentHistory(
    fs
      .readdirSync(dir)
      .filter((file) => file.endsWith(".json"))
      .map((file) => readJson(path.join(dir, file), null)),
    normalizedSlug
  );
}

function loadPaymentHistory(slug, fallbackHistory = []) {
  const stored = readStoredPaymentHistory(slug);
  if (stored.length) {
    return stored;
  }
  return sanitizePaymentHistory(fallbackHistory, slug);
}

function savePaymentHistory(slug, records) {
  const normalizedSlug = sanitizeSlug(slug);
  if (!normalizedSlug) {
    return [];
  }

  const normalizedRecords = sanitizePaymentHistory(records, normalizedSlug);
  const dir = paymentDirFor(normalizedSlug);

  if (!normalizedRecords.length) {
    removePaymentHistory(normalizedSlug);
    return [];
  }

  fs.mkdirSync(dir, { recursive: true });
  const validIds = new Set(normalizedRecords.map((record) => record.id));

  for (const file of fs.readdirSync(dir).filter((entry) => entry.endsWith(".json"))) {
    if (!validIds.has(path.basename(file, ".json"))) {
      fs.unlinkSync(path.join(dir, file));
    }
  }

  for (const record of normalizedRecords) {
    writeJson(paymentFilePath(normalizedSlug, record.id), record);
  }

  return normalizedRecords;
}

function removePaymentHistory(slug) {
  const normalizedSlug = sanitizeSlug(slug);
  if (!normalizedSlug) {
    return;
  }

  const dir = paymentDirFor(normalizedSlug);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function sanitizePaymentHistory(records, slug) {
  return sortPaymentHistory(
    ensureArray(records)
      .map((record) => sanitizePaymentRecord(record, slug))
      .filter(Boolean)
  );
}

function sortPaymentHistory(records) {
  return records.sort((left, right) => {
    const leftStart = normalizeDateInput(left.starts_at || left.paid_at)?.getTime() || 0;
    const rightStart = normalizeDateInput(right.starts_at || right.paid_at)?.getTime() || 0;
    if (leftStart !== rightStart) {
      return leftStart - rightStart;
    }

    const leftPaid = normalizeDateInput(left.paid_at)?.getTime() || 0;
    const rightPaid = normalizeDateInput(right.paid_at)?.getTime() || 0;
    if (leftPaid !== rightPaid) {
      return leftPaid - rightPaid;
    }

    return String(left.id || "").localeCompare(String(right.id || ""));
  });
}

function sanitizePaymentRecord(record, slug) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const normalizedSlug = sanitizeSlug(slug || record.slug);
  const id = stringOrDefault(record.id) || generateId();
  const plan = stringOrDefault(record.plan, DEFAULT_SUBSCRIPTION_PLAN);
  const paidAt =
    normalizeDateInput(record.paid_at || record.starts_at) ||
    normalizeDateInput(record.created_at);
  const startsAt =
    normalizeDateInput(record.starts_at || record.paid_at) ||
    normalizeDateInput(record.created_at);
  if (!id || !startsAt) {
    return null;
  }

  const expiresAt = normalizeDateInput(record.expires_at) || getPlanExpiryDate(startsAt, plan);
  const nowIso = new Date().toISOString();

  return {
    id,
    slug: normalizedSlug,
    plan,
    amount: normalizeFloat(record.amount) ?? getDefaultPlanAmount(plan),
    currency: stringOrDefault(record.currency, DEFAULT_SUBSCRIPTION_CURRENCY),
    paid_at: (paidAt || startsAt).toISOString(),
    starts_at: startsAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    payment_method: stringOrDefault(record.payment_method),
    payment_reference: stringOrDefault(record.payment_reference),
    notes: stringOrDefault(record.notes),
    created_at: stringOrDefault(record.created_at, nowIso),
    updated_at: stringOrDefault(record.updated_at, nowIso),
  };
}

function upsertPaymentHistory(history, record) {
  return sanitizePaymentHistory(
    [...ensureArray(history).filter((item) => item.id !== record.id), record],
    record.slug
  );
}

function deriveSubscriptionFromPaymentHistory(history, fallbackSubscription = {}) {
  const payments = sanitizePaymentHistory(history);
  const latest = payments[payments.length - 1];
  if (!latest) {
    return stripSubscriptionForStorage(fallbackSubscription || {});
  }

  const fallback = hydrateStoredSubscription(fallbackSubscription || {});
  const expiresAt = normalizeDateInput(latest.expires_at);

  return stripSubscriptionForStorage({
    ...fallback,
    plan: stringOrDefault(latest.plan, fallback.plan || DEFAULT_SUBSCRIPTION_PLAN),
    amount:
      normalizeFloat(latest.amount) ??
      normalizeFloat(fallback.amount) ??
      getDefaultPlanAmount(latest.plan || fallback.plan),
    currency: stringOrDefault(
      latest.currency,
      fallback.currency || DEFAULT_SUBSCRIPTION_CURRENCY
    ),
    payment_method: stringOrDefault(latest.payment_method, fallback.payment_method || ""),
    payment_reference: stringOrDefault(latest.payment_reference),
    notes: stringOrDefault(latest.notes, fallback.notes || ""),
    paid_at: latest.paid_at,
    starts_at: latest.starts_at,
    expires_at: latest.expires_at,
    payment_status: expiresAt && expiresAt.getTime() > Date.now() ? "active" : "expired",
    last_updated_at: stringOrDefault(latest.updated_at, fallback.last_updated_at || ""),
  });
}

function migrateLegacyPayments() {
  const detailedFiles = fs.readdirSync(DETAILED_DIR).filter((file) => file.endsWith(".json"));

  for (const file of detailedFiles) {
    const slug = path.basename(file, ".json");
    const detailedPath = path.join(DETAILED_DIR, file);
    const detailed = readJson(detailedPath, null);
    if (!detailed || !Object.prototype.hasOwnProperty.call(detailed, "payment_history")) {
      continue;
    }

    const existingPayments = readStoredPaymentHistory(slug);
    if (!existingPayments.length) {
      savePaymentHistory(slug, detailed.payment_history);
    }

    const nextDetailed = { ...detailed };
    delete nextDetailed.payment_history;
    writeJson(detailedPath, nextDetailed);
  }
}

function loadNotes() {
  const notes = readJson(NOTES_FILE, []);
  return Array.isArray(notes) ? notes : [];
}

function saveNotes(notes) {
  writeJson(
    NOTES_FILE,
    ensureArray(notes).sort((left, right) => right.updated_at.localeCompare(left.updated_at))
  );
}

function loadExpenses() {
  const expenses = readJson(EXPENSES_FILE, []);
  return sortExpenses(
    ensureArray(expenses)
      .map((expense) => sanitizeExpenseRecord(expense))
      .filter(Boolean)
  );
}

function saveExpenses(expenses) {
  writeJson(EXPENSES_FILE, sortExpenses(expenses), 2);
}

function sortExpenses(expenses) {
  return ensureArray(expenses).sort((left, right) => {
    const rightDate = normalizeDateInput(right?.incurred_at || right?.updated_at)?.getTime() || 0;
    const leftDate = normalizeDateInput(left?.incurred_at || left?.updated_at)?.getTime() || 0;
    if (rightDate !== leftDate) {
      return rightDate - leftDate;
    }
    return String(right?.id || "").localeCompare(String(left?.id || ""));
  });
}

function sanitizeExpenseRecord(record) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const amount = normalizeFloat(record.amount);
  const incurredAt = normalizeDateInput(record.incurred_at);
  if (!Number.isFinite(amount) || amount <= 0 || !incurredAt) {
    return null;
  }

  const nowIso = new Date().toISOString();

  return {
    id: stringOrDefault(record.id) || generateId(),
    title: stringOrDefault(record.title),
    category: stringOrDefault(record.category, "Operations"),
    amount: roundAmount(amount),
    currency: stringOrDefault(record.currency, DEFAULT_SUBSCRIPTION_CURRENCY),
    incurred_at: incurredAt.toISOString(),
    notes: stringOrDefault(record.notes),
    created_at: stringOrDefault(record.created_at, nowIso),
    updated_at: stringOrDefault(record.updated_at, nowIso),
  };
}

function normalizeReportPeriod(value) {
  const normalized = String(value || "monthly").trim().toLowerCase();
  return ["monthly", "yearly"].includes(normalized) ? normalized : "monthly";
}

function normalizeReportYear(value) {
  const parsed = normalizeInteger(value);
  if (!parsed) {
    return null;
  }
  return parsed >= 2000 && parsed <= 2100 ? parsed : null;
}

function invalidateRevenueCache() {
  revenuePaymentsCache = null;
}

function handleAnalyticsReportRequest(req, res) {
  try {
    const period = normalizeReportPeriod(req.query.period);
    const year = normalizeReportYear(req.query.year);
    res.json({
      success: true,
      data: buildRevenueReport(period, { year }),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

function buildRevenueReport(period, options = {}) {
  const { year = null } = options;
  const payments = collectRevenuePayments();
  const expenses = loadExpenses();
  const availableYears = collectAvailableReportYears(payments, expenses);
  const selectedYear = resolveSelectedReportYear(period, year, availableYears);
  const grouped = new Map();
  const seedBuckets = buildEmptyReportBuckets(period, selectedYear);

  for (const bucket of seedBuckets) {
    grouped.set(bucket.key, createReportAccumulator(bucket));
  }

  for (const payment of payments) {
    const bucket = getRevenueBucket(payment.paid_at, period);
    if (!bucket || (selectedYear && bucket.year !== selectedYear && period !== "yearly")) {
      continue;
    }

    const existing = grouped.get(bucket.key) || createReportAccumulator(bucket);
    addPaymentToAccumulator(existing, payment);
    grouped.set(bucket.key, existing);
  }

  for (const expense of expenses) {
    const bucket = getRevenueBucket(expense.incurred_at, period);
    if (!bucket || (selectedYear && bucket.year !== selectedYear && period !== "yearly")) {
      continue;
    }

    const existing = grouped.get(bucket.key) || createReportAccumulator(bucket);
    addExpenseToAccumulator(existing, expense);
    grouped.set(bucket.key, existing);
  }

  const rows = [...grouped.values()]
    .sort((left, right) => right.start_at.localeCompare(left.start_at))
    .map((row) => finalizeReportAccumulator(row));

  return {
    period,
    selected_year: selectedYear,
    available_years: availableYears,
    generated_at: new Date().toISOString(),
    totals: {
      month: summarizeRevenueWindow(payments, expenses, "monthly"),
      year: summarizeRevenueWindow(payments, expenses, "yearly"),
      lifetime: summarizeRevenueWindow(payments, expenses, "lifetime"),
    },
    rows,
  };
}

function collectAvailableReportYears(payments, expenses) {
  const years = [
    ...ensureArray(payments).map((payment) => normalizeDateInput(payment.paid_at)?.getUTCFullYear() || null),
    ...ensureArray(expenses).map((expense) => normalizeDateInput(expense.incurred_at)?.getUTCFullYear() || null),
  ]
    .filter(Boolean)
    .sort((left, right) => right - left);

  const uniqueYears = [...new Set(years)];
  return uniqueYears.length ? uniqueYears : [new Date().getUTCFullYear()];
}

function resolveSelectedReportYear(period, requestedYear, availableYears) {
  const yearList = ensureArray(availableYears);
  if (!yearList.length) {
    return requestedYear || new Date().getUTCFullYear();
  }
  if (requestedYear && yearList.includes(requestedYear)) {
    return requestedYear;
  }
  return yearList[0];
}

function buildEmptyReportBuckets(period, year) {
  if (!year || period === "yearly") {
    return [];
  }

  if (period === "monthly") {
    return Array.from({ length: 12 }, (_, monthIndex) => {
      const start = new Date(Date.UTC(year, monthIndex, 1));
      const end = new Date(Date.UTC(year, monthIndex + 1, 0));
      return {
        key: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
        year,
        label: start.toLocaleDateString("en-US", { year: "numeric", month: "long", timeZone: "UTC" }),
        start_at: start.toISOString(),
        end_at: end.toISOString(),
      };
    });
  }

  return [];
}

function collectRevenuePayments() {
  if (revenuePaymentsCache) {
    return revenuePaymentsCache;
  }

  const payments = [];
  const businessSlugs = new Set([
    ...fs
      .readdirSync(DETAILED_DIR)
      .filter((file) => file.endsWith(".json"))
      .map((file) => path.basename(file, ".json")),
    ...fs
      .readdirSync(PAYMENTS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  ]);

  for (const slug of businessSlugs) {
    const business =
      readJson(filePathFor(DETAILED_DIR, slug), null) ||
      basicCardsBySlug.get(slug) ||
      null;
    const paymentHistory = loadPaymentHistory(slug, business?.payment_history);

    for (const entry of paymentHistory) {
      const amount = normalizeFloat(entry.amount);
      const paidAt = normalizeDateInput(entry.paid_at);
      if (!paidAt || !Number.isFinite(amount) || amount <= 0) {
        continue;
      }

      payments.push({
        slug: stringOrDefault(business?.slug, slug),
        name: stringOrDefault(business?.name),
        amount,
        currency: stringOrDefault(entry.currency, DEFAULT_SUBSCRIPTION_CURRENCY),
        paid_at: paidAt.toISOString(),
      });
    }
  }

  revenuePaymentsCache = payments;
  return revenuePaymentsCache;
}

function createReportAccumulator(bucket = {}) {
  return {
    key: stringOrDefault(bucket.key),
    year: normalizeInteger(bucket.year),
    label: stringOrDefault(bucket.label),
    start_at: stringOrDefault(bucket.start_at),
    end_at: stringOrDefault(bucket.end_at),
    revenue_total: 0,
    expense_total: 0,
    payment_count: 0,
    expense_count: 0,
    businesses: new Set(),
    revenue_breakdown: {},
    expense_breakdown: {},
    expense_categories: {},
  };
}

function addPaymentToAccumulator(accumulator, payment) {
  accumulator.revenue_total += payment.amount;
  accumulator.payment_count += 1;
  accumulator.businesses.add(payment.slug);
  accumulator.revenue_breakdown[payment.currency] =
    (accumulator.revenue_breakdown[payment.currency] || 0) + payment.amount;
}

function addExpenseToAccumulator(accumulator, expense) {
  accumulator.expense_total += expense.amount;
  accumulator.expense_count += 1;
  accumulator.expense_breakdown[expense.currency] =
    (accumulator.expense_breakdown[expense.currency] || 0) + expense.amount;

  const category = stringOrDefault(expense.category, "Operations");
  const existingCategory =
    accumulator.expense_categories[category] || {
      category,
      amount: 0,
      entries: 0,
    };
  existingCategory.amount += expense.amount;
  existingCategory.entries += 1;
  accumulator.expense_categories[category] = existingCategory;
}

function finalizeReportAccumulator(accumulator) {
  const revenueBreakdown = normalizeCurrencyBreakdown(accumulator.revenue_breakdown);
  const expenseBreakdown = normalizeCurrencyBreakdown(accumulator.expense_breakdown);
  const expenseCategories = finalizeExpenseCategories(
    accumulator.expense_categories,
    accumulator.expense_total
  );

  return {
    key: accumulator.key,
    year: normalizeInteger(accumulator.year),
    label: accumulator.label,
    start_at: accumulator.start_at,
    end_at: accumulator.end_at,
    revenue_total: roundAmount(accumulator.revenue_total),
    expense_total: roundAmount(accumulator.expense_total),
    net_total: roundAmount(accumulator.revenue_total - accumulator.expense_total),
    payment_count: accumulator.payment_count,
    expense_count: accumulator.expense_count,
    business_count: accumulator.businesses.size,
    revenue_breakdown: revenueBreakdown,
    expense_breakdown: expenseBreakdown,
    net_breakdown: buildNetBreakdown(revenueBreakdown, expenseBreakdown),
    expense_categories: expenseCategories,
    top_expense_category: expenseCategories[0] || null,
    average_payment_value: accumulator.payment_count
      ? roundAmount(accumulator.revenue_total / accumulator.payment_count)
      : 0,
    margin_percent: accumulator.revenue_total
      ? roundAmount(((accumulator.revenue_total - accumulator.expense_total) / accumulator.revenue_total) * 100)
      : null,
  };
}

function normalizeCurrencyBreakdown(breakdown) {
  return Object.fromEntries(
    Object.entries(breakdown || {})
      .filter(([, amount]) => Number.isFinite(Number(amount)))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([currency, amount]) => [currency, roundAmount(amount)])
  );
}

function buildNetBreakdown(revenueBreakdown, expenseBreakdown) {
  const currencies = new Set([
    ...Object.keys(revenueBreakdown || {}),
    ...Object.keys(expenseBreakdown || {}),
  ]);
  const netBreakdown = {};

  for (const currency of currencies) {
    const netAmount =
      roundAmount((revenueBreakdown?.[currency] || 0) - (expenseBreakdown?.[currency] || 0));
    if (netAmount !== 0) {
      netBreakdown[currency] = netAmount;
    }
  }

  return netBreakdown;
}

function finalizeExpenseCategories(categories, totalAmount) {
  return Object.values(categories || {})
    .sort((left, right) => {
      if (right.amount !== left.amount) {
        return right.amount - left.amount;
      }
      return left.category.localeCompare(right.category);
    })
    .map((item) => ({
      category: item.category,
      amount: roundAmount(item.amount),
      entries: item.entries,
      share_percent: totalAmount ? roundAmount((item.amount / totalAmount) * 100) : 0,
    }));
}

function buildReportHighlights(rows) {
  return {
    highest_revenue_period: pickHighlightedRow(rows, "revenue_total", "revenue_breakdown"),
    highest_expense_period: pickHighlightedRow(rows, "expense_total", "expense_breakdown"),
    strongest_net_period: pickHighlightedRow(rows, "net_total", "net_breakdown"),
  };
}

function pickHighlightedRow(rows, metricKey, breakdownKey) {
  const finiteRows = ensureArray(rows).filter(
    (row) => Number.isFinite(Number(row?.[metricKey]))
  );
  if (!finiteRows.length) {
    return null;
  }

  const candidates = finiteRows.filter((row) => Number(row[metricKey]) > 0);
  const sourceRows = candidates.length ? candidates : finiteRows;

  const best = sourceRows.reduce((currentBest, row) =>
    row[metricKey] > currentBest[metricKey] ? row : currentBest
  );

  return {
    label: best.label,
    amount: best[metricKey],
    breakdown: best[breakdownKey] || {},
  };
}

function summarizeRevenueWindow(payments, expenses, period) {
  const now = new Date();
  const summary = createReportAccumulator();
  const currentBucket = period === "lifetime" ? null : getRevenueBucket(now.toISOString(), period);

  for (const payment of payments) {
    const paidAt = normalizeDateInput(payment.paid_at);
    if (!paidAt) {
      continue;
    }

    if (currentBucket) {
      const paymentBucket = getRevenueBucket(payment.paid_at, period);
      if (!paymentBucket || currentBucket.key !== paymentBucket.key) {
        continue;
      }
    }

    addPaymentToAccumulator(summary, payment);
  }

  for (const expense of expenses) {
    const incurredAt = normalizeDateInput(expense.incurred_at);
    if (!incurredAt) {
      continue;
    }

    if (currentBucket) {
      const expenseBucket = getRevenueBucket(expense.incurred_at, period);
      if (!expenseBucket || currentBucket.key !== expenseBucket.key) {
        continue;
      }
    }

    addExpenseToAccumulator(summary, expense);
  }

  return finalizeReportAccumulator(summary);
}

function getRevenueBucket(value, period) {
  const date = normalizeDateInput(value);
  if (!date) {
    return null;
  }

  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth();
  const monthNumber = String(monthIndex + 1).padStart(2, "0");

  if (period === "monthly") {
    const start = new Date(Date.UTC(year, monthIndex, 1));
    const end = new Date(Date.UTC(year, monthIndex + 1, 0));
    return {
      key: `${year}-${monthNumber}`,
      year,
      label: start.toLocaleDateString("en-US", { year: "numeric", month: "long", timeZone: "UTC" }),
      start_at: start.toISOString(),
      end_at: end.toISOString(),
    };
  }

  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));
  return {
    key: String(year),
    year,
    label: String(year),
    start_at: start.toISOString(),
    end_at: end.toISOString(),
  };
}

function executeSourceWorkflow(steps) {
  return executeRepoWorkflow({
    repoRoot: getSourceRepoRoot(),
    remoteName: SOURCE_REMOTE_NAME,
    defaultBranch: SOURCE_DEFAULT_BRANCH,
    label: "source-control app",
    steps,
  });
}

function buildSourceSnapshot(lastCommand = null) {
  return buildRepoSnapshot({
    repoRoot: getSourceRepoRoot(),
    remoteName: SOURCE_REMOTE_NAME,
    defaultBranch: SOURCE_DEFAULT_BRANCH,
    label: "source-control app",
    lastCommand,
  });
}

function executeDbWorkflow(steps) {
  return executeRepoWorkflow({
    repoRoot: getDbRepoRoot(),
    remoteName: DB_REMOTE_NAME,
    defaultBranch: DB_DEFAULT_BRANCH,
    label: "DB manager",
    steps,
    extra: buildDbSnapshotExtras(),
  });
}

function buildDbSnapshot(lastCommand = null) {
  return buildRepoSnapshot({
    repoRoot: getDbRepoRoot(),
    remoteName: DB_REMOTE_NAME,
    defaultBranch: DB_DEFAULT_BRANCH,
    label: "DB manager",
    lastCommand,
    extra: buildDbSnapshotExtras(),
  });
}

function buildDbSnapshotExtras() {
  const repoRoot = getDbRepoRoot();
  return {
    source_basic_dir: BASIC_DIR,
    source_detailed_dir: DETAILED_DIR,
    target_basic_dir: path.join(repoRoot, DB_BASIC_TARGET_PATH),
    target_detailed_dir: path.join(repoRoot, DB_DETAILED_TARGET_PATH),
  };
}

function executeRepoWorkflow({ repoRoot, remoteName, defaultBranch, label, steps, extra = {} }) {
  const logs = [];
  let lastSummary = "Repository control is ready.";

  for (const step of ensureArray(steps)) {
    if (typeof step.run === "function") {
      const result = step.run();
      if (result?.summary) {
        lastSummary = result.summary;
      }
      if (result?.log) {
        logs.push(String(result.log).trim());
      }
      continue;
    }

    const result = runGitCommandInRepo(repoRoot, step.args);
    const commandLabel = `$ git ${ensureArray(step.args).join(" ")}`;

    if (!result.ok) {
      if (step.allowNoop && isGitNoopResult(result.output)) {
        lastSummary = step.noopSummary || step.summary || "No changes were required.";
        logs.push(`${commandLabel}\n${result.output || lastSummary}`);
        continue;
      }

      throw new Error(result.output || `${commandLabel} failed.`);
    }

    lastSummary = step.summary || "Git command completed.";
    logs.push(`${commandLabel}\n${result.output || lastSummary}`);
  }

  return buildRepoSnapshot({
    repoRoot,
    remoteName,
    defaultBranch,
    label,
    lastCommand: {
      output: logs.join("\n\n").trim(),
      summary: lastSummary,
    },
    extra,
  });
}

function buildRepoSnapshot({ repoRoot, remoteName, defaultBranch, label, lastCommand = null, extra = {} }) {
  const branch = getBranchNameForRepo(repoRoot, defaultBranch, label);
  const statusResult = runGitCommandInRepo(repoRoot, ["status", "--porcelain=v1", "--branch"]);
  if (!statusResult.ok) {
    throw new Error(statusResult.output || "Unable to read git status.");
  }

  const parsedStatus = parseGitStatusOutput(statusResult.output, branch);
  const remoteResult = runGitCommandInRepo(repoRoot, ["remote", "get-url", remoteName], {
    allowFailure: true,
  });
  const lastOutput = stringOrDefault(lastCommand?.output, statusResult.output);
  const lastSummary = stringOrDefault(lastCommand?.summary, parsedStatus.status_summary);

  return {
    repo_root: repoRoot,
    branch,
    remote_name: remoteName,
    remote_url: remoteResult.ok ? remoteResult.stdout.trim() : "",
    ahead: parsedStatus.ahead,
    behind: parsedStatus.behind,
    is_clean: parsedStatus.changed_count === 0,
    changed_count: parsedStatus.changed_count,
    staged_count: parsedStatus.staged_count,
    changed_files: parsedStatus.changed_files,
    status_text: statusResult.output,
    status_summary: parsedStatus.status_summary,
    last_output: lastOutput,
    last_summary: lastSummary,
    ...extra,
  };
}

function parseGitStatusOutput(output, branch) {
  const lines = String(output || "")
    .split(/\r?\n/)
    .filter(Boolean);
  const header = lines.find((line) => line.startsWith("## ")) || "";
  const changedLines = lines.filter((line) => !line.startsWith("## "));
  const changedFiles = changedLines.map((line) => parseGitStatusLine(line)).filter(Boolean);
  const stagedCount = changedFiles.filter((file) => file.staged).length;
  const changedCount = changedFiles.length;
  const { ahead, behind } = parseGitAheadBehind(header);

  return {
    ahead,
    behind,
    changed_count: changedCount,
    staged_count: stagedCount,
    changed_files: changedFiles,
    status_summary: changedCount
      ? `${changedCount} changed file${changedCount === 1 ? "" : "s"} on ${branch}.`
      : `Working tree clean on ${branch}.`,
  };
}

function parseGitAheadBehind(headerLine) {
  const match = String(headerLine || "").match(/\[(.*?)\]/);
  if (!match) {
    return { ahead: 0, behind: 0 };
  }

  const parts = match[1].split(",");
  let ahead = 0;
  let behind = 0;

  for (const part of parts) {
    const normalized = part.trim();
    if (normalized.startsWith("ahead")) {
      ahead = normalizeInteger(normalized.replace(/[^\d-]/g, "")) || 0;
    }
    if (normalized.startsWith("behind")) {
      behind = normalizeInteger(normalized.replace(/[^\d-]/g, "")) || 0;
    }
  }

  return { ahead, behind };
}

function parseGitStatusLine(line) {
  const text = String(line || "");
  if (text.length < 3) {
    return null;
  }

  const stagedCode = text[0];
  const unstagedCode = text[1];
  const pathText = text.slice(3).trim();
  const finalPath = pathText.includes(" -> ") ? pathText.split(" -> ").pop() : pathText;
  const staged = stagedCode !== " " && stagedCode !== "?";
  const unstaged = unstagedCode !== " " && unstagedCode !== "?";
  const untracked = stagedCode === "?" || unstagedCode === "?";
  const deleted = stagedCode === "D" || unstagedCode === "D";
  const renamed = stagedCode === "R" || unstagedCode === "R";

  return {
    path: finalPath,
    status: `${stagedCode}${unstagedCode}`.trim() || "??",
    staged,
    unstaged,
    untracked,
    summary: untracked
      ? "Untracked file"
      : renamed
        ? "Renamed file"
        : deleted
          ? "Deleted file"
          : staged && unstaged
            ? "Staged and modified"
            : staged
              ? "Staged change"
              : "Modified file",
  };
}

function runGitCommand(args, options = {}) {
  return runGitCommandInRepo(getSourceRepoRoot(), args, options);
}

function runGitCommandInRepo(repoRoot, args, options = {}) {
  const result = spawnSync("git", ensureArray(args), {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
    },
  });

  const stdout = String(result.stdout || "").trim();
  const stderr = String(result.stderr || "").trim();
  const output = [stdout, stderr].filter(Boolean).join("\n").trim();
  const ok = !result.error && result.status === 0;

  if (!ok && !options.allowFailure) {
    return {
      ok: false,
      stdout,
      stderr,
      output: output || result.error?.message || "Git command failed.",
    };
  }

  return {
    ok,
    stdout,
    stderr,
    output,
  };
}

function getSourceRepoRoot() {
  return getRepoRootFromConfig(SOURCE_REPO_CONFIG_PATH, "source-control app");
}

function getSourceBranchName() {
  return getBranchNameForRepo(getSourceRepoRoot(), SOURCE_DEFAULT_BRANCH, "source-control app");
}

function getDbRepoRoot() {
  return getRepoRootFromConfig(DB_REPO_CONFIG_PATH, "DB manager");
}

function getDbBranchName() {
  return getBranchNameForRepo(getDbRepoRoot(), DB_DEFAULT_BRANCH, "DB manager");
}

function getRepoRootFromConfig(repoConfigPath, label) {
  if (!repoConfigPath) {
    throw new Error(`Configure the ${label} repo path in .env before using this app.`);
  }
  if (!fs.existsSync(repoConfigPath)) {
    throw new Error(`Configured ${label} repo path does not exist: ${repoConfigPath}`);
  }

  const probe = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: repoConfigPath,
    encoding: "utf8",
    timeout: 120000,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
    },
  });

  if (probe.error || probe.status !== 0) {
    throw new Error(`No git repository was found at ${repoConfigPath}`);
  }

  return String(probe.stdout || "").trim() || repoConfigPath;
}

function getBranchNameForRepo(repoRoot, defaultBranch, label) {
  const branchResult = runGitCommandInRepo(repoRoot, ["branch", "--show-current"]);
  const branch = stringOrDefault(branchResult.stdout, defaultBranch);
  if (!branch) {
    throw new Error(`A checked-out branch is required before using the ${label}.`);
  }
  return branch;
}

function mirrorBusinessDataToDbRepo() {
  const repoRoot = getDbRepoRoot();
  const basicTargetDir = path.join(repoRoot, DB_BASIC_TARGET_PATH);
  const detailedTargetDir = path.join(repoRoot, DB_DETAILED_TARGET_PATH);
  const basicResult = mirrorJsonDirectory(BASIC_DIR, basicTargetDir);
  const detailedResult = mirrorJsonDirectory(DETAILED_DIR, detailedTargetDir);
  const mirroredFileCount = basicResult.copied + detailedResult.copied;

  return {
    summary: `Mirrored ${mirroredFileCount} JSON files into the DB repository.`,
    log: [
      `Mirrored basic data: ${basicResult.copied} copied, ${basicResult.removed} removed`,
      `Source: ${BASIC_DIR}`,
      `Target: ${basicTargetDir}`,
      "",
      `Mirrored detailed data: ${detailedResult.copied} copied, ${detailedResult.removed} removed`,
      `Source: ${DETAILED_DIR}`,
      `Target: ${detailedTargetDir}`,
    ].join("\n"),
  };
}

function mirrorJsonDirectory(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const sourceFiles = fs
    .readdirSync(sourceDir)
    .filter((file) => file.toLowerCase().endsWith(".json"));
  const sourceFileSet = new Set(sourceFiles);

  let removed = 0;
  for (const targetFile of fs.readdirSync(targetDir)) {
    if (!targetFile.toLowerCase().endsWith(".json")) {
      continue;
    }
    if (!sourceFileSet.has(targetFile)) {
      fs.unlinkSync(path.join(targetDir, targetFile));
      removed += 1;
    }
  }

  for (const fileName of sourceFiles) {
    fs.copyFileSync(path.join(sourceDir, fileName), path.join(targetDir, fileName));
  }

  return {
    copied: sourceFiles.length,
    removed,
  };
}

function isGitNoopResult(output) {
  return /nothing to commit|nothing added to commit|working tree clean/i.test(String(output || ""));
}

function roundAmount(value) {
  return Number(Number(value || 0).toFixed(2));
}

function loadPlanCatalog() {
  const rawCatalog = readJson(PLAN_CATALOG_FILE, {});
  const baseMonthlyRate = normalizeFloat(rawCatalog?.base_monthly_rate) ?? 100;
  const currency = stringOrDefault(rawCatalog?.currency, "NPR");
  const fallbackPlans = [
    {
      id: "monthly",
      label: "monthly",
      months: 1,
      discount_percent: 0,
      description: "1 month at the standard monthly rate.",
    },
    {
      id: "yearly",
      label: "Yearly",
      months: 12,
      discount_percent: 10,
      description: "12 months with a 10% discount.",
    },
    {
      id: "six-months",
      label: "6 Months",
      months: 6,
      discount_percent: 5,
      description: "6 months with a 5% discount.",
    },
  ];
  const plans = ensureArray(rawCatalog?.plans)
    .map((record, index) => sanitizePlanDefinition(record, index, baseMonthlyRate, currency))
    .filter(Boolean);
  const normalizedPlans = plans.length
    ? plans
    : fallbackPlans.map((record, index) =>
        sanitizePlanDefinition(record, index, baseMonthlyRate, currency)
      );

  return {
    currency,
    base_monthly_rate: baseMonthlyRate,
    default_label: stringOrDefault(rawCatalog?.default_label, normalizedPlans[0]?.label || "monthly"),
    plans: normalizedPlans,
  };
}

function sanitizePlanDefinition(record, index, baseMonthlyRate, currency) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const label = stringOrDefault(record.label, `Plan ${index + 1}`);
  const months = Math.max(1, normalizeInteger(record.months) || 12);
  const discountPercent = Math.min(100, Math.max(0, normalizeFloat(record.discount_percent) ?? 0));

  return {
    id: sanitizeSlug(record.id || label) || `plan-${index + 1}`,
    label,
    months,
    discount_percent: discountPercent,
    description: stringOrDefault(record.description),
    currency,
    amount: calculatePlanAmount(baseMonthlyRate, months, discountPercent),
  };
}

function calculatePlanAmount(baseMonthlyRate, months, discountPercent) {
  const grossAmount = baseMonthlyRate * months;
  const discountedAmount = grossAmount * (1 - discountPercent / 100);
  return Number(discountedAmount.toFixed(2));
}

function getPlanDefinition(value) {
  const normalized = sanitizeSlug(value);
  if (!normalized) {
    return PLAN_CATALOG.plans[0] || null;
  }

  return (
    PLAN_CATALOG.plans.find(
      (plan) =>
        plan.id === normalized ||
        sanitizeSlug(plan.label) === normalized ||
        normalized.includes(plan.id) ||
        normalized.includes(sanitizeSlug(plan.label))
    ) ||
    PLAN_CATALOG.plans[0] ||
    null
  );
}

function getDefaultPlanAmount(planValue) {
  return getPlanDefinition(planValue)?.amount ?? PLAN_CATALOG.plans[0]?.amount ?? 0;
}

function getPlanDurationMonths(planValue) {
  return getPlanDefinition(planValue)?.months ?? PLAN_CATALOG.plans[0]?.months ?? 12;
}

function getPlanExpiryDate(startDate, planValue) {
  return addMonthsUtc(startDate, getPlanDurationMonths(planValue));
}

function hydrateStoredSubscription(input) {
  const raw = input || {};
  const plan = stringOrDefault(raw.plan, DEFAULT_SUBSCRIPTION_PLAN);
  const startsAt = normalizeDateInput(raw.starts_at || raw.paid_at);
  const expiresAt = normalizeDateInput(
    raw.expires_at || (startsAt ? getPlanExpiryDate(startsAt, plan) : null)
  );
  const now = new Date();
  let paymentStatus = String(raw.payment_status || "").toLowerCase();

  if (expiresAt) {
    paymentStatus = expiresAt.getTime() > now.getTime() ? "active" : "expired";
  } else if (paymentStatus !== "pending") {
    paymentStatus = "pending";
  }

  const timeRemainingMs = expiresAt ? expiresAt.getTime() - now.getTime() : null;
  const daysRemaining = timeRemainingMs == null ? null : Math.ceil(timeRemainingMs / 86400000);

  return {
    plan,
    amount: normalizeFloat(raw.amount) ?? getDefaultPlanAmount(plan),
    currency: stringOrDefault(raw.currency, DEFAULT_SUBSCRIPTION_CURRENCY),
    payment_method: stringOrDefault(raw.payment_method),
    payment_reference: stringOrDefault(raw.payment_reference),
    notes: stringOrDefault(raw.notes),
    auto_renew: Boolean(raw.auto_renew),
    paid_at: normalizeDateInput(raw.paid_at)?.toISOString() || "",
    starts_at: startsAt ? startsAt.toISOString() : "",
    expires_at: expiresAt ? expiresAt.toISOString() : "",
    payment_status: paymentStatus || "pending",
    days_remaining: daysRemaining,
    is_active: paymentStatus === "active",
    is_expired: paymentStatus === "expired",
    last_updated_at: stringOrDefault(raw.last_updated_at),
  };
}

function stripSubscriptionForStorage(input) {
  const raw = input || {};
  const plan = stringOrDefault(raw.plan, DEFAULT_SUBSCRIPTION_PLAN);
  return {
    plan,
    amount: normalizeFloat(raw.amount) ?? getDefaultPlanAmount(plan),
    currency: stringOrDefault(raw.currency, DEFAULT_SUBSCRIPTION_CURRENCY),
    payment_method: stringOrDefault(raw.payment_method),
    payment_reference: stringOrDefault(raw.payment_reference),
    notes: stringOrDefault(raw.notes),
    auto_renew: Boolean(raw.auto_renew),
    paid_at: normalizeDateInput(raw.paid_at)?.toISOString() || "",
    starts_at: normalizeDateInput(raw.starts_at)?.toISOString() || "",
    expires_at: normalizeDateInput(raw.expires_at)?.toISOString() || "",
    payment_status: stringOrDefault(raw.payment_status, "pending").toLowerCase(),
    last_updated_at: stringOrDefault(raw.last_updated_at),
  };
}

function buildSubscriptionFromSave(input, existingSubscription, nowIso) {
  const source = input || {};
  const previous = hydrateStoredSubscription(existingSubscription || {});
  const previousPlan = stringOrDefault(previous.plan, DEFAULT_SUBSCRIPTION_PLAN);
  const plan = stringOrDefault(source.plan, previousPlan || DEFAULT_SUBSCRIPTION_PLAN);
  const amount =
    normalizeFloat(source.amount) ??
    (plan !== previousPlan
      ? getDefaultPlanAmount(plan)
      : previous.amount ?? getDefaultPlanAmount(plan));
  const currency = stringOrDefault(
    source.currency,
    previous.currency || DEFAULT_SUBSCRIPTION_CURRENCY
  );
  const paymentMethod = stringOrDefault(source.payment_method, previous.payment_method || "");
  const paymentReference = stringOrDefault(
    source.payment_reference,
    previous.payment_reference || ""
  );
  const notes = stringOrDefault(source.notes, previous.notes || "");
  const autoRenew = Boolean(source.auto_renew ?? previous.auto_renew);
  const requestedStatus = stringOrDefault(
    source.payment_status,
    previous.payment_status || "pending"
  ).toLowerCase();
  const paidAtValue =
    source.paid_at !== undefined
      ? source.paid_at
      : requestedStatus === "pending"
        ? ""
        : previous.paid_at;
  const startsAtValue =
    source.starts_at !== undefined
      ? source.starts_at
      : requestedStatus === "pending"
        ? ""
        : previous.starts_at || paidAtValue;
  const paidAt = normalizeDateInput(paidAtValue);
  const startsAt = normalizeDateInput(
    startsAtValue || paidAt || (requestedStatus === "pending" ? null : nowIso)
  );
  let expiresAt = normalizeDateInput(source.expires_at !== undefined ? source.expires_at : null);

  if ((requestedStatus === "paid" || requestedStatus === "active" || requestedStatus === "expired") && startsAt) {
    expiresAt = expiresAt || getPlanExpiryDate(startsAt, plan);
  }

  if (requestedStatus === "pending") {
    expiresAt = null;
  }

  const effectiveStatus = expiresAt
    ? expiresAt.getTime() > Date.now()
      ? "active"
      : "expired"
    : "pending";
  const effectivePaidAt =
    effectiveStatus === "pending" ? null : paidAt || startsAt || normalizeDateInput(nowIso);

  return stripSubscriptionForStorage({
    plan,
    amount,
    currency,
    payment_method: paymentMethod,
    payment_reference: paymentReference,
    notes,
    auto_renew: autoRenew,
    paid_at: effectivePaidAt ? effectivePaidAt.toISOString() : "",
    starts_at: startsAt && effectiveStatus !== "pending" ? startsAt.toISOString() : "",
    expires_at: expiresAt ? expiresAt.toISOString() : "",
    payment_status: effectiveStatus,
    last_updated_at: nowIso,
  });
}

function buildPaymentHistory(existingHistory, nextSubscription, previousSubscription, source) {
  const history = ensureArray(existingHistory).slice();
  const shouldRecord =
    Boolean(source?.payment_status && String(source.payment_status).toLowerCase() !== "pending") ||
    Boolean(source?.paid_at) ||
    Boolean(source?.payment_reference) ||
    Boolean(source?.amount);

  if (!shouldRecord || nextSubscription.payment_status === "pending") {
    return history;
  }

  const previous = hydrateStoredSubscription(previousSubscription || {});
  const signature = [
    nextSubscription.plan,
    nextSubscription.paid_at,
    nextSubscription.starts_at,
    nextSubscription.expires_at,
    nextSubscription.amount,
    nextSubscription.payment_reference,
  ].join("|");
  const previousSignature = [
    previous.plan,
    previous.paid_at,
    previous.starts_at,
    previous.expires_at,
    previous.amount,
    previous.payment_reference,
  ].join("|");
  const last = history[history.length - 1];
  const lastSignature = last
    ? [
        last.plan,
        last.paid_at,
        last.starts_at,
        last.expires_at,
        last.amount,
        last.payment_reference,
      ].join("|")
    : "";

  if (signature === previousSignature || signature === lastSignature) {
    return history;
  }

  history.push({
    id: generateId(),
    plan: nextSubscription.plan,
    amount: nextSubscription.amount,
    currency: nextSubscription.currency,
    paid_at: nextSubscription.paid_at,
    starts_at: nextSubscription.starts_at,
    expires_at: nextSubscription.expires_at,
    payment_method: nextSubscription.payment_method,
    payment_reference: nextSubscription.payment_reference,
    notes: nextSubscription.notes,
  });

  return history;
}

function getRenewalStart(existingExpiry, paymentDate) {
  const expiry = normalizeDateInput(existingExpiry);
  if (expiry && expiry.getTime() > paymentDate.getTime()) {
    return expiry;
  }
  return paymentDate;
}

function addMonthsUtc(date, monthCount) {
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
  const targetDay = Math.min(day, lastDayOfTargetMonth.getUTCDate());
  return new Date(
    Date.UTC(
      lastDayOfTargetMonth.getUTCFullYear(),
      lastDayOfTargetMonth.getUTCMonth(),
      targetDay,
      hours,
      minutes,
      seconds,
      milliseconds
    )
  );
}

function filePathFor(dir, slug) {
  return path.join(dir, `${slug}.json`);
}

function readJson(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value, spacing = 2) {
  const output = spacing == null ? JSON.stringify(value) : JSON.stringify(value, null, spacing);
  fs.writeFileSync(filePath, output);
}

function removeIfExists(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function sanitizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const entries = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    entries[key] = value;
  }

  return entries;
}

function normalizeBoolean(value, fallback = false) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  return !["0", "false", "no", "off"].includes(normalized);
}

function normalizeRoutePath(value, fallback = "/user") {
  const normalized = String(value || fallback || "/user")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/");
  const withLeadingSlash = normalized.startsWith("/") ? normalized : `/${normalized}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, "");
  return withoutTrailingSlash || "/user";
}

function normalizeRepoSubpath(value, fallback = "") {
  const raw = String(value || fallback || "").trim().replace(/\\/g, "/");
  const normalized = raw.replace(/^\.?\//, "").replace(/\/{2,}/g, "/");
  const segments = normalized
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.some((segment) => segment === "..")) {
    throw new Error(`Invalid repo subpath "${raw}". Use a path inside the target repository.`);
  }

  return segments.join("/") || String(fallback || "").trim();
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanStringArray(value) {
  return ensureArray(value)
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function normalizeProvince(value) {
  const normalized = String(value || "").trim();
  return PROVINCE_NAMES[normalized] ? normalized : "";
}

function normalizeInteger(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeFloat(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeDateInput(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function stringOrDefault(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

migrateLegacyPayments();

app.listen(PORT, HOST, () => {
  const displayHost = HOST === "0.0.0.0" ? "localhost" : HOST;
  console.log(`EduData XP admin running at http://${displayHost}:${PORT}`);
  console.log(`Basic card index: ${BASIC_INDEX_FILE}`);
  console.log(`Detailed data: ${DETAILED_DIR}`);
  console.log(`Expenses file: ${EXPENSES_FILE}`);
  if (SERVE_USER_BUILD && fs.existsSync(USER_DIST_DIR)) {
    console.log(`User build route: http://${displayHost}:${PORT}${USER_STATIC_ROUTE}`);
  }
});
