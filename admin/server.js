const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const { spawnSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const PDFDocument = require("pdfkit");
const LOCATION_CATALOG = require("./config/location-catalog");
const { createGeneratorStudio } = require("./lib/generator-studio");
const { registerBusinessRoutes } = require("./server/routes/business-routes");
const { registerReportRoutes } = require("./server/routes/reports-routes");
const { registerToolRoutes } = require("./server/routes/tools-routes");

const ENV = loadEnvFile(path.join(__dirname, ".env"));
const app = express();
const PORT = normalizeInteger(ENV.ADMIN_PORT) ?? 3000;
const HOST = stringOrDefault(ENV.ADMIN_HOST, "0.0.0.0");
const SERVE_USER_BUILD = normalizeBoolean(ENV.ADMIN_SERVE_USER_BUILD, true);
const ALLOW_REMOTE_ADMIN_ACCESS = normalizeBoolean(ENV.ADMIN_ALLOW_REMOTE_ACCESS, false);
const USER_STATIC_ROUTE = normalizeRoutePath(ENV.ADMIN_USER_ROUTE, "/user");
const DEFAULT_DB_REPO_CLONE_SUBPATH = "../school-dnd-public-data-mirror";
let adminServer = null;
let adminShutdownScheduled = false;
const adminSockets = new Set();

const WORKSPACE_ROOT = path.resolve(path.join(__dirname, ".."));
const PRIVATE_DATA_DIR = path.join(__dirname, "data");
const PRIVATE_BASIC_DIR = path.join(PRIVATE_DATA_DIR, "basic");
const PRIVATE_DETAILED_DIR = path.join(PRIVATE_DATA_DIR, "detailed");
const BUSINESS_DATA_ROOT = resolveBusinessDataRoot(ENV.ADMIN_BUSINESS_DATA_ROOT);
const BASIC_DIR = path.join(BUSINESS_DATA_ROOT, "basic");
const DETAILED_DIR = path.join(BUSINESS_DATA_ROOT, "detailed");
const PAYMENTS_DIR = path.join(PRIVATE_DATA_DIR, "payments");
const EXPENSES_FILE = path.join(PRIVATE_DATA_DIR, "expenses.json");
const STAFF_FILE = path.join(PRIVATE_DATA_DIR, "staff.json");
const CALENDAR_EVENTS_FILE = path.join(PRIVATE_DATA_DIR, "calendar-events.json");
const EMAIL_LOG_FILE = path.join(PRIVATE_DATA_DIR, "email-log.json");
const ID_CARDS_FILE = path.join(PRIVATE_DATA_DIR, "id-cards.json");
const PLAN_CATALOG_FILE = path.join(__dirname, "config", "plan-catalog.json");
const NOTES_FILE = path.join(PRIVATE_DATA_DIR, "notes.json");
const BASIC_INDEX_FILE = path.join(BASIC_DIR, "_cards.json");
const BASIC_INDEX_NAME = path.basename(BASIC_INDEX_FILE);
const USER_DIST_DIR = path.join(WORKSPACE_ROOT, "user", "dist");
const HAS_USER_DIST = SERVE_USER_BUILD && fs.existsSync(USER_DIST_DIR);
const ADMIN_ENV_FILE = path.join(__dirname, ".env");
const USER_ENV_FILE = path.join(WORKSPACE_ROOT, "user", ".env");
const USER_DATA_ROOT = path.join(WORKSPACE_ROOT, "user_data");
const USER_OUT_ROOT = path.join(WORKSPACE_ROOT, "user_out");
const SOURCE_IGNORED_PATHS = [
  "admin/data",
  "basic",
  "detailed",
  "user_data",
  "user_out",
  "admin/.runtime",
  "backup",
];
const PUBLIC_SECURITY_HEADERS = Object.freeze([
  ["X-Frame-Options", "SAMEORIGIN"],
  [
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; object-src 'none'; connect-src 'self' https:; img-src 'self' data: blob: https:; media-src 'self' blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; script-src 'self' 'unsafe-inline'; worker-src 'self' blob:; frame-src 'self' https://www.openstreetmap.org https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
  ],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["X-Content-Type-Options", "nosniff"],
]);
const ENV_CONFIG_SCHEMA = {
  admin: {
    title: "Admin Env",
    file_path: ADMIN_ENV_FILE,
    description: "Server, source repository, and DB mirror settings used by the admin desktop.",
    restart_note: "Restart the admin server after saving these values.",
    sections: [
      {
        title: "Server",
        description: "Core admin server behavior.",
        fields: [
          {
            key: "ADMIN_HOST",
            label: "Admin Host",
            placeholder: "0.0.0.0",
            example: "0.0.0.0",
            description: "Host binding for the admin server.",
          },
          {
            key: "ADMIN_PORT",
            label: "Admin Port",
            placeholder: "3000",
            example: "3000",
            description: "Port used by the admin server.",
          },
          {
            key: "ADMIN_SERVE_USER_BUILD",
            label: "Serve Built User App",
            placeholder: "true",
            example: "true",
            description: "Serve the built user app from the admin server.",
          },
          {
            key: "ADMIN_USER_ROUTE",
            label: "User App Route",
            placeholder: "/user",
            example: "/user",
            description: "Route where the built user app is mounted.",
          },
          {
            key: "ADMIN_ALLOW_REMOTE_ACCESS",
            label: "Allow Remote Admin Access",
            placeholder: "false",
            example: "false",
            description:
              "Keep false to restrict the admin desktop and private admin APIs to localhost while leaving `/user` and `/api/public/*` available.",
          },
        ],
      },
      {
        title: "Source Repo",
        description: "Full project repository used by Source App.",
        fields: [
          {
            key: "ADMIN_GIT_REPO_PATH",
            label: "Source Repo Path",
            placeholder: ".",
            example: ".",
            description: "Relative or absolute path to the full source repository.",
          },
          {
            key: "ADMIN_GIT_REMOTE",
            label: "Source Remote",
            placeholder: "origin",
            example: "origin",
            description: "Git remote name for the full source repository.",
          },
          {
            key: "ADMIN_GIT_DEFAULT_BRANCH",
            label: "Source Default Branch",
            placeholder: "main",
            example: "main",
            description: "Fallback branch used when git cannot infer the current branch.",
          },
        ],
      },
      {
        title: "Business Data",
        description: "Public business JSON read by the admin editor and mirrored by DB Manager.",
        fields: [
          {
            key: "ADMIN_BUSINESS_DATA_ROOT",
            label: "Business Data Root",
            placeholder: ".",
            example: ". or ../shared-business-data",
            description:
              "Relative or absolute folder that contains `basic/` and `detailed/`. Leave blank to auto-detect between the workspace root and `admin/data`.",
          },
        ],
      },
      {
        title: "DB Mirror",
        description: "Public business data mirror repository used by DB Manager.",
        fields: [
          {
            key: "ADMIN_DB_REPO_PATH",
            label: "DB Repo Path Or URL",
            placeholder: "../school-dnd-public-data",
            example: "https://github.com/<user>/<repo> or ../school-dnd-public-data",
            description:
              "Local path to the public-data repository, or a GitHub repository URL. When you enter a URL, the app clones it beside the source repo so DB Manager stays isolated from the full project.",
          },
          {
            key: "ADMIN_DB_REMOTE",
            label: "DB Remote",
            placeholder: "origin",
            example: "origin",
            description: "Git remote name for the DB mirror repository.",
          },
          {
            key: "ADMIN_DB_DEFAULT_BRANCH",
            label: "DB Default Branch",
            placeholder: "main",
            example: "main",
            description: "Fallback branch used by DB Manager.",
          },
          {
            key: "ADMIN_DB_BASIC_TARGET",
            label: "Basic Target Folder",
            placeholder: "basic",
            example: "basic",
            description: "Folder inside the DB repository where `_cards.json` is mirrored.",
          },
          {
            key: "ADMIN_DB_DETAILED_TARGET",
            label: "Detailed Target Folder",
            placeholder: "detailed",
            example: "detailed",
            description: "Folder inside the DB repository where per-business JSON files are mirrored.",
          },
        ],
      },
      {
        title: "Email Delivery",
        description:
          "Use your own email account through your provider's SMTP settings. You do not need to run your own mail server; Gmail, Outlook, Zoho, and similar providers work when SMTP or app-password access is enabled.",
        fields: [
          {
            key: "ADMIN_SMTP_HOST",
            label: "SMTP Host",
            placeholder: "smtp.gmail.com",
            example: "smtp.gmail.com",
            description:
              "SMTP host from your email provider, for example smtp.gmail.com or smtp.office365.com.",
          },
          {
            key: "ADMIN_SMTP_PORT",
            label: "SMTP Port",
            placeholder: "587",
            example: "587",
            description:
              "SMTP port. Use 587 for STARTTLS in most cases, or 465 when your provider requires implicit TLS.",
          },
          {
            key: "ADMIN_SMTP_SECURE",
            label: "SMTP Secure",
            placeholder: "false",
            example: "false",
            description:
              "Set true when your provider tells you to use SSL or implicit TLS, which is commonly paired with port 465.",
          },
          {
            key: "ADMIN_SMTP_USER",
            label: "SMTP Username",
            placeholder: "no-reply@example.com",
            example: "no-reply@example.com",
            description:
              "The full email address or SMTP username for the account you want this admin app to send from.",
          },
          {
            key: "ADMIN_SMTP_PASS",
            label: "SMTP Password",
            placeholder: "app-password",
            example: "app-password",
            description:
              "Use your provider's SMTP password or app password. For Gmail or Microsoft accounts, this is usually not your normal sign-in password.",
          },
          {
            key: "ADMIN_EMAIL_FROM_NAME",
            label: "From Name",
            placeholder: "EduData Nepal",
            example: "EduData Nepal",
            description: "Display name shown in outbound emails.",
          },
          {
            key: "ADMIN_EMAIL_FROM_ADDRESS",
            label: "From Address",
            placeholder: "no-reply@example.com",
            example: "no-reply@example.com",
            description: "From email address used for outbound emails.",
          },
          {
            key: "ADMIN_EMAIL_REPLY_TO",
            label: "Reply-To",
            placeholder: "support@example.com",
            example: "support@example.com",
            description: "Optional reply-to address if replies should go somewhere else.",
          },
        ],
      },
    ],
  },
  user: {
    title: "User Env",
    file_path: USER_ENV_FILE,
    description: "Frontend build and public data source settings used by the user app.",
    restart_note: "Restart the user dev server or rebuild the user app after saving these values.",
    sections: [
      {
        title: "Local Dev",
        description: "Local Vite dev server behavior.",
        fields: [
          {
            key: "VITE_ADMIN_API_ORIGIN",
            label: "Admin API Origin",
            placeholder: "http://localhost:3000",
            example: "http://localhost:3000",
            description: "API origin used by the user app during local development.",
          },
          {
            key: "VITE_DEV_HOST",
            label: "User Dev Host",
            placeholder: "0.0.0.0",
            example: "0.0.0.0",
            description: "Host binding for the user Vite dev server.",
          },
          {
            key: "VITE_DEV_PORT",
            label: "User Dev Port",
            placeholder: "5173",
            example: "5173",
            description: "Port used by the user Vite dev server.",
          },
        ],
      },
      {
        title: "Build & Data",
        description: "Standalone deploy settings and public data source.",
        fields: [
          {
            key: "VITE_USER_BASE",
            label: "User Build Base",
            placeholder: "/user/",
            example: "/user/",
            description: "Base path used when building the user app.",
          },
          {
            key: "VITE_SITE_NAME",
            label: "Public Site Name",
            placeholder: "AboutMySchool",
            example: "AboutMySchool",
            description: "Public site name used in page titles, Open Graph tags, and structured data.",
          },
          {
            key: "VITE_SITE_ORIGIN",
            label: "Public Site Origin",
            placeholder: "https://www.aboutmyschool.com",
            example: "https://www.aboutmyschool.com",
            description: "Canonical production origin used for sitemap, robots.txt, and SEO metadata.",
          },
          {
            key: "VITE_PUBLIC_DATA_ROOT",
            label: "Public Data Root",
            placeholder: "https://raw.githubusercontent.com/<user>/<repo>/<branch>",
            example: "https://raw.githubusercontent.com/<user>/<repo>/<branch>",
            description: "GitHub Raw repo root used by the user app in standalone deployments. Leave blank to use the local admin API.",
          },
        ],
      },
    ],
  },
};

const PLAN_CATALOG = loadPlanCatalog();
const DEFAULT_SUBSCRIPTION_PLAN = PLAN_CATALOG.default_label;
const DEFAULT_SUBSCRIPTION_CURRENCY = PLAN_CATALOG.currency;
const PROVINCES = Array.isArray(LOCATION_CATALOG?.provinces) ? LOCATION_CATALOG.provinces : [];
const ZONES = Array.isArray(LOCATION_CATALOG?.zones) ? LOCATION_CATALOG.zones : [];
const DISTRICT_CATALOG = Array.isArray(LOCATION_CATALOG?.districts) ? LOCATION_CATALOG.districts : [];
const PROVINCE_NAMES = Object.fromEntries(PROVINCES.map((province) => [String(province.id), String(province.name)]));
const ZONE_NAMES = Object.fromEntries(ZONES.map((zone) => [String(zone.id), String(zone.name)]));
const DISTRICT_LOOKUP = new Map(
  DISTRICT_CATALOG.map((district) => [String(district.name || "").trim().toLowerCase(), district])
);
const DISTRICTS_BY_PROVINCE = DISTRICT_CATALOG.reduce((accumulator, district) => {
  const provinceId = String(district.province_id || "").trim();
  if (!provinceId) {
    return accumulator;
  }
  if (!accumulator[provinceId]) {
    accumulator[provinceId] = [];
  }
  accumulator[provinceId].push(String(district.name || "").trim());
  accumulator[provinceId].sort((left, right) => left.localeCompare(right));
  return accumulator;
}, {});
const ZONES_BY_PROVINCE = DISTRICT_CATALOG.reduce((accumulator, district) => {
  const provinceId = String(district.province_id || "").trim();
  const zoneId = String(district.zone_id || "").trim();
  if (!provinceId || !zoneId) {
    return accumulator;
  }
  if (!accumulator[provinceId]) {
    accumulator[provinceId] = new Set();
  }
  accumulator[provinceId].add(zoneId);
  return accumulator;
}, {});

[BASIC_DIR, DETAILED_DIR, PRIVATE_BASIC_DIR, PRIVATE_DETAILED_DIR, PAYMENTS_DIR].forEach((dir) =>
  fs.mkdirSync(dir, { recursive: true })
);
fs.mkdirSync(USER_DATA_ROOT, { recursive: true });
fs.mkdirSync(USER_OUT_ROOT, { recursive: true });
if (!fs.existsSync(NOTES_FILE)) {
  writeJson(NOTES_FILE, []);
}
if (!fs.existsSync(EXPENSES_FILE)) {
  writeJson(EXPENSES_FILE, []);
}
if (!fs.existsSync(STAFF_FILE)) {
  writeJson(STAFF_FILE, []);
}
if (!fs.existsSync(CALENDAR_EVENTS_FILE)) {
  writeJson(CALENDAR_EVENTS_FILE, []);
}
if (!fs.existsSync(EMAIL_LOG_FILE)) {
  writeJson(EMAIL_LOG_FILE, []);
}
syncBusinessDataShadowCopies();

const generatorStudio = createGeneratorStudio({
  userDataRoot: USER_DATA_ROOT,
  userOutRoot: USER_OUT_ROOT,
});

const detailedRecordCache = new Map();
let basicCards = loadBasicCards();
let basicCardsBySlug = buildBasicCardMap(basicCards);
let revenuePaymentsCache = null;
let adminDirectoryListCache = null;
let publicDirectoryListCache = null;

scheduleDirectoryCacheWarmup();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(restrictPrivateAdminSurface);
app.use((req, res, next) => {
  const requestPath = normalizeRequestPath(req.path);
  if (isPublicUserRequestPath(requestPath) || isPublicSeoAssetPath(requestPath)) {
    applyPublicSecurityHeaders(res);
  }
  next();
});
app.get("/location-catalog.js", (req, res) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  });
  res.sendFile(path.join(__dirname, "config", "location-catalog.js"));
});
app.use(express.static(path.join(__dirname, "public")));
if (HAS_USER_DIST) {
  app.get("/robots.txt", (req, res) => {
    res.sendFile(path.join(USER_DIST_DIR, "robots.txt"));
  });
  app.get("/sitemap.xml", (req, res) => {
    res.sendFile(path.join(USER_DIST_DIR, "sitemap.xml"));
  });
  app.use("/assets", express.static(path.join(USER_DIST_DIR, "assets")));
  app.use("/nepal", express.static(path.join(USER_DIST_DIR, "nepal")));
  app.get(/^\/nepal(?:\/.*)?$/, (req, res, next) => {
    if (path.extname(req.path || "")) {
      return next();
    }

    const resolvedFile = resolveUserDistPagePath(req.path);
    if (resolvedFile) {
      return res.sendFile(resolvedFile);
    }

    return res.sendFile(path.join(USER_DIST_DIR, "index.html"));
  });
  app.use(USER_STATIC_ROUTE, express.static(USER_DIST_DIR));
  app.get(new RegExp(`^${escapeRegExp(USER_STATIC_ROUTE)}(?:/.*)?$`), (req, res, next) => {
    const relativePath = String(req.path || "").slice(USER_STATIC_ROUTE.length);
    if (path.extname(relativePath)) {
      return next();
    }
    res.sendFile(path.join(USER_DIST_DIR, "index.html"));
  });
}

registerBusinessRoutes(app, {
  canAccessPrivateAdmin,
  denyPrivateAdminRequest,
  getAdminDirectoryList,
  getPublicDirectoryList,
  getPublicDirectoryMeta,
  sanitizeSlug,
  basicCardsBySlug,
  readLegacyBasicCard,
  readDetailedRecord,
  attachGenerationStatus,
  decorateRecord,
  mergeBusinessRecords,
  isPublicRecordVisible,
  toPublicRecord,
  PLAN_CATALOG,
  buildLocationCatalogSnapshot,
  stringOrDefault,
  loadPaymentHistory,
  buildSubscriptionFromSave,
  buildPaymentHistory,
  buildBasicCard,
  cleanStringArray,
  normalizeFloat,
  normalizeInteger,
  writeDetailedRecord,
  savePaymentHistory,
  saveBasicCard,
  removeIfExists,
  filePathFor,
  BASIC_DIR,
  removeDetailedRecord,
  removePaymentHistory,
  invalidateRevenueCache,
  sendBusinessRegistrationEmail,
  sendBusinessPaymentStatusEmail,
  normalizeDateInput,
  DEFAULT_SUBSCRIPTION_PLAN,
  getRenewalStart,
  getPlanExpiryDate,
  stripSubscriptionForStorage,
  hydrateStoredSubscription,
  getDefaultPlanAmount,
  DEFAULT_SUBSCRIPTION_CURRENCY,
  sanitizePaymentRecord,
  generateId,
  upsertPaymentHistory,
  deriveSubscriptionFromPaymentHistory,
  removeBasicCard,
});

registerReportRoutes(app, {
  handleAnalyticsReportRequest,
  loadReportExpenses,
  loadExpenses,
  stringOrDefault,
  normalizeFloat,
  normalizeDateInput,
  generateId,
  sanitizeExpenseRecord,
  DEFAULT_SUBSCRIPTION_CURRENCY,
  saveExpenses,
});

registerToolRoutes(app, {
  loadNotes,
  saveNotes,
  stringOrDefault,
  generateId,
  buildSourceSnapshot,
  getSourceRepoConfig,
  getSourceBranchName,
  executeSourceWorkflow,
  stageSourceRepoChanges,
  buildDbSnapshot,
  mirrorBusinessDataToDbRepo,
  getDbRepoConfig,
  getDbBranchName,
  executeDbWorkflow,
  pushRepoWithLease,
  getDbRepoRoot,
  getGeneratorBusinessContext,
  generatorStudio,
  respondApiError,
  buildStaffSnapshot,
  saveStaffMember,
  removeStaffMember,
  saveStaffPaymentRecord,
  deleteStaffPaymentRecord,
  saveStaffAdjustmentRecord,
  deleteStaffAdjustmentRecord,
  buildStaffStatementDetails,
  buildStaffStatementPdfBuffer,
  buildCalendarSnapshot,
  saveCalendarEvent,
  removeCalendarEvent,
  buildEmailSnapshot,
  sendBusinessEmailCampaign,
  buildIdCardSnapshot,
  buildIdCardPreview,
  getBusinessIdCardDetails,
  buildBusinessIdCardPdfBuffer,
  saveBusinessIdCard,
  sendBusinessIdCardEmail,
  canAccessPrivateAdmin,
  scheduleAdminShutdown,
  buildEnvConfigSnapshot,
  saveEnvConfigSnapshot,
});

function decorateRecord(record, options = {}) {
  const {
    includePaymentHistory = false,
    includePaymentReferenceInSearch = false,
  } = options;
  const normalized = mergeBusinessRecords(record, {});
  const registrationId = getCanonicalBusinessRegistrationId(
    normalized,
    stringOrDefault(normalized.created_at, new Date().toISOString())
  );
  const paymentHistory = resolveBusinessPaymentHistory(normalized.slug, normalized.payment_history);
  const subscription = deriveEffectiveBusinessSubscription(
    normalized.slug,
    normalized.subscription || {},
    paymentHistory
  );
  const location = buildLocationLabels(normalized);
  const decorated = {
    ...normalized,
    ...location,
    subscription,
    registration_id: registrationId,
    search_text: buildSearchText(
      {
        ...normalized,
        registration_id: registrationId,
      },
      location,
      {
        includePaymentReference: includePaymentReferenceInSearch,
      }
    ),
  };

  if (includePaymentHistory) {
    decorated.payment_history = paymentHistory;
  } else {
    delete decorated.payment_history;
  }

  return decorated;
}

function resolveBusinessPaymentHistory(slug, fallbackHistory = []) {
  return loadPaymentHistory(slug, fallbackHistory);
}

function deriveEffectiveBusinessSubscription(slug, fallbackSubscription = {}, fallbackHistory = []) {
  const paymentHistory = resolveBusinessPaymentHistory(slug, fallbackHistory);
  if (paymentHistory.length) {
    return hydrateStoredSubscription(
      deriveSubscriptionFromPaymentHistory(paymentHistory, fallbackSubscription || {})
    );
  }
  return hydrateStoredSubscription(stripSubscriptionForStorage(fallbackSubscription || {}));
}

function mergeBusinessRecords(basic, detailed) {
  const { is_featured: _basicFeatured, ...basicRecord } = basic || {};
  const { is_featured: _detailedFeatured, ...detailedRecord } = detailed || {};
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
    is_verified: Boolean(
      detailedRecord.is_verified !== undefined ? detailedRecord.is_verified : basicRecord.is_verified
    ),
    is_certified: Boolean(
      detailedRecord.is_certified !== undefined ? detailedRecord.is_certified : basicRecord.is_certified
    ),
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
    tags: sanitizeBusinessTags(detailedRecord.tags || basicRecord.tags),
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
  const district = stringOrDefault(source.district);
  return sanitizeBasicCard({
    id: existingBasic.id || existingDetailed.id || source.id || generateId(),
    slug: source.slug,
    name: source.name,
    name_np: source.name_np,
    type: source.type,
    level: source.level,
    field: source.field,
    affiliation: source.affiliation,
    district,
    zone: resolveZoneFromDistrict(source.zone, district),
    province: resolveProvinceFromDistrict(source.province, district),
    is_verified: source.is_verified,
    is_certified: source.is_certified,
    tags: source.tags,
    logo: source.logo ?? media.logo,
    cover: source.cover ?? media.cover,
    contact: buildBasicCardContactSummary(
      source.contact,
      existingDetailed.contact || existingBasic.contact
    ),
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
    zone: resolveZoneFromDistrict(record.zone, record.district),
    province: resolveProvinceFromDistrict(record.province, record.district),
    is_verified: Boolean(record.is_verified),
    is_certified: Boolean(record.is_certified),
    tags: sanitizeBusinessTags(record.tags),
    logo: stringOrDefault(record.logo || media.logo),
    cover: stringOrDefault(record.cover || media.cover),
    contact: buildBasicCardContactSummary(record.contact),
    subscription: stripSubscriptionForStorage(record.subscription || {}),
    updated_at: stringOrDefault(record.updated_at),
    created_at: stringOrDefault(record.created_at),
  };
}

function loadBasicCards() {
  const stored = readJson(BASIC_INDEX_FILE, null);
  if (Array.isArray(stored)) {
    return normalizeStoredBasicCards(stored);
  }

  const migrated = migrateBasicCards();
  writeJson(BASIC_INDEX_FILE, migrated, null);
  return migrated;
}

function normalizeStoredBasicCards(cards) {
  const normalized = sortBasicCards(
    ensureArray(cards).map((item) => hydrateBasicCard(item)).filter(Boolean)
  );
  const serializedNext = JSON.stringify(normalized);
  const serializedStored = JSON.stringify(ensureArray(cards));

  if (serializedNext !== serializedStored) {
    writeJson(BASIC_INDEX_FILE, normalized, null);
  }

  return normalized;
}

function migrateBasicCards() {
  const legacyCards = fs
    .readdirSync(BASIC_DIR)
    .filter((file) => file.endsWith(".json") && file !== BASIC_INDEX_NAME)
    .map((file) => sanitizeBasicCard(readJson(path.join(BASIC_DIR, file), null)))
    .filter(Boolean);

  if (legacyCards.length) {
    return hydrateBasicCards(legacyCards);
  }

  const detailedCards = fs
    .readdirSync(DETAILED_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => sanitizeBasicCard(readJson(path.join(DETAILED_DIR, file), null)))
    .filter(Boolean);

  return hydrateBasicCards(detailedCards);
}

function buildBasicCardContactSummary(sourceContact, fallbackContact = {}) {
  const source = sourceContact || {};
  const fallback = fallbackContact || {};
  const sourcePhones = cleanStringArray(source.phone);
  const fallbackPhones = cleanStringArray(fallback.phone);

  return {
    address: stringOrDefault(source.address, fallback.address),
    phone: sourcePhones.length ? sourcePhones : fallbackPhones,
    email: stringOrDefault(source.email, fallback.email),
    website: stringOrDefault(source.website, fallback.website),
    map: {
      lat: normalizeFloat(source.map?.lat) ?? normalizeFloat(fallback.map?.lat),
      lng: normalizeFloat(source.map?.lng) ?? normalizeFloat(fallback.map?.lng),
    },
  };
}

function hydrateBasicCards(cards) {
  const nextCards = sortBasicCards(
    ensureArray(cards).map((card) => hydrateBasicCard(card)).filter(Boolean)
  );
  const serializedNext = JSON.stringify(nextCards);
  const serializedStored = JSON.stringify(sortBasicCards(ensureArray(cards).filter(Boolean)));

  if (serializedNext !== serializedStored) {
    writeJson(BASIC_INDEX_FILE, nextCards, null);
  }

  return nextCards;
}

function hydrateBasicCard(card) {
  const normalized = sanitizeBasicCard(card);
  if (!normalized?.slug) {
    return null;
  }

  const detailed = readDetailedRecord(normalized.slug);
  if (!detailed) {
    return normalized;
  }

  return sanitizeBasicCard({
    ...detailed,
    ...normalized,
    contact: buildBasicCardContactSummary(normalized.contact, detailed.contact),
    subscription: deriveEffectiveBusinessSubscription(
      normalized.slug,
      normalized.subscription || detailed.subscription || {},
      detailed.payment_history || []
    ),
  });
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
  invalidateDirectoryDataCache(normalized.slug);
  invalidateDirectoryDataCache(sourceSlug);
  writeJson(BASIC_INDEX_FILE, basicCards, null);
  syncBusinessDataShadowCopies();
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
  invalidateDirectoryDataCache(normalizedSlug);
  writeJson(BASIC_INDEX_FILE, basicCards, null);
  syncBusinessDataShadowCopies();
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

function getCanonicalBusinessRegistrationId(record, fallbackCreatedAt = new Date().toISOString()) {
  return stringOrDefault(
    record?.id,
    stringOrDefault(record?.registration_id, buildRegistrationId(record?.slug, fallbackCreatedAt))
  );
}

function buildSearchText(record, location, options = {}) {
  const { includePaymentReference = false } = options;
  const locationInfo = location || buildLocationLabels(record);
  return [
    record.name,
    record.id,
    record.registration_id,
    record.slug,
    record.type,
    ...(record.level || []),
    ...(record.field || []),
    ...(record.programs || []),
    record.district,
    locationInfo.zone_name,
    locationInfo.province_name,
    record.affiliation,
    ...(record.tags || []),
    ...(includePaymentReference ? [record.subscription?.payment_reference] : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function toPublicRecord(record) {
  const registrationId = getCanonicalBusinessRegistrationId(record, record?.created_at);
  return {
    id: stringOrDefault(record.id),
    registration_id: registrationId,
    slug: stringOrDefault(record.slug),
    name: stringOrDefault(record.name),
    name_np: stringOrDefault(record.name_np),
    type: stringOrDefault(record.type),
    level: cleanStringArray(record.level),
    field: cleanStringArray(record.field),
    affiliation: stringOrDefault(record.affiliation),
    district: stringOrDefault(record.district),
    zone: stringOrDefault(record.zone),
    zone_name: stringOrDefault(record.zone_name),
    province: stringOrDefault(record.province),
    province_name: stringOrDefault(record.province_name),
    location_label: stringOrDefault(record.location_label),
    location_full_label: stringOrDefault(record.location_full_label),
    is_verified: Boolean(record.is_verified),
    is_certified: Boolean(record.is_certified),
    tags: sanitizeBusinessTags(record.tags),
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
    search_text: buildSearchText(
      {
        ...record,
        registration_id: registrationId,
      },
      {
        zone_name: record.zone_name,
        province_name: record.province_name,
      },
      {
        includePaymentReference: false,
      }
    ),
  };
}

function toPublicSummaryRecord(record) {
  const publicRecord = toPublicRecord(record);
  return {
    id: publicRecord.id,
    registration_id: publicRecord.registration_id,
    slug: publicRecord.slug,
    name: publicRecord.name,
    name_np: publicRecord.name_np,
    type: publicRecord.type,
    level: publicRecord.level,
    field: publicRecord.field,
    affiliation: publicRecord.affiliation,
    district: publicRecord.district,
    zone: publicRecord.zone,
    zone_name: publicRecord.zone_name,
    province: publicRecord.province,
    province_name: publicRecord.province_name,
    location_label: publicRecord.location_label,
    location_full_label: publicRecord.location_full_label,
    is_verified: publicRecord.is_verified,
    is_certified: publicRecord.is_certified,
    tags: publicRecord.tags,
    logo: publicRecord.logo,
    cover: publicRecord.cover,
    contact: {
      address: publicRecord.contact.address,
      phone: publicRecord.contact.phone,
      email: publicRecord.contact.email,
      website: publicRecord.contact.website,
      map: publicRecord.contact.map,
    },
    media: {
      logo: publicRecord.media.logo,
      cover: publicRecord.media.cover,
    },
    created_at: publicRecord.created_at,
    updated_at: publicRecord.updated_at,
    search_text: publicRecord.search_text,
  };
}

function getGeneratorBusinessContext(slugValue) {
  const slug = sanitizeSlug(slugValue);
  if (!slug) {
    return null;
  }

  const basic = basicCardsBySlug.get(slug) || readLegacyBasicCard(slug) || {};
  const detailed = readDetailedRecord(slug) || {};
  if (!basic.slug && !detailed.slug) {
    return null;
  }

  return {
    slug,
    record: decorateRecord(mergeBusinessRecords(basic, detailed), {
      includePaymentHistory: false,
      includePaymentReferenceInSearch: true,
    }),
  };
}

function attachGenerationStatus(record) {
  const status = generatorStudio.getBusinessStatus(record);
  return {
    ...record,
    generator: {
      folder_name: status.paths.folder_name,
      data_dir: status.paths.data_dir,
      output_dir: status.paths.output_dir,
      generated_count: status.paths.generated_count,
      non_generated_count: status.paths.non_generated_count,
      has_website_form: status.paths.has_website_form,
      has_app_form: status.paths.has_app_form,
      has_website: status.paths.has_website,
      has_flutter_source: status.paths.has_flutter_source,
      has_apk: status.paths.has_apk,
      website_index_path: status.paths.website_index_path,
      apk_path: status.paths.apk_path,
    },
  };
}

function getAdminDirectoryList() {
  if (adminDirectoryListCache) {
    return adminDirectoryListCache;
  }

  adminDirectoryListCache = basicCards.map((card) =>
    attachGenerationStatus(
      decorateRecord(card, {
        includePaymentHistory: false,
        includePaymentReferenceInSearch: true,
      })
    )
  );
  return adminDirectoryListCache;
}

function getPublicDirectoryList() {
  if (publicDirectoryListCache) {
    return publicDirectoryListCache;
  }

  publicDirectoryListCache = basicCards
    .map((card) =>
      decorateRecord(card, {
        includePaymentHistory: false,
        includePaymentReferenceInSearch: false,
      })
    )
    .filter((record) => isPublicRecordVisible(record))
    .map((record) => toPublicSummaryRecord(record));

  return publicDirectoryListCache;
}

function getPublicDirectoryMeta() {
  const list = getPublicDirectoryList();
  const basicIndexStat = safeStat(BASIC_INDEX_FILE);
  const sourceUpdatedAt =
    getLatestRecordTimestamp(list) ||
    (basicIndexStat ? new Date(basicIndexStat.mtimeMs).toISOString() : "");
  const version = [
    basicIndexStat ? Math.round(basicIndexStat.mtimeMs) : "",
    list.length,
    sourceUpdatedAt,
  ]
    .filter(Boolean)
    .join(":");

  return {
    version: version || `count:${list.length}`,
    count: list.length,
    updated_at: sourceUpdatedAt,
  };
}

function scheduleDirectoryCacheWarmup() {
  const defer = typeof setImmediate === "function" ? setImmediate : setTimeout;
  defer(() => {
    try {
      getPublicDirectoryList();
    } catch {
      // Ignore warmup failures and serve lazily on request.
    }
  }, 0);
}

function invalidateDirectoryDataCache(...slugs) {
  adminDirectoryListCache = null;
  publicDirectoryListCache = null;

  for (const slug of slugs) {
    const normalizedSlug = sanitizeSlug(slug);
    if (normalizedSlug) {
      detailedRecordCache.delete(normalizedSlug);
    }
  }
}

function getLatestRecordTimestamp(records) {
  let latestTime = 0;

  for (const record of ensureArray(records)) {
    const time =
      normalizeDateInput(record?.updated_at || record?.created_at)?.getTime() || 0;
    if (time > latestTime) {
      latestTime = time;
    }
  }

  return latestTime ? new Date(latestTime).toISOString() : "";
}

function readDetailedRecord(slug) {
  const normalizedSlug = sanitizeSlug(slug);
  if (!normalizedSlug) {
    return null;
  }

  if (detailedRecordCache.has(normalizedSlug)) {
    return detailedRecordCache.get(normalizedSlug);
  }

  const detailed = readJson(filePathFor(DETAILED_DIR, normalizedSlug), null);
  if (detailed) {
    detailedRecordCache.set(normalizedSlug, detailed);
  }
  return detailed;
}

function writeDetailedRecord(slug, value) {
  const normalizedSlug = sanitizeSlug(slug);
  if (!normalizedSlug) {
    return;
  }

  writeJson(filePathFor(DETAILED_DIR, normalizedSlug), value);
  invalidateDirectoryDataCache(normalizedSlug);
  detailedRecordCache.set(normalizedSlug, value);
  syncBusinessDataShadowCopies();
}

function removeDetailedRecord(slug) {
  const normalizedSlug = sanitizeSlug(slug);
  if (!normalizedSlug) {
    return;
  }

  removeIfExists(filePathFor(DETAILED_DIR, normalizedSlug));
  invalidateDirectoryDataCache(normalizedSlug);
  syncBusinessDataShadowCopies();
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

function refreshBusinessPaymentSummaries() {
  const slugs = new Set([
    ...basicCards.map((card) => card.slug),
    ...fs
      .readdirSync(DETAILED_DIR)
      .filter((file) => file.endsWith(".json"))
      .map((file) => path.basename(file, ".json")),
    ...fs
      .readdirSync(PAYMENTS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  ]);
  const touched = [];

  for (const slug of slugs) {
    const basic = basicCardsBySlug.get(slug) || readLegacyBasicCard(slug);
    const detailed = readDetailedRecord(slug);
    if (!basic && !detailed) {
      continue;
    }

    const fallbackSubscription = detailed?.subscription || basic?.subscription || {};
    const paymentHistory = resolveBusinessPaymentHistory(slug, detailed?.payment_history || []);
    const nextSubscription = paymentHistory.length
      ? stripSubscriptionForStorage(
          deriveSubscriptionFromPaymentHistory(paymentHistory, fallbackSubscription)
        )
      : stripSubscriptionForStorage(fallbackSubscription);
    const nextSignature = JSON.stringify(nextSubscription);

    if (basic) {
      const currentSignature = JSON.stringify(stripSubscriptionForStorage(basic.subscription || {}));
      if (currentSignature !== nextSignature) {
        saveBasicCard(
          {
            ...basic,
            subscription: nextSubscription,
          },
          slug
        );
        touched.push(`${slug}:basic`);
      }
    }

    if (detailed) {
      const currentSignature = JSON.stringify(stripSubscriptionForStorage(detailed.subscription || {}));
      if (currentSignature !== nextSignature) {
        writeDetailedRecord(slug, {
          ...detailed,
          subscription: nextSubscription,
        });
        touched.push(`${slug}:detailed`);
      }
    }
  }

  return {
    touched,
    changed_count: touched.length,
  };
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
    source: stringOrDefault(record.source, "manual"),
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

function loadReportExpenses() {
  return sortExpenses([...loadExpenses(), ...collectStaffPayrollExpenses()]);
}

function collectStaffPayrollExpenses() {
  const expenses = [];

  for (const staff of loadStaffRecords()) {
    for (const payment of ensureArray(staff.payment_history)) {
      const normalizedPayment = normalizeStaffPaymentRecord(payment);
      if (!normalizedPayment?.paid_at || (normalizeFloat(normalizedPayment.amount) || 0) <= 0) {
        continue;
      }

      const effectiveCompensation = resolveStaffCompensationAt(staff, normalizedPayment.paid_at);
      const expense = sanitizeExpenseRecord({
        id: `payroll-${staff.id}-${normalizedPayment.id}`,
        title: `${stringOrDefault(staff.full_name, "Staff")} salary`,
        category: "Payroll",
        amount: normalizedPayment.amount,
        currency: normalizedPayment.currency || effectiveCompensation.salary_currency || "NPR",
        incurred_at: normalizedPayment.paid_at,
        notes: [normalizedPayment.notes, normalizedPayment.reference].filter(Boolean).join(" · "),
        created_at: normalizedPayment.created_at || normalizedPayment.paid_at,
        updated_at: normalizedPayment.updated_at || normalizedPayment.paid_at,
      });
      if (!expense) {
        continue;
      }

      expenses.push({
        ...expense,
        source: "staff-payroll",
        staff_id: staff.id,
        staff_name: stringOrDefault(staff.full_name),
        staff_role: stringOrDefault(effectiveCompensation.role),
      });
    }
  }

  return expenses;
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
  const expenses = loadReportExpenses();
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
    const effectivePaymentHistory = paymentHistory.length
      ? paymentHistory
      : buildFallbackRevenuePaymentsFromSubscription(slug, business);

    for (const entry of effectivePaymentHistory) {
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

function buildFallbackRevenuePaymentsFromSubscription(slug, business) {
  const subscription = hydrateStoredSubscription(business?.subscription || {});
  const amount = normalizeFloat(subscription.amount);
  const paidAt = normalizeDateInput(subscription.paid_at || subscription.starts_at);
  if (!paidAt || !Number.isFinite(amount) || amount <= 0) {
    return [];
  }

  const normalized = sanitizePaymentRecord(
    {
      id: `subscription-${sanitizeSlug(slug)}`,
      slug,
      plan: subscription.plan,
      amount,
      currency: stringOrDefault(subscription.currency, DEFAULT_SUBSCRIPTION_CURRENCY),
      paid_at: paidAt.toISOString(),
      starts_at: normalizeDateInput(subscription.starts_at)?.toISOString() || paidAt.toISOString(),
      expires_at:
        normalizeDateInput(subscription.expires_at)?.toISOString() ||
        getPlanExpiryDate(paidAt, subscription.plan).toISOString(),
      payment_method: stringOrDefault(subscription.payment_method),
      payment_reference: stringOrDefault(subscription.payment_reference),
      notes: stringOrDefault(subscription.notes),
      created_at: stringOrDefault(subscription.last_updated_at, paidAt.toISOString()),
      updated_at: stringOrDefault(subscription.last_updated_at, paidAt.toISOString()),
    },
    slug
  );

  return normalized ? [normalized] : [];
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
  const sourceConfig = getSourceRepoConfig();
  return executeRepoWorkflow({
    repoRoot: getSourceRepoRoot(),
    remoteName: sourceConfig.remoteName,
    defaultBranch: sourceConfig.defaultBranch,
    label: "source-control app",
    steps,
    ignoredPaths: getSourceIgnoredRepoPaths(),
  });
}

function buildSourceSnapshot(lastCommand = null) {
  const sourceConfig = getSourceRepoConfig();
  return buildRepoSnapshot({
    repoRoot: getSourceRepoRoot(),
    remoteName: sourceConfig.remoteName,
    defaultBranch: sourceConfig.defaultBranch,
    label: "source-control app",
    lastCommand,
    ignoredPaths: getSourceIgnoredRepoPaths(),
  });
}

function executeDbWorkflow(steps) {
  const dbConfig = getDbRepoConfig();
  return executeRepoWorkflow({
    repoRoot: getDbRepoRoot(),
    remoteName: dbConfig.remoteName,
    defaultBranch: dbConfig.defaultBranch,
    label: "DB manager",
    steps,
    extra: buildDbSnapshotExtras(),
  });
}

function buildDbSnapshot(lastCommand = null) {
  refreshDbRepoCloneWhenSafe();
  const dbConfig = getDbRepoConfig();
  return buildRepoSnapshot({
    repoRoot: getDbRepoRoot(),
    remoteName: dbConfig.remoteName,
    defaultBranch: dbConfig.defaultBranch,
    label: "DB manager",
    lastCommand,
    extra: buildDbSnapshotExtras(),
  });
}

function refreshDbRepoCloneWhenSafe() {
  const dbConfig = getDbRepoConfig();
  const repoRoot = getDbRepoRoot();
  const branch = getDbBranchName();
  const statusBefore = runGitCommandInRepo(repoRoot, ["status", "--porcelain=v1", "--branch"], {
    allowFailure: true,
  });
  if (!statusBefore.ok) {
    return;
  }

  const parsedBefore = parseGitStatusOutput(statusBefore.output, branch);
  if (parsedBefore.changed_count > 0) {
    return;
  }

  const fetchResult = runGitCommandInRepo(repoRoot, ["fetch", "--prune", dbConfig.remoteName], {
    allowFailure: true,
  });
  if (!fetchResult.ok) {
    return;
  }

  const statusAfterFetch = runGitCommandInRepo(
    repoRoot,
    ["status", "--porcelain=v1", "--branch"],
    { allowFailure: true }
  );
  if (!statusAfterFetch.ok) {
    return;
  }

  const parsedAfterFetch = parseGitStatusOutput(statusAfterFetch.output, branch);
  if (parsedAfterFetch.changed_count === 0 && parsedAfterFetch.behind > 0) {
    runGitCommandInRepo(
      repoRoot,
      ["pull", "--rebase", dbConfig.remoteName, branch],
      { allowFailure: true }
    );
  }
}

function buildDbSnapshotExtras() {
  const dbConfig = getDbRepoConfig();
  const repoRoot = getDbRepoRoot();
  return {
    source_basic_dir: BASIC_DIR,
    source_detailed_dir: DETAILED_DIR,
    target_basic_dir: path.join(repoRoot, dbConfig.basicTargetPath),
    target_detailed_dir: path.join(repoRoot, dbConfig.detailedTargetPath),
  };
}

function executeRepoWorkflow({ repoRoot, remoteName, defaultBranch, label, steps, extra = {}, ignoredPaths = [] }) {
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
    ignoredPaths,
  });
}

function buildRepoSnapshot({ repoRoot, remoteName, defaultBranch, label, lastCommand = null, extra = {}, ignoredPaths = [] }) {
  const branch = getBranchNameForRepo(repoRoot, defaultBranch, label);
  const statusResult = runGitCommandInRepo(repoRoot, ["status", "--porcelain=v1", "--branch"]);
  if (!statusResult.ok) {
    throw new Error(statusResult.output || "Unable to read git status.");
  }

  const filteredStatusText = filterGitStatusText(statusResult.output, ignoredPaths);
  const parsedStatus = filterRepoStatusByIgnoredPaths(
    parseGitStatusOutput(statusResult.output, branch),
    ignoredPaths
  );
  const remoteResult = runGitCommandInRepo(repoRoot, ["remote", "get-url", remoteName], {
    allowFailure: true,
  });
  const filteredLastOutput = filterRepoDiagnosticOutput(lastCommand?.output, ignoredPaths);
  const lastOutput = stringOrDefault(filteredLastOutput, filteredStatusText);
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
    status_text: filteredStatusText,
    status_summary: parsedStatus.status_summary,
    last_output: lastOutput,
    last_summary: lastSummary,
    ignored_paths: ignoredPaths,
    ...extra,
  };
}

function normalizeIgnoredRepoPaths(ignoredPaths) {
  return ensureArray(ignoredPaths)
    .map((value) => normalizeRepoRelativePath(value))
    .filter(Boolean);
}

function filterGitStatusText(output, ignoredPaths) {
  const normalizedIgnoredPaths = normalizeIgnoredRepoPaths(ignoredPaths);
  if (!normalizedIgnoredPaths.length) {
    return String(output || "");
  }

  const lines = String(output || "").split(/\r?\n/);
  if (!lines.length) {
    return "";
  }

  const filtered = [];
  for (const line of lines) {
    if (!line) {
      continue;
    }
    if (line.startsWith("## ")) {
      filtered.push(line);
      continue;
    }
    const parsed = parseGitStatusLine(line);
    if (parsed && isIgnoredRepoPath(parsed.path, normalizedIgnoredPaths)) {
      continue;
    }
    filtered.push(line);
  }

  return filtered.join("\n");
}

function filterRepoDiagnosticOutput(output, ignoredPaths) {
  const normalizedIgnoredPaths = normalizeIgnoredRepoPaths(ignoredPaths);
  const text = String(output || "");
  if (!normalizedIgnoredPaths.length || !text) {
    return text;
  }

  return text
    .split(/\n{2,}/)
    .map((section) => filterGitStatusText(section, normalizedIgnoredPaths))
    .filter((section) => section.trim().length)
    .join("\n\n");
}

function filterRepoStatusByIgnoredPaths(parsedStatus, ignoredPaths) {
  const normalizedIgnoredPaths = normalizeIgnoredRepoPaths(ignoredPaths);
  if (!normalizedIgnoredPaths.length) {
    return parsedStatus;
  }

  const visibleFiles = ensureArray(parsedStatus?.changed_files).filter(
    (file) => !isIgnoredRepoPath(file?.path, normalizedIgnoredPaths)
  );
  const stagedCount = visibleFiles.filter((file) => file.staged).length;
  const changedCount = visibleFiles.length;
  const branch = String(parsedStatus?.status_summary || "").match(/on ([^.]+)\.$/)?.[1] || "current branch";

  return {
    ...parsedStatus,
    changed_count: changedCount,
    staged_count: stagedCount,
    changed_files: visibleFiles,
    status_summary: changedCount
      ? `${changedCount} changed file${changedCount === 1 ? "" : "s"} on ${branch}.`
      : `Working tree clean on ${branch}.`,
  };
}

function getSourceIgnoredRepoPaths() {
  return SOURCE_IGNORED_PATHS;
}

function normalizeRepoRelativePath(value) {
  return String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "")
    .replace(/\/+$/, "");
}

function isIgnoredRepoPath(candidatePath, ignoredPaths) {
  const normalizedCandidate = normalizeRepoRelativePath(candidatePath);
  return ensureArray(ignoredPaths).some((ignoredPath) => {
    const normalizedIgnored = normalizeRepoRelativePath(ignoredPath);
    return (
      normalizedCandidate === normalizedIgnored ||
      normalizedCandidate.startsWith(`${normalizedIgnored}/`)
    );
  });
}

function normalizeGitStatusPath(value) {
  const text = String(value || "").trim();
  if (text.startsWith('"') && text.endsWith('"')) {
    try {
      return JSON.parse(text);
    } catch (error) {
      return text.slice(1, -1);
    }
  }
  return text;
}

function extractGitStatusPaths(line) {
  const text = String(line || "");
  if (!text || text.startsWith("## ") || text.length < 4) {
    return [];
  }

  const rawPath = text.slice(3).trim();
  if (!rawPath) {
    return [];
  }

  if (rawPath.includes(" -> ")) {
    return rawPath.split(" -> ").map((value) => normalizeGitStatusPath(value)).filter(Boolean);
  }

  return [normalizeGitStatusPath(rawPath)];
}

function collectSourceStageCandidates() {
  const statusArgs = ["status", "--porcelain=v1", "--branch", "--untracked-files=all"];
  const statusResult = runGitCommandInRepo(getSourceRepoRoot(), statusArgs);
  if (!statusResult.ok) {
    throw new Error(statusResult.output || `$ git ${statusArgs.join(" ")} failed.`);
  }

  const ignoredPaths = getSourceIgnoredRepoPaths();
  const candidates = [];
  const seen = new Set();

  for (const line of String(statusResult.output || "").split(/\r?\n/)) {
    for (const rawPath of extractGitStatusPaths(line)) {
      const normalizedPath = normalizeRepoRelativePath(rawPath);
      if (!normalizedPath || isIgnoredRepoPath(normalizedPath, ignoredPaths) || seen.has(normalizedPath)) {
        continue;
      }
      seen.add(normalizedPath);
      candidates.push(normalizedPath);
    }
  }

  return {
    statusArgs,
    candidates,
  };
}

function stageSourceRepoChanges() {
  const { statusArgs, candidates } = collectSourceStageCandidates();
  if (!candidates.length) {
    return {
      summary: "No source code changes were available to stage.",
      log: `$ git ${statusArgs.join(" ")}\nNo eligible source files were found outside the ignored data folders.`,
    };
  }

  const args = ["add", "-A", "--", ...candidates];
  const result = runGitCommandInRepo(getSourceRepoRoot(), args);
  if (!result.ok) {
    throw new Error(result.output || `$ git ${args.join(" ")} failed.`);
  }

  return {
    summary: "Code changes were staged while source data folders stayed ignored.",
    log: [
      `$ git ${statusArgs.join(" ")}`,
      `Eligible source paths: ${candidates.join(", ")}`,
      "",
      `$ git ${args.join(" ")}`,
      result.output || "Source changes staged.",
    ].join("\n"),
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
  return runGitCommandInDirectory(repoRoot, args, options);
}

function runGitCommandInDirectory(cwd, args, options = {}) {
  const result = spawnSync("git", ensureArray(args), {
    cwd,
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

function getCurrentAdminEnv() {
  return loadEnvFile(ADMIN_ENV_FILE);
}

function resolveWorkspacePath(value, fallback = "") {
  const normalized = stringOrDefault(value, fallback);
  if (!normalized) {
    return "";
  }
  if (path.isAbsolute(normalized)) {
    return path.normalize(normalized);
  }
  return path.resolve(WORKSPACE_ROOT, normalized);
}

function hasBusinessDataDirectories(rootPath) {
  return ["basic", "detailed"].some((entryName) => {
    const targetPath = path.join(rootPath, entryName);
    try {
      return fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory();
    } catch {
      return false;
    }
  });
}

function resolveBusinessDataRoot(value) {
  const explicitRoot = stringOrDefault(value);
  if (explicitRoot) {
    return resolveWorkspacePath(explicitRoot);
  }

  const workspaceCandidate = resolveWorkspacePath(".");
  if (workspaceCandidate && hasBusinessDataDirectories(workspaceCandidate)) {
    return workspaceCandidate;
  }

  return PRIVATE_DATA_DIR;
}

function directoryHasJsonFiles(dirPath) {
  try {
    return fs.readdirSync(dirPath).some((entry) => entry.toLowerCase().endsWith(".json"));
  } catch {
    return false;
  }
}

function syncJsonDirectoryPair(primaryDir, shadowDir) {
  if (pathsEqual(primaryDir, shadowDir)) {
    return { copied: 0, removed: 0, direction: "same-path" };
  }

  const primaryHasFiles = directoryHasJsonFiles(primaryDir);
  const shadowHasFiles = directoryHasJsonFiles(shadowDir);

  if (!primaryHasFiles && shadowHasFiles) {
    const result = mirrorJsonDirectory(shadowDir, primaryDir);
    return { ...result, direction: "shadow-to-primary" };
  }

  if (primaryHasFiles || !shadowHasFiles) {
    const result = mirrorJsonDirectory(primaryDir, shadowDir);
    return { ...result, direction: "primary-to-shadow" };
  }

  return { copied: 0, removed: 0, direction: "empty" };
}

function syncBusinessDataShadowCopies() {
  return {
    basic: syncJsonDirectoryPair(BASIC_DIR, PRIVATE_BASIC_DIR),
    detailed: syncJsonDirectoryPair(DETAILED_DIR, PRIVATE_DETAILED_DIR),
  };
}

function resolveRepoConfigPath(value, fallback = "") {
  return resolveWorkspacePath(value, fallback);
}

function isRemoteRepoReference(value) {
  return /^(?:https?:\/\/|ssh:\/\/|git@)/i.test(String(value || "").trim());
}

function normalizeRepoUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function normalizeRepoUrlForCompare(value) {
  return normalizeRepoUrl(value).replace(/\.git$/i, "");
}

function getSourceRepoConfig() {
  const envValues = getCurrentAdminEnv();
  return {
    repoPath: resolveRepoConfigPath(envValues.ADMIN_GIT_REPO_PATH, "."),
    remoteName: stringOrDefault(envValues.ADMIN_GIT_REMOTE, "origin"),
    defaultBranch: stringOrDefault(envValues.ADMIN_GIT_DEFAULT_BRANCH),
  };
}

function getDbRepoConfig() {
  const envValues = getCurrentAdminEnv();
  const repoInput = stringOrDefault(envValues.ADMIN_DB_REPO_PATH);
  const remoteUrl = isRemoteRepoReference(repoInput) ? normalizeRepoUrl(repoInput) : "";
  const repoPath = remoteUrl
    ? resolveRepoConfigPath(DEFAULT_DB_REPO_CLONE_SUBPATH)
    : resolveRepoConfigPath(repoInput);

  return {
    repoInput,
    remoteUrl,
    repoPath,
    remoteName: stringOrDefault(envValues.ADMIN_DB_REMOTE, "origin"),
    defaultBranch: stringOrDefault(envValues.ADMIN_DB_DEFAULT_BRANCH),
    basicTargetPath: normalizeRepoSubpath(envValues.ADMIN_DB_BASIC_TARGET, "basic"),
    detailedTargetPath: normalizeRepoSubpath(envValues.ADMIN_DB_DETAILED_TARGET, "detailed"),
  };
}

function getSourceRepoRoot() {
  const sourceConfig = getSourceRepoConfig();
  return getRepoRootFromConfig(sourceConfig.repoPath, "source-control app");
}

function getSourceBranchName() {
  const sourceConfig = getSourceRepoConfig();
  return getBranchNameForRepo(getSourceRepoRoot(), sourceConfig.defaultBranch, "source-control app");
}

function getDbRepoRoot() {
  const dbConfig = getDbRepoConfig();
  if (!dbConfig.repoPath && !dbConfig.remoteUrl) {
    throw new Error("Configure the DB repo path or URL in admin/.env before using DB Manager.");
  }
  if (dbConfig.remoteUrl) {
    ensureDbRepoClone(dbConfig);
  }
  const dbRepoRoot = getRepoRootFromConfig(dbConfig.repoPath, "DB manager");
  const sourceRepoRoot = getSourceRepoRoot();
  if (pathsOverlap(dbRepoRoot, sourceRepoRoot)) {
    throw new Error(
      [
        "DB Manager cannot use the same repository as the full source app.",
        `Source repo: ${sourceRepoRoot}`,
        `DB repo: ${dbRepoRoot}`,
        "Point ADMIN_DB_REPO_PATH at a separate public-data clone or GitHub repo URL.",
      ].join("\n")
    );
  }
  return dbRepoRoot;
}

function getDbBranchName() {
  const dbConfig = getDbRepoConfig();
  return getBranchNameForRepo(getDbRepoRoot(), dbConfig.defaultBranch, "DB manager");
}

function ensureDbRepoClone(dbConfig) {
  const repoPath = dbConfig?.repoPath;
  const remoteUrl = dbConfig?.remoteUrl;
  if (!repoPath || !remoteUrl) {
    return;
  }

  if (!fs.existsSync(repoPath)) {
    fs.mkdirSync(path.dirname(repoPath), { recursive: true });
    const cloneResult = runGitCommandInDirectory(path.dirname(repoPath), [
      "clone",
      remoteUrl,
      path.basename(repoPath),
    ]);
    if (!cloneResult.ok) {
      throw new Error(cloneResult.output || `Unable to clone ${remoteUrl}.`);
    }
  } else if (!isGitRepository(repoPath)) {
    const entries = fs.readdirSync(repoPath);
    if (entries.length) {
      throw new Error(
        `Configured DB repo path exists but is not a git repository: ${repoPath}. Delete that folder or point ADMIN_DB_REPO_PATH at a separate cloned public-data repo.`
      );
    }

    const cloneResult = runGitCommandInDirectory(path.dirname(repoPath), [
      "clone",
      remoteUrl,
      path.basename(repoPath),
    ]);
    if (!cloneResult.ok) {
      throw new Error(cloneResult.output || `Unable to clone ${remoteUrl}.`);
    }
  }

  ensureRepoRemoteConfigured(repoPath, dbConfig.remoteName, remoteUrl);
}

function isGitRepository(repoPath) {
  const probe = runGitCommandInDirectory(repoPath, ["rev-parse", "--show-toplevel"], {
    allowFailure: true,
  });
  return probe.ok;
}

function ensureRepoRemoteConfigured(repoRoot, remoteName, remoteUrl) {
  if (!repoRoot || !remoteName || !remoteUrl) {
    return;
  }

  const currentRemote = runGitCommandInRepo(repoRoot, ["remote", "get-url", remoteName], {
    allowFailure: true,
  });
  const hasMatchingRemote =
    currentRemote.ok &&
    normalizeRepoUrlForCompare(currentRemote.stdout) === normalizeRepoUrlForCompare(remoteUrl);

  if (hasMatchingRemote) {
    return;
  }

  const remoteCommand = currentRemote.ok
    ? ["remote", "set-url", remoteName, remoteUrl]
    : ["remote", "add", remoteName, remoteUrl];
  const result = runGitCommandInRepo(repoRoot, remoteCommand);
  if (!result.ok) {
    throw new Error(result.output || `Unable to configure ${remoteName} for ${repoRoot}.`);
  }
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
  const dbConfig = getDbRepoConfig();
  const repoRoot = getDbRepoRoot();
  const summarySync = refreshBusinessPaymentSummaries();
  const cleanupResult = removeUnexpectedDbMirrorEntries(repoRoot, dbConfig);
  const basicTargetDir = path.join(repoRoot, dbConfig.basicTargetPath);
  const detailedTargetDir = path.join(repoRoot, dbConfig.detailedTargetPath);
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
      summarySync.changed_count ? "" : null,
      summarySync.changed_count
        ? `Updated payment-derived subscription summaries: ${summarySync.touched.join(", ")}`
        : null,
      cleanupResult.removed.length ? "" : null,
      cleanupResult.removed.length
        ? `Removed unwanted public-repo entries: ${cleanupResult.removed.join(", ")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

function removeUnexpectedDbMirrorEntries(repoRoot, dbConfig) {
  const allowedTopLevelNames = new Set(
    [dbConfig?.basicTargetPath, dbConfig?.detailedTargetPath]
      .map((value) => String(value || "").split("/").map((segment) => segment.trim()).find(Boolean) || "")
      .filter(Boolean)
  );
  const removed = [];

  for (const entryName of fs.readdirSync(repoRoot)) {
    if (entryName === ".git" || allowedTopLevelNames.has(entryName)) {
      continue;
    }
    const targetPath = path.join(repoRoot, entryName);
    if (!isPathInsideBase(targetPath, repoRoot)) {
      continue;
    }
    fs.rmSync(targetPath, { recursive: true, force: true });
    removed.push(entryName);
  }

  return { removed };
}

function mirrorJsonDirectory(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const sourceFiles = fs
    .readdirSync(sourceDir)
    .filter((file) => file.toLowerCase().endsWith(".json"));
  const sourceFileSet = new Set(sourceFiles);

  let removed = 0;
  for (const targetFile of fs.readdirSync(targetDir)) {
    if (sourceFileSet.has(targetFile)) {
      continue;
    }
    fs.rmSync(path.join(targetDir, targetFile), { recursive: true, force: true });
    removed += 1;
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

function pushRepoWithLease(repoRoot, remoteName, branch, summary) {
  const fetchArgs = ["fetch", "--prune", remoteName];
  const fetchResult = runGitCommandInRepo(repoRoot, fetchArgs);
  if (!fetchResult.ok) {
    throw new Error(fetchResult.output || `$ git ${fetchArgs.join(" ")} failed.`);
  }

  const pushArgs = ["push", "--force-with-lease", remoteName, `HEAD:${branch}`];
  const pushResult = runGitCommandInRepo(repoRoot, pushArgs);
  if (!pushResult.ok) {
    throw new Error(pushResult.output || `$ git ${pushArgs.join(" ")} failed.`);
  }

  return {
    summary,
    log: [
      `$ git ${fetchArgs.join(" ")}\n${fetchResult.output || "Fetched latest remote state."}`,
      `$ git ${pushArgs.join(" ")}\n${pushResult.output || summary}`,
    ].join("\n\n"),
  };
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

function loadStaffRecords() {
  return ensureArray(readJson(STAFF_FILE, []))
    .map((item) => normalizeStaffRecord(item))
    .filter(Boolean);
}

function writeStaffRecords(records) {
  writeJson(STAFF_FILE, ensureArray(records).map((item) => normalizeStaffRecord(item)).filter(Boolean));
}

function normalizeStaffRecord(input) {
  if (!input || typeof input !== "object") {
    return null;
  }

  const paymentHistory = ensureArray(input.payment_history)
    .map((item) => normalizeStaffPaymentRecord(item))
    .filter(Boolean);
  const adjustments = ensureArray(input.adjustments)
    .map((item) => normalizeStaffAdjustmentRecord(item))
    .filter(Boolean);
  const salaryCurrency = stringOrDefault(input.salary_currency, "NPR");
  const payCycle = ["monthly", "biweekly", "weekly", "custom"].includes(String(input.pay_cycle || "").trim().toLowerCase())
    ? String(input.pay_cycle || "").trim().toLowerCase()
    : "monthly";
  const paymentDay = normalizeInteger(input.payment_day);

  return {
    id: stringOrDefault(input.id, generateId()),
    employee_code: stringOrDefault(input.employee_code),
    full_name: stringOrDefault(input.full_name),
    role: stringOrDefault(input.role),
    department: stringOrDefault(input.department),
    employment_type: stringOrDefault(input.employment_type, "Full Time"),
    status: stringOrDefault(input.status, "active").toLowerCase(),
    phone: stringOrDefault(input.phone),
    email: stringOrDefault(input.email),
    address: stringOrDefault(input.address),
    emergency_contact: stringOrDefault(input.emergency_contact),
    joined_at: normalizeDateInput(input.joined_at)?.toISOString() || "",
    salary_amount: normalizeFloat(input.salary_amount) ?? null,
    salary_currency: salaryCurrency,
    pay_cycle: payCycle,
    payment_day: paymentDay != null ? Math.max(1, Math.min(31, paymentDay)) : null,
    bank_account: stringOrDefault(input.bank_account),
    avatar_url: stringOrDefault(input.avatar_url),
    notes: stringOrDefault(input.notes),
    skills: cleanStringArray(input.skills),
    documents: cleanStringArray(input.documents),
    adjustments: sortStaffAdjustments(adjustments),
    payment_history: paymentHistory.sort((left, right) => {
      return (normalizeDateInput(right.paid_at)?.getTime() || 0) - (normalizeDateInput(left.paid_at)?.getTime() || 0);
    }),
    created_at: stringOrDefault(input.created_at),
    updated_at: stringOrDefault(input.updated_at),
  };
}

function normalizeStaffAdjustmentRecord(input) {
  if (!input || typeof input !== "object") {
    return null;
  }

  const effectiveFrom = normalizeDateInput(input.effective_from);
  if (!effectiveFrom) {
    return null;
  }

  const salaryAmount = normalizeFloat(input.salary_amount);
  const effectiveMonthStart = new Date(
    Date.UTC(effectiveFrom.getUTCFullYear(), effectiveFrom.getUTCMonth(), 1)
  );
  const nowIso = new Date().toISOString();

  return {
    id: stringOrDefault(input.id, generateId()),
    title: stringOrDefault(input.title, "Compensation Update"),
    role: stringOrDefault(input.role),
    salary_amount: Number.isFinite(salaryAmount) ? roundAmount(salaryAmount) : null,
    salary_currency: stringOrDefault(input.salary_currency, "NPR"),
    effective_from: effectiveMonthStart.toISOString(),
    notes: stringOrDefault(input.notes),
    created_at: stringOrDefault(input.created_at, nowIso),
    updated_at: stringOrDefault(input.updated_at, nowIso),
  };
}

function normalizeStaffPaymentRecord(input) {
  if (!input || typeof input !== "object") {
    return null;
  }

  const paidAt = normalizeDateInput(input.paid_at);
  return {
    id: stringOrDefault(input.id, generateId()),
    amount: normalizeFloat(input.amount) ?? null,
    currency: stringOrDefault(input.currency, "NPR"),
    paid_at: paidAt ? paidAt.toISOString() : "",
    method: stringOrDefault(input.method),
    reference: stringOrDefault(input.reference),
    notes: stringOrDefault(input.notes),
    created_at: stringOrDefault(input.created_at),
    updated_at: stringOrDefault(input.updated_at),
  };
}

function decorateStaffRecord(record) {
  const staff = normalizeStaffRecord(record);
  if (!staff) {
    return null;
  }

  const paymentHistory = ensureArray(staff.payment_history);
  const currentCompensation = resolveStaffCompensationAt(staff, new Date());
  const upcomingAdjustment = getUpcomingStaffAdjustment(staff, new Date());
  const totalPaid = paymentHistory.reduce((sum, item) => sum + (normalizeFloat(item.amount) || 0), 0);
  const lastPaymentAt = paymentHistory[0]?.paid_at || "";
  const nextPaymentDueAt = getNextStaffPaymentDue(staff, lastPaymentAt);
  const isOverdue =
    Boolean(nextPaymentDueAt) &&
    normalizeDateInput(nextPaymentDueAt)?.getTime() < Date.now() &&
    staff.status === "active";

  return {
    ...staff,
    base_role: stringOrDefault(staff.role),
    base_salary_amount: normalizeFloat(staff.salary_amount) ?? null,
    base_salary_currency: stringOrDefault(staff.salary_currency, "NPR"),
    role: currentCompensation.role,
    salary_amount: currentCompensation.salary_amount,
    salary_currency: currentCompensation.salary_currency,
    payment_history: paymentHistory,
    total_paid_amount: totalPaid,
    last_payment_at: lastPaymentAt,
    next_payment_due_at: nextPaymentDueAt,
    is_overdue: isOverdue,
    current_compensation: currentCompensation,
    upcoming_adjustment: upcomingAdjustment,
  };
}

function sortStaffAdjustments(adjustments) {
  return ensureArray(adjustments).sort((left, right) => {
    const leftTime = normalizeDateInput(left?.effective_from)?.getTime() || 0;
    const rightTime = normalizeDateInput(right?.effective_from)?.getTime() || 0;
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    return String(left?.id || "").localeCompare(String(right?.id || ""));
  });
}

function resolveStaffCompensationAt(staff, dateValue) {
  const targetDate = normalizeDateInput(dateValue) || new Date();
  const targetMonthStart = new Date(
    Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), 1)
  );
  const effective = {
    role: stringOrDefault(staff?.role),
    salary_amount: normalizeFloat(staff?.salary_amount) ?? null,
    salary_currency: stringOrDefault(staff?.salary_currency, "NPR"),
    effective_from: stringOrDefault(staff?.joined_at),
  };

  for (const adjustment of sortStaffAdjustments(staff?.adjustments || [])) {
    const adjustmentDate = normalizeDateInput(adjustment.effective_from);
    if (!adjustmentDate || adjustmentDate.getTime() > targetMonthStart.getTime()) {
      continue;
    }
    if (adjustment.role) {
      effective.role = adjustment.role;
    }
    if (normalizeFloat(adjustment.salary_amount) != null) {
      effective.salary_amount = normalizeFloat(adjustment.salary_amount);
    }
    if (adjustment.salary_currency) {
      effective.salary_currency = adjustment.salary_currency;
    }
    effective.effective_from = adjustment.effective_from;
  }

  return effective;
}

function getUpcomingStaffAdjustment(staff, dateValue) {
  const targetDate = normalizeDateInput(dateValue) || new Date();
  const targetMonthStart = new Date(
    Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), 1)
  );

  return (
    sortStaffAdjustments(staff?.adjustments || []).find((adjustment) => {
      const adjustmentDate = normalizeDateInput(adjustment.effective_from);
      return adjustmentDate && adjustmentDate.getTime() > targetMonthStart.getTime();
    }) || null
  );
}

function getNextStaffPaymentDue(staff, lastPaymentAt) {
  if (staff.status !== "active") {
    return "";
  }

  const baseDate =
    normalizeDateInput(lastPaymentAt) ||
    normalizeDateInput(staff.joined_at) ||
    new Date();

  if (staff.pay_cycle === "weekly") {
    return addDaysUtc(baseDate, 7).toISOString();
  }
  if (staff.pay_cycle === "biweekly") {
    return addDaysUtc(baseDate, 14).toISOString();
  }
  if (staff.pay_cycle === "custom") {
    return "";
  }

  const now = new Date();
  const desiredDay = Math.max(1, Math.min(31, staff.payment_day || baseDate.getUTCDate() || 1));
  let candidate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), desiredDay));
  const lastDayOfMonth = new Date(Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth() + 1, 0));
  if (desiredDay > lastDayOfMonth.getUTCDate()) {
    candidate = lastDayOfMonth;
  }
  if (candidate.getTime() <= now.getTime()) {
    candidate = addMonthsUtc(candidate, 1);
  }
  return candidate.toISOString();
}

function buildStaffSnapshot() {
  const staff = loadStaffRecords().map((item) => decorateStaffRecord(item)).filter(Boolean);
  const monthKey = new Date().toISOString().slice(0, 7);
  const payrollThisMonth = staff.reduce((sum, item) => {
    const paidThisMonth = ensureArray(item.payment_history).reduce((paymentSum, payment) => {
      return String(payment.paid_at || "").startsWith(monthKey)
        ? paymentSum + (normalizeFloat(payment.amount) || 0)
        : paymentSum;
    }, 0);
    return sum + paidThisMonth;
  }, 0);

  return {
    staff,
    stats: {
      total: staff.length,
      active: staff.filter((item) => item.status === "active").length,
      inactive: staff.filter((item) => item.status !== "active").length,
      overdue: staff.filter((item) => item.is_overdue).length,
      payroll_this_month: payrollThisMonth,
    },
  };
}

function saveStaffMember(payload) {
  const records = loadStaffRecords();
  const existing = records.find((item) => item.id === stringOrDefault(payload.id));
  const now = new Date().toISOString();
  const next = normalizeStaffRecord({
    ...(existing || {}),
    ...(payload || {}),
    id: existing?.id || stringOrDefault(payload.id, generateId()),
    created_at: existing?.created_at || now,
    updated_at: now,
    adjustments: existing?.adjustments || [],
    payment_history: existing?.payment_history || [],
  });

  if (!next?.full_name) {
    throw new Error("Staff member name is required.");
  }
  if (!next.role) {
    throw new Error("Staff role is required.");
  }

  const filtered = records.filter((item) => item.id !== next.id);
  filtered.push(next);
  writeStaffRecords(filtered);
  return buildStaffSnapshot();
}

function removeStaffMember(idValue) {
  const id = stringOrDefault(idValue);
  if (!id) {
    throw new Error("Staff id is required.");
  }
  writeStaffRecords(loadStaffRecords().filter((item) => item.id !== id));
  return buildStaffSnapshot();
}

function saveStaffPaymentRecord(staffIdValue, payload) {
  const staffId = stringOrDefault(staffIdValue);
  if (!staffId) {
    throw new Error("Staff id is required.");
  }

  const records = loadStaffRecords();
  const staff = records.find((item) => item.id === staffId);
  if (!staff) {
    throw new Error("Staff member not found.");
  }
  const existingPayment = ensureArray(staff.payment_history).find((item) => item.id === stringOrDefault(payload.id));
  const effectiveCompensation = resolveStaffCompensationAt(
    staff,
    payload?.paid_at || existingPayment?.paid_at || new Date()
  );

  const now = new Date().toISOString();
  const nextPayment = normalizeStaffPaymentRecord({
    ...(existingPayment || {}),
    ...(payload || {}),
    id: stringOrDefault(payload.id, generateId()),
    amount:
      normalizeFloat(payload?.amount) ??
      normalizeFloat(existingPayment?.amount) ??
      normalizeFloat(effectiveCompensation.salary_amount),
    currency: stringOrDefault(
      payload?.currency,
      existingPayment?.currency || effectiveCompensation.salary_currency || "NPR"
    ),
    created_at: existingPayment?.created_at || now,
    updated_at: now,
  });

  if ((normalizeFloat(nextPayment.amount) || 0) <= 0) {
    throw new Error("Payment amount must be greater than 0.");
  }
  if (!nextPayment.paid_at) {
    throw new Error("Payment date is required.");
  }

  staff.payment_history = ensureArray(staff.payment_history).filter((item) => item.id !== nextPayment.id);
  staff.payment_history.push(nextPayment);
  staff.updated_at = now;
  writeStaffRecords(records);
  return buildStaffSnapshot();
}

function deleteStaffPaymentRecord(staffIdValue, paymentIdValue) {
  const staffId = stringOrDefault(staffIdValue);
  const paymentId = stringOrDefault(paymentIdValue);
  const records = loadStaffRecords();
  const staff = records.find((item) => item.id === staffId);
  if (!staff) {
    throw new Error("Staff member not found.");
  }

  staff.payment_history = ensureArray(staff.payment_history).filter((item) => item.id !== paymentId);
  staff.updated_at = new Date().toISOString();
  writeStaffRecords(records);
  return buildStaffSnapshot();
}

function saveStaffAdjustmentRecord(staffIdValue, payload) {
  const staffId = stringOrDefault(staffIdValue);
  if (!staffId) {
    throw new Error("Staff id is required.");
  }

  const records = loadStaffRecords();
  const staff = records.find((item) => item.id === staffId);
  if (!staff) {
    throw new Error("Staff member not found.");
  }

  const existingAdjustment = ensureArray(staff.adjustments).find(
    (item) => item.id === stringOrDefault(payload.id)
  );
  const nextMonthStart = new Date();
  nextMonthStart.setUTCDate(1);
  nextMonthStart.setUTCMonth(nextMonthStart.getUTCMonth() + 1);
  const effectiveFrom =
    normalizeDateInput(payload.effective_from) ||
    new Date(Date.UTC(nextMonthStart.getUTCFullYear(), nextMonthStart.getUTCMonth(), 1));
  const normalizedEffective = new Date(
    Date.UTC(effectiveFrom.getUTCFullYear(), effectiveFrom.getUTCMonth(), 1)
  );
  const currentMonthStart = new Date();
  currentMonthStart.setUTCDate(1);
  currentMonthStart.setUTCHours(0, 0, 0, 0);
  if (normalizedEffective.getTime() <= currentMonthStart.getTime()) {
    throw new Error("Promotions and increments must start from the next month.");
  }

  const now = new Date().toISOString();
  const nextAdjustment = normalizeStaffAdjustmentRecord({
    ...(existingAdjustment || {}),
    ...(payload || {}),
    id: stringOrDefault(payload.id, generateId()),
    effective_from: normalizedEffective.toISOString(),
    created_at: existingAdjustment?.created_at || now,
    updated_at: now,
  });
  if (!nextAdjustment) {
    throw new Error("A valid effective month is required.");
  }
  if (!nextAdjustment.role && normalizeFloat(nextAdjustment.salary_amount) == null) {
    throw new Error("Provide a new role, a new salary, or both.");
  }

  staff.adjustments = sortStaffAdjustments(
    [...ensureArray(staff.adjustments).filter((item) => item.id !== nextAdjustment.id), nextAdjustment]
  );
  staff.updated_at = now;
  writeStaffRecords(records);
  return buildStaffSnapshot();
}

function deleteStaffAdjustmentRecord(staffIdValue, adjustmentIdValue) {
  const staffId = stringOrDefault(staffIdValue);
  const adjustmentId = stringOrDefault(adjustmentIdValue);
  const records = loadStaffRecords();
  const staff = records.find((item) => item.id === staffId);
  if (!staff) {
    throw new Error("Staff member not found.");
  }

  staff.adjustments = sortStaffAdjustments(
    ensureArray(staff.adjustments).filter((item) => item.id !== adjustmentId)
  );
  staff.updated_at = new Date().toISOString();
  writeStaffRecords(records);
  return buildStaffSnapshot();
}

function formatStaffStatementCurrency(amount, currency = "NPR") {
  const normalized = normalizeFloat(amount);
  if (normalized == null) {
    return "Not set";
  }
  return `${stringOrDefault(currency, "NPR")} ${roundAmount(normalized).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatStaffStatementCurrencyBreakdown(breakdown = {}) {
  const entries = Object.entries(breakdown || {}).filter(([, amount]) => (normalizeFloat(amount) || 0) > 0);
  if (!entries.length) {
    return "No payments";
  }
  return entries.map(([currency, amount]) => formatStaffStatementCurrency(amount, currency)).join(" · ");
}

function buildStaffStatementFilename(staffValue, extension = "pdf") {
  const normalizedExtension = String(extension || "pdf").trim().toLowerCase() === "txt" ? "txt" : "pdf";
  const base =
    stringOrDefault(staffValue?.full_name) ||
    stringOrDefault(staffValue?.employee_code) ||
    stringOrDefault(staffValue?.id, "staff-payroll-statement");
  const safeBase = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "staff-payroll-statement";
  return `${safeBase}-payroll-statement.${normalizedExtension}`;
}

function buildStaffStatementDetails(staffIdValue) {
  const staffId = stringOrDefault(staffIdValue);
  if (!staffId) {
    const error = new Error("Staff id is required.");
    error.statusCode = 400;
    throw error;
  }

  const rawStaff = loadStaffRecords().find((item) => item.id === staffId) || null;
  if (!rawStaff) {
    const error = new Error("Staff member not found.");
    error.statusCode = 404;
    throw error;
  }

  const staff = decorateStaffRecord(rawStaff);
  const paymentEntries = ensureArray(rawStaff.payment_history)
    .map((item) => normalizeStaffPaymentRecord(item))
    .filter(Boolean)
    .sort((left, right) => {
      return (normalizeDateInput(right.paid_at)?.getTime() || 0) - (normalizeDateInput(left.paid_at)?.getTime() || 0);
    })
    .map((payment) => ({
      ...payment,
      compensation: resolveStaffCompensationAt(rawStaff, payment.paid_at || new Date()),
    }));

  const totalsByCurrency = {};
  const monthlyMap = new Map();
  for (const entry of paymentEntries) {
    const currency = stringOrDefault(entry.currency, entry.compensation?.salary_currency || "NPR");
    const amount = normalizeFloat(entry.amount) || 0;
    totalsByCurrency[currency] = (totalsByCurrency[currency] || 0) + amount;

    const monthKey = String(entry.paid_at || "").slice(0, 7);
    if (!monthKey) {
      continue;
    }
    const month = monthlyMap.get(monthKey) || {
      key: monthKey,
      totals_by_currency: {},
      payment_count: 0,
      methods: new Set(),
      roles: new Set(),
      latest_paid_at: "",
    };
    month.totals_by_currency[currency] = (month.totals_by_currency[currency] || 0) + amount;
    month.payment_count += 1;
    if (entry.method) {
      month.methods.add(entry.method);
    }
    if (entry.compensation?.role) {
      month.roles.add(entry.compensation.role);
    }
    if (!month.latest_paid_at || (normalizeDateInput(entry.paid_at)?.getTime() || 0) > (normalizeDateInput(month.latest_paid_at)?.getTime() || 0)) {
      month.latest_paid_at = entry.paid_at || month.latest_paid_at;
    }
    monthlyMap.set(monthKey, month);
  }

  const monthlyLedger = [...monthlyMap.values()]
    .sort((left, right) => right.key.localeCompare(left.key))
    .map((month) => ({
      ...month,
      methods: [...month.methods],
      roles: [...month.roles],
    }));

  return {
    staff,
    filename: buildStaffStatementFilename(staff),
    generated_at: new Date().toISOString(),
    current_compensation: resolveStaffCompensationAt(rawStaff, new Date()),
    upcoming_adjustment: getUpcomingStaffAdjustment(rawStaff, new Date()),
    payment_entries: paymentEntries,
    monthly_ledger: monthlyLedger,
    totals: {
      by_currency: totalsByCurrency,
      payment_count: paymentEntries.length,
      last_paid_at: paymentEntries[0]?.paid_at || "",
      total_paid_amount: paymentEntries.reduce((sum, entry) => sum + (normalizeFloat(entry.amount) || 0), 0),
    },
  };
}

function renderStaffStatementPdf(doc, details) {
  const margin = 38;
  const contentWidth = doc.page.width - margin * 2;
  const pageBottom = doc.page.height - margin;
  const staff = details.staff || {};
  const summaryBoxes = [
    ["Employee", stringOrDefault(staff.full_name, "Staff Member")],
    ["Employee Code", stringOrDefault(staff.employee_code, "Not set")],
    ["Department", stringOrDefault(staff.department, "Not set")],
    ["Current Role", stringOrDefault(details.current_compensation?.role || staff.role, "Role not set")],
    ["Current Salary", formatStaffStatementCurrency(details.current_compensation?.salary_amount, details.current_compensation?.salary_currency || staff.salary_currency || "NPR")],
    ["Next Payment Due", formatIsoDateLabel(staff.next_payment_due_at, "Not scheduled")],
    ["Total Paid", formatStaffStatementCurrencyBreakdown(details.totals?.by_currency || {})],
    ["Payments Recorded", String(details.totals?.payment_count || 0)],
  ];
  let y = margin;

  function drawPageHeader() {
    doc.save();
    doc.roundedRect(margin, margin, contentWidth, 86, 16).fillAndStroke("#eef4ff", "#9ebde5");
    doc.fillColor("#1952a8").font("Helvetica-Bold").fontSize(22).text("Payroll Statement", margin + 18, margin + 16);
    doc.fillColor("#4b6485").font("Helvetica").fontSize(11).text(
      `Generated ${formatIsoDateLabel(details.generated_at, new Date().toISOString().slice(0, 10))}`,
      margin + 18,
      margin + 48
    );
    doc.fillColor("#14304d").font("Helvetica-Bold").fontSize(14).text(
      stringOrDefault(staff.full_name, "Staff Member"),
      margin + 18,
      margin + 63
    );
    doc.restore();
    y = margin + 108;
  }

  function ensureSpace(height, includeTableHeader = false) {
    if (y + height <= pageBottom) {
      return;
    }
    doc.addPage();
    drawPageHeader();
    if (includeTableHeader) {
      drawTableHeader();
    }
  }

  function drawSummaryGrid() {
    const columns = 2;
    const boxGap = 10;
    const boxWidth = (contentWidth - boxGap) / columns;
    const boxHeight = 52;
    for (let index = 0; index < summaryBoxes.length; index += 1) {
      if (index > 0 && index % columns === 0) {
        y += boxHeight + boxGap;
      }
      const column = index % columns;
      const boxX = margin + column * (boxWidth + boxGap);
      const [label, value] = summaryBoxes[index];
      doc.roundedRect(boxX, y, boxWidth, boxHeight, 12).fillAndStroke("#fbfdff", "#c5d8f3");
      doc.fillColor("#6d8098").font("Helvetica").fontSize(10).text(label, boxX + 12, y + 10, { width: boxWidth - 24 });
      doc.fillColor("#163d77").font("Helvetica-Bold").fontSize(12).text(value, boxX + 12, y + 25, {
        width: boxWidth - 24,
        height: 20,
        ellipsis: true,
      });
    }
    y += Math.ceil(summaryBoxes.length / columns) * (boxHeight + boxGap);
  }
  function drawUpcomingChange() {
    const upcoming = details.upcoming_adjustment;
    const copy = upcoming
      ? `${stringOrDefault(upcoming.title, "Scheduled change")} · ${formatIsoDateLabel(upcoming.effective_from)} · ${stringOrDefault(upcoming.role, staff.role || "Role unchanged")} · ${formatStaffStatementCurrency(upcoming.salary_amount, upcoming.salary_currency || staff.salary_currency || "NPR")}`
      : "No future promotion or increment is scheduled.";
    ensureSpace(48);
    doc.roundedRect(margin, y, contentWidth, 40, 12).fillAndStroke("#f8fbff", "#c5d8f3");
    doc.fillColor("#6d8098").font("Helvetica").fontSize(10).text("Upcoming Change", margin + 12, y + 8);
    doc.fillColor("#163d77").font("Helvetica-Bold").fontSize(11).text(copy, margin + 12, y + 20, {
      width: contentWidth - 24,
      ellipsis: true,
    });
    y += 58;
  }

  function drawSectionTitle(label) {
    ensureSpace(28);
    doc.fillColor("#1952a8").font("Helvetica-Bold").fontSize(13).text(label, margin, y, { width: contentWidth });
    y += 20;
  }

  function drawTableHeader() {
    const columns = [
      { label: "Date", width: 70 },
      { label: "Paid", width: 86 },
      { label: "Salary Basis", width: 96 },
      { label: "Role", width: 118 },
      { label: "Method / Reference / Notes", width: contentWidth - (70 + 86 + 96 + 118) },
    ];
    doc.roundedRect(margin, y, contentWidth, 24, 10).fill("#1952a8");
    let x = margin + 10;
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(10);
    for (const column of columns) {
      doc.text(column.label, x, y + 7, { width: column.width - 10, ellipsis: true });
      x += column.width;
    }
    y += 30;
  }

  function drawPaymentRows() {
    const entries = details.payment_entries || [];
    if (!entries.length) {
      ensureSpace(48);
      doc.roundedRect(margin, y, contentWidth, 42, 12).fillAndStroke("#fbfdff", "#d2dceb");
      doc.fillColor("#6d8098").font("Helvetica").fontSize(11).text(
        "No payroll payments have been recorded for this staff member yet.",
        margin + 12,
        y + 15,
        { width: contentWidth - 24 }
      );
      y += 52;
      return;
    }

    drawTableHeader();
    const widths = [70, 86, 96, 118, contentWidth - (70 + 86 + 96 + 118)];
    for (const entry of entries) {
      const amountLabel = formatStaffStatementCurrency(entry.amount, entry.currency || entry.compensation?.salary_currency || staff.salary_currency || "NPR");
      const salaryBasisLabel = formatStaffStatementCurrency(
        entry.compensation?.salary_amount,
        entry.compensation?.salary_currency || staff.salary_currency || "NPR"
      );
      const roleLabel = stringOrDefault(entry.compensation?.role, staff.role || "Role unchanged");
      const metaLabel = [stringOrDefault(entry.method, "Method not set"), stringOrDefault(entry.reference), stringOrDefault(entry.notes)]
        .filter(Boolean)
        .join(" · ");
      const roleHeight = doc.heightOfString(roleLabel, { width: widths[3] - 12 });
      const metaHeight = doc.heightOfString(metaLabel || "No reference", { width: widths[4] - 12 });
      const rowHeight = Math.max(30, roleHeight, metaHeight) + 12;
      ensureSpace(rowHeight + 8, true);
      doc.roundedRect(margin, y, contentWidth, rowHeight, 10).fillAndStroke("#ffffff", "#d8dee8");
      let x = margin + 10;
      doc.fillColor("#1c3658").font("Helvetica-Bold").fontSize(10).text(formatIsoDateLabel(entry.paid_at), x, y + 8, {
        width: widths[0] - 10,
      });
      x += widths[0];
      doc.font("Helvetica-Bold").text(amountLabel, x, y + 8, { width: widths[1] - 10 });
      x += widths[1];
      doc.font("Helvetica").text(salaryBasisLabel, x, y + 8, { width: widths[2] - 10 });
      x += widths[2];
      doc.font("Helvetica").text(roleLabel, x, y + 8, { width: widths[3] - 12 });
      x += widths[3];
      doc.fillColor("#4b6485").text(metaLabel || "No reference", x, y + 8, { width: widths[4] - 12 });
      y += rowHeight + 8;
    }
  }

  drawPageHeader();
  drawSummaryGrid();
  drawUpcomingChange();
  drawSectionTitle("Payment Entries");
  drawPaymentRows();
}

function buildStaffStatementPdfBuffer(details) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "portrait",
      margin: 0,
      compress: true,
      info: {
        Title: `Payroll statement for ${stringOrDefault(details?.staff?.full_name, details?.staff?.id)}`,
        Author: "EduData Nepal Admin",
        Subject: "Staff payroll statement",
      },
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      renderStaffStatementPdf(doc, details);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function loadCalendarEvents() {
  return ensureArray(readJson(CALENDAR_EVENTS_FILE, []))
    .map((item) => normalizeCalendarEvent(item))
    .filter(Boolean);
}

function writeCalendarEvents(events) {
  writeJson(CALENDAR_EVENTS_FILE, ensureArray(events).map((item) => normalizeCalendarEvent(item)).filter(Boolean));
}

function normalizeCalendarEvent(input) {
  if (!input || typeof input !== "object") {
    return null;
  }

  const date = normalizeDateInput(input.date);
  return {
    id: stringOrDefault(input.id, generateId()),
    title: stringOrDefault(input.title),
    category: stringOrDefault(input.category, "reminder"),
    date: date ? date.toISOString() : "",
    notes: stringOrDefault(input.notes),
    source: stringOrDefault(input.source, "custom"),
    source_id: stringOrDefault(input.source_id),
    created_at: stringOrDefault(input.created_at),
    updated_at: stringOrDefault(input.updated_at),
  };
}

function buildAutomaticCalendarEvents() {
  const businessEvents = getAdminDirectoryList()
    .filter((business) => business.subscription?.expires_at)
    .map((business) => ({
      id: `biz:${business.slug}`,
      title: `${business.name} renewal due`,
      category: "business-renewal",
      date: business.subscription.expires_at,
      notes: `${business.location_full_label || business.location_label || "No location"} · ${business.subscription?.plan || DEFAULT_SUBSCRIPTION_PLAN}`,
      source: "business",
      source_id: business.slug,
    }));

  const staffEvents = buildStaffSnapshot().staff
    .filter((staff) => staff.next_payment_due_at)
    .map((staff) => ({
      id: `staff:${staff.id}`,
      title: `${staff.full_name} payroll due`,
      category: "staff-payroll",
      date: staff.next_payment_due_at,
      notes: `${staff.role || "Staff"} · ${staff.department || "No department"}`,
      source: "staff",
      source_id: staff.id,
    }));

  return [...businessEvents, ...staffEvents]
    .map((item) => normalizeCalendarEvent(item))
    .filter(Boolean);
}

function buildCalendarSnapshot() {
  const customEvents = loadCalendarEvents();
  const automaticEvents = buildAutomaticCalendarEvents();
  const events = [...automaticEvents, ...customEvents].sort((left, right) => {
    return (normalizeDateInput(left.date)?.getTime() || 0) - (normalizeDateInput(right.date)?.getTime() || 0);
  });

  return {
    today: new Date().toISOString(),
    custom_events: customEvents,
    automatic_events: automaticEvents,
    events,
    stats: {
      total: events.length,
      custom: customEvents.length,
      automatic: automaticEvents.length,
    },
  };
}

function saveCalendarEvent(payload) {
  const records = loadCalendarEvents();
  const existing = records.find((item) => item.id === stringOrDefault(payload.id));
  const now = new Date().toISOString();
  const next = normalizeCalendarEvent({
    ...(existing || {}),
    ...(payload || {}),
    id: existing?.id || stringOrDefault(payload.id, generateId()),
    source: "custom",
    created_at: existing?.created_at || now,
    updated_at: now,
  });

  if (!next?.title) {
    throw new Error("Calendar title is required.");
  }
  if (!next.date) {
    throw new Error("Calendar date is required.");
  }

  const filtered = records.filter((item) => item.id !== next.id);
  filtered.push(next);
  writeCalendarEvents(filtered);
  return buildCalendarSnapshot();
}

function removeCalendarEvent(idValue) {
  const id = stringOrDefault(idValue);
  writeCalendarEvents(loadCalendarEvents().filter((item) => item.id !== id));
  return buildCalendarSnapshot();
}

function loadIdCardRecords() {
  return ensureArray(readJson(ID_CARDS_FILE, []))
    .map((item) => normalizeIdCardRecord(item))
    .filter(Boolean);
}

function writeIdCardRecords(records) {
  writeJson(
    ID_CARDS_FILE,
    ensureArray(records)
      .map((item) => normalizeIdCardRecord(item))
      .filter(Boolean)
  );
}

function normalizeIdCardPhoto(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  if (/^data:image\//i.test(text) || /^https?:\/\//i.test(text)) {
    return text;
  }
  return "";
}

function normalizeIdCardPhotoCrop(value) {
  const raw = value && typeof value === "object" ? value : {};
  const zoom = normalizeFloat(raw.zoom ?? raw.scale);
  const offsetX = normalizeFloat(raw.offset_x ?? raw.offsetX);
  const offsetY = normalizeFloat(raw.offset_y ?? raw.offsetY);
  return {
    zoom: Math.min(2.4, Math.max(1, zoom ?? 1)),
    offset_x: Math.min(1, Math.max(-1, offsetX ?? 0)),
    offset_y: Math.min(1, Math.max(-1, offsetY ?? 0)),
  };
}

function buildRegistrationId(slug, createdAt = new Date().toISOString()) {
  const issueDate = normalizeDateInput(createdAt) || new Date();
  const prefix =
    sanitizeSlug(slug)
      .replace(/-/g, "")
      .toUpperCase()
      .slice(0, 4) || "SCHL";
  const suffix =
    generateId()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 4) || "0001";
  return `EDN-${issueDate.getUTCFullYear()}-${prefix}-${suffix}`;
}

function normalizeIdCardRecord(input, options = {}) {
  if (!input || typeof input !== "object") {
    return null;
  }

  const slug = sanitizeSlug(input.slug);
  if (!slug) {
    return null;
  }

  const createdAt = stringOrDefault(input.created_at, new Date().toISOString());
  const issueDate = normalizeDateInput(input.issue_date || createdAt) || new Date();
  const updatedAt = stringOrDefault(input.updated_at, new Date().toISOString());
  const canonicalSource = options.business
    ? { ...input, ...options.business, slug }
    : { ...input, slug };

  return {
    slug,
    registration_id: getCanonicalBusinessRegistrationId(canonicalSource, createdAt),
    issue_date: issueDate.toISOString(),
    head_name: stringOrDefault(input.head_name),
    head_title: stringOrDefault(input.head_title),
    head_photo: normalizeIdCardPhoto(input.head_photo),
    head_photo_crop: normalizeIdCardPhotoCrop(input.head_photo_crop),
    notes: stringOrDefault(input.notes),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function getExistingIdCardRecord(slugValue) {
  const slug = sanitizeSlug(slugValue);
  if (!slug) {
    return null;
  }

  return loadIdCardRecords().find((item) => item.slug === slug) || null;
}

function buildIdCardDraftRecord(business, payload = {}, options = {}) {
  const now = stringOrDefault(options.now, new Date().toISOString());
  const existing = options.existing || null;
  return normalizeIdCardRecord(
    {
      ...(existing || {}),
      ...(payload || {}),
      slug: business.slug,
      issue_date: payload?.issue_date || existing?.issue_date || now,
      created_at: existing?.created_at || now,
      updated_at: now,
    },
    { business }
  );
}

function ensureBusinessIdCardRecord(slugValue, options = {}) {
  const slug = sanitizeSlug(slugValue);
  const business = options.business || getAdminDirectoryList().find((item) => item.slug === slug) || null;
  if (!slug || !business) {
    return null;
  }

  const records = loadIdCardRecords();
  const existing = records.find((item) => item.slug === slug) || null;
  if (existing) {
    const canonicalId = getCanonicalBusinessRegistrationId(business, existing.created_at);
    if (existing.registration_id === canonicalId) {
      return existing;
    }

    const nextRecord = normalizeIdCardRecord(
      {
        ...existing,
        registration_id: canonicalId,
      },
      { business }
    );
    const nextRecords = records.filter((item) => item.slug !== slug);
    nextRecords.push(nextRecord);
    writeIdCardRecords(nextRecords);
    return nextRecord;
  }

  const nextRecord = buildIdCardDraftRecord(
    business,
    {
      head_name: stringOrDefault(options.head_name),
      head_title: stringOrDefault(options.head_title),
      head_photo: stringOrDefault(options.head_photo),
      notes: stringOrDefault(options.notes),
    },
    {
      now: new Date().toISOString(),
    }
  );
  records.push(nextRecord);
  writeIdCardRecords(records);
  return nextRecord;
}

function buildIdCardPreview(payload) {
  const slug = sanitizeSlug(payload?.slug);
  const business = getAdminDirectoryList().find((item) => item.slug === slug) || null;
  if (!slug || !business) {
    const error = new Error("Business not found.");
    error.statusCode = 404;
    throw error;
  }

  const record = buildIdCardDraftRecord(business, payload, {
    existing: getExistingIdCardRecord(slug),
  });
  return {
    business,
    card: record,
    svg: buildBusinessIdCardSvg(business, record),
    filename: buildBusinessIdCardFilename(slug),
  };
}

function saveBusinessIdCard(payload) {
  const slug = sanitizeSlug(payload?.slug);
  const business = getAdminDirectoryList().find((item) => item.slug === slug) || null;
  if (!slug || !business) {
    const error = new Error("Business not found.");
    error.statusCode = 404;
    throw error;
  }

  const records = loadIdCardRecords();
  const existing = records.find((item) => item.slug === slug) || null;
  const nextRecord = buildIdCardDraftRecord(business, payload || {}, {
    existing,
    now: new Date().toISOString(),
  });

  const nextRecords = records.filter((item) => item.slug !== slug);
  nextRecords.push(nextRecord);
  writeIdCardRecords(nextRecords);
  return getBusinessIdCardDetails(slug, { business, createIfMissing: false });
}

function formatIsoDateLabel(value, fallback = "Pending") {
  const date = normalizeDateInput(value);
  return date ? date.toISOString().slice(0, 10) : fallback;
}

function buildIdCardStatusLabel(status) {
  switch (String(status || "").toLowerCase()) {
    case "active":
      return "Active";
    case "expired":
      return "Expired";
    case "pending":
      return "Pending";
    default:
      return "Unknown";
  }
}

function escapeSvgText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeSvgAttribute(value) {
  return escapeSvgText(value).replaceAll("\n", "&#10;");
}

function buildIdCardPalette(status) {
  if (status === "active") {
    return {
      primary: "#114e84",
      accent: "#1d7f4f",
      glow: "#dff3ff",
      badge: "#d6f6e3",
      badge_text: "#175636",
    };
  }
  if (status === "expired") {
    return {
      primary: "#7a1d1d",
      accent: "#bd6a12",
      glow: "#ffe8d7",
      badge: "#ffe4cf",
      badge_text: "#7f3c00",
    };
  }
  return {
    primary: "#575757",
    accent: "#4f6d8c",
    glow: "#eef3f8",
    badge: "#e3ebf4",
    badge_text: "#284a68",
  };
}

function buildIdCardPhotoTransform(frame, cropValue) {
  const crop = normalizeIdCardPhotoCrop(cropValue);
  const centerX = frame.x + frame.width / 2;
  const centerY = frame.y + frame.height / 2;
  const shiftX = crop.offset_x * frame.width * 0.18 * crop.zoom;
  const shiftY = crop.offset_y * frame.height * 0.18 * crop.zoom;
  return `translate(${shiftX.toFixed(2)} ${shiftY.toFixed(2)}) translate(${centerX.toFixed(2)} ${centerY.toFixed(2)}) scale(${crop.zoom.toFixed(2)}) translate(${-centerX.toFixed(2)} ${-centerY.toFixed(2)})`;
}

function buildIdCardHeadshot(record, business, palette) {
  const frame = {
    x: 832,
    y: 152,
    width: 210,
    height: 244,
  };
  const photo = stringOrDefault(record?.head_photo);
  if (photo) {
    return `
      <defs>
        <clipPath id="headshotClip">
          <rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" rx="28" ry="28" />
        </clipPath>
      </defs>
      <rect x="820" y="140" width="234" height="268" rx="34" ry="34" fill="#ffffff" opacity="0.95" />
      <image
        href="${escapeSvgAttribute(photo)}"
        x="${frame.x}"
        y="${frame.y}"
        width="${frame.width}"
        height="${frame.height}"
        preserveAspectRatio="xMidYMid slice"
        transform="${buildIdCardPhotoTransform(frame, record?.head_photo_crop)}"
        clip-path="url(#headshotClip)"
      />
    `;
  }

  const initials = escapeSvgText(
    (stringOrDefault(record?.head_name) || stringOrDefault(business?.name, "School"))
      .split(/\s+/)
      .map((part) => part.slice(0, 1).toUpperCase())
      .slice(0, 2)
      .join("") || "ID"
  );
  return `
    <rect x="820" y="140" width="234" height="268" rx="34" ry="34" fill="#ffffff" opacity="0.92" />
    <rect x="832" y="152" width="210" height="244" rx="28" ry="28" fill="${palette.glow}" />
    <circle cx="937" cy="230" r="54" fill="${palette.primary}" opacity="0.14" />
    <text x="937" y="247" text-anchor="middle" font-family="'Segoe UI', sans-serif" font-size="52" font-weight="700" fill="${palette.primary}">${initials}</text>
    <text x="937" y="330" text-anchor="middle" font-family="'Segoe UI', sans-serif" font-size="15" fill="#52606d">Head photo not uploaded</text>
  `;
}

function buildBusinessIdCardSvg(business, record) {
  const status = stringOrDefault(business?.subscription?.payment_status, "pending").toLowerCase();
  const palette = buildIdCardPalette(status);
  const planLabel = escapeSvgText(stringOrDefault(business?.subscription?.plan, "Pending"));
  const schoolName = escapeSvgText(stringOrDefault(business?.name, business?.slug || "Registered School"));
  const location = escapeSvgText(
    stringOrDefault(business?.location_full_label, business?.location_label || "No location saved")
  );
  const statusLabel = escapeSvgText(buildIdCardStatusLabel(status));
  const expiryLabel = escapeSvgText(formatIsoDateLabel(business?.subscription?.expires_at, "Pending payment"));
  const issueDate = escapeSvgText(formatIsoDateLabel(record?.issue_date, new Date().toISOString().slice(0, 10)));
  const registrationId = escapeSvgText(stringOrDefault(record?.registration_id));
  const headName = escapeSvgText(stringOrDefault(record?.head_name, "Head details pending"));
  const headTitle = escapeSvgText(stringOrDefault(record?.head_title, "Head of Institution"));
  const slugLabel = escapeSvgText(stringOrDefault(business?.slug));
  const emailLabel = escapeSvgText(stringOrDefault(business?.contact?.email, "No email saved"));

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720" role="img" aria-label="Registration ID card for ${schoolName}">
  <defs>
    <linearGradient id="cardBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.primary}" />
      <stop offset="100%" stop-color="${palette.accent}" />
    </linearGradient>
    <linearGradient id="cardGlow" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.24" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.08" />
    </linearGradient>
  </defs>
  <rect width="1200" height="720" rx="44" ry="44" fill="url(#cardBg)" />
  <rect x="22" y="22" width="1156" height="676" rx="34" ry="34" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="2" />
  <rect x="58" y="58" width="1084" height="604" rx="34" ry="34" fill="url(#cardGlow)" />
  <text x="84" y="118" font-family="'Segoe UI', sans-serif" font-size="26" letter-spacing="4" fill="#e6f3ff">EDUDATA NEPAL</text>
  <text x="84" y="168" font-family="'Segoe UI', sans-serif" font-size="54" font-weight="700" fill="#ffffff">Proof Of Registration</text>
  <text x="84" y="212" font-family="'Segoe UI', sans-serif" font-size="22" fill="#dce8f4">Printable registration card for the registered school record.</text>

  <rect x="84" y="236" width="700" height="360" rx="32" ry="32" fill="#ffffff" opacity="0.96" />
  <text x="118" y="304" font-family="'Segoe UI', sans-serif" font-size="20" fill="#46617a">School</text>
  <text x="118" y="348" font-family="'Segoe UI', sans-serif" font-size="38" font-weight="700" fill="#14304d">${schoolName}</text>
  <text x="118" y="386" font-family="'Segoe UI', sans-serif" font-size="20" fill="#46617a">${location}</text>

  <text x="118" y="458" font-family="'Segoe UI', sans-serif" font-size="18" fill="#68798c">Registration ID</text>
  <text x="118" y="490" font-family="'Segoe UI', monospace" font-size="28" font-weight="700" fill="${palette.primary}">${registrationId}</text>

  <text x="118" y="534" font-family="'Segoe UI', sans-serif" font-size="18" fill="#68798c">Directory Slug</text>
  <text x="118" y="564" font-family="'Segoe UI', monospace" font-size="24" fill="#14304d">${slugLabel}</text>

  <text x="430" y="458" font-family="'Segoe UI', sans-serif" font-size="18" fill="#68798c">Payment Plan</text>
  <text x="430" y="490" font-family="'Segoe UI', sans-serif" font-size="24" font-weight="700" fill="#14304d">${planLabel}</text>

  <text x="430" y="534" font-family="'Segoe UI', sans-serif" font-size="18" fill="#68798c">Registered Email</text>
  <text x="430" y="564" font-family="'Segoe UI', sans-serif" font-size="20" fill="#14304d">${emailLabel}</text>

  <rect x="812" y="438" width="242" height="54" rx="27" ry="27" fill="${palette.badge}" />
  <text x="933" y="472" text-anchor="middle" font-family="'Segoe UI', sans-serif" font-size="24" font-weight="700" fill="${palette.badge_text}">${statusLabel}</text>

  <text x="812" y="534" font-family="'Segoe UI', sans-serif" font-size="18" fill="#ffffff">Expires</text>
  <text x="812" y="566" font-family="'Segoe UI', sans-serif" font-size="24" font-weight="700" fill="#ffffff">${expiryLabel}</text>

  ${buildIdCardHeadshot(record, business, palette)}

  <text x="84" y="618" font-family="'Segoe UI', sans-serif" font-size="18" fill="#dce8f4">Issued</text>
  <text x="84" y="648" font-family="'Segoe UI', sans-serif" font-size="24" font-weight="700" fill="#ffffff">${issueDate}</text>

  <text x="280" y="618" font-family="'Segoe UI', sans-serif" font-size="18" fill="#dce8f4">Head Of Institution</text>
  <text x="280" y="648" font-family="'Segoe UI', sans-serif" font-size="24" font-weight="700" fill="#ffffff">${headName}</text>
  <text x="280" y="678" font-family="'Segoe UI', sans-serif" font-size="18" fill="#dce8f4">${headTitle}</text>
</svg>`;
}

function buildBusinessIdCardFilename(slugValue, extension = "pdf") {
  const slug = sanitizeSlug(slugValue) || "school";
  const normalizedExtension = String(extension || "pdf").trim().toLowerCase() === "svg" ? "svg" : "pdf";
  return `${slug}-registration-id-card.${normalizedExtension}`;
}

function isSupportedPdfImageMime(mimeType) {
  const normalized = String(mimeType || "").trim().toLowerCase();
  return normalized === "image/png" || normalized === "image/jpeg" || normalized === "image/jpg";
}

function parseIdCardDataUri(value) {
  const match = String(value || "").trim().match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) {
    return null;
  }

  const mimeType = String(match[1] || "").toLowerCase();
  if (!isSupportedPdfImageMime(mimeType)) {
    return null;
  }

  try {
    return {
      mimeType,
      buffer: Buffer.from(match[2].replace(/\s+/g, ""), "base64"),
    };
  } catch {
    return null;
  }
}

function fetchBinaryFromUrl(urlValue, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const targetUrl = String(urlValue || "").trim();
    if (!targetUrl) {
      reject(new Error("Image URL is empty."));
      return;
    }

    const client = targetUrl.startsWith("https://") ? https : http;
    const request = client.get(targetUrl, (response) => {
      const statusCode = normalizeInteger(response.statusCode) || 0;
      if (
        statusCode >= 300 &&
        statusCode < 400 &&
        response.headers.location &&
        redirectCount < 3
      ) {
        const redirectUrl = new URL(response.headers.location, targetUrl).toString();
        response.resume();
        resolve(fetchBinaryFromUrl(redirectUrl, redirectCount + 1));
        return;
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(new Error(`Unable to fetch image (${statusCode || "request failed"}).`));
        return;
      }

      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        resolve({
          buffer: Buffer.concat(chunks),
          mimeType: String(response.headers["content-type"] || "")
            .split(";")[0]
            .trim()
            .toLowerCase(),
        });
      });
      response.on("error", reject);
    });

    request.setTimeout(10000, () => {
      request.destroy(new Error("Image request timed out."));
    });
    request.on("error", reject);
  });
}

async function loadIdCardPhotoAsset(record) {
  const photo = stringOrDefault(record?.head_photo);
  if (!photo) {
    return null;
  }

  if (/^data:image\//i.test(photo)) {
    return parseIdCardDataUri(photo);
  }

  if (!/^https?:\/\//i.test(photo)) {
    return null;
  }

  const remoteAsset = await fetchBinaryFromUrl(photo);
  return isSupportedPdfImageMime(remoteAsset.mimeType) ? remoteAsset : null;
}

function getIdCardPdfPhotoPlacement(frame, image, cropValue) {
  const crop = normalizeIdCardPhotoCrop(cropValue);
  const imageWidth = Math.max(1, normalizeFloat(image?.width) || 1);
  const imageHeight = Math.max(1, normalizeFloat(image?.height) || 1);
  const baseScale = Math.max(frame.width / imageWidth, frame.height / imageHeight);
  const renderWidth = imageWidth * baseScale * crop.zoom;
  const renderHeight = imageHeight * baseScale * crop.zoom;
  const overflowX = Math.max(0, renderWidth - frame.width);
  const overflowY = Math.max(0, renderHeight - frame.height);

  return {
    x: frame.x + (frame.width - renderWidth) / 2 + crop.offset_x * overflowX * 0.5,
    y: frame.y + (frame.height - renderHeight) / 2 + crop.offset_y * overflowY * 0.5,
    width: renderWidth,
    height: renderHeight,
  };
}

function drawIdCardPdfHeadshot(doc, x, y, width, height, palette, photoAsset, labelSource, cropValue) {
  doc.save();
  doc.roundedRect(x - 10, y - 10, width + 20, height + 20, 18).fillColor("#ffffff").fill();
  doc.restore();

  if (photoAsset?.buffer) {
    try {
      const opened = doc.openImage(photoAsset.buffer);
      const placement = getIdCardPdfPhotoPlacement(
        { x, y, width, height },
        opened,
        cropValue
      );
      doc.save();
      doc.roundedRect(x, y, width, height, 16).clip();
      doc.image(photoAsset.buffer, placement.x, placement.y, {
        width: placement.width,
        height: placement.height,
      });
      doc.restore();
      return;
    } catch {
      // Fall through to the fallback placeholder when the source image cannot be opened.
    }
  }

  const initials = (stringOrDefault(labelSource, "School")
    .split(/\s+/)
    .map((part) => part.slice(0, 1).toUpperCase())
    .slice(0, 2)
    .join("") || "ID");

  doc.save();
  doc.roundedRect(x, y, width, height, 16).fillColor(palette.glow).fill();
  doc.fillColor(palette.primary).opacity(0.14).circle(x + width / 2, y + 58, 34).fill();
  doc.opacity(1);
  doc.fillColor(palette.primary).font("Helvetica-Bold").fontSize(28).text(initials, x, y + 42, {
    width,
    align: "center",
  });
  doc.fillColor("#52606d").font("Helvetica").fontSize(10).text("Head photo not uploaded", x, y + height - 24, {
    width,
    align: "center",
  });
  doc.restore();
}

function renderBusinessIdCardPdf(doc, details, photoAsset = null) {
  const business = details?.business || {};
  const record = details?.card || {};
  const status = stringOrDefault(business?.subscription?.payment_status, "pending").toLowerCase();
  const palette = buildIdCardPalette(status);
  const schoolName = stringOrDefault(business?.name, business?.slug || "Registered School");
  const location = stringOrDefault(
    business?.location_full_label,
    business?.location_label || "No location saved"
  );
  const registrationId = stringOrDefault(record?.registration_id, getCanonicalBusinessRegistrationId(business));
  const planLabel = stringOrDefault(business?.subscription?.plan, "Pending");
  const statusLabel = buildIdCardStatusLabel(status);
  const expiryLabel = formatIsoDateLabel(business?.subscription?.expires_at, "Pending payment");
  const issueDate = formatIsoDateLabel(record?.issue_date, new Date().toISOString().slice(0, 10));
  const headName = stringOrDefault(record?.head_name, "Head details pending");
  const headTitle = stringOrDefault(record?.head_title, "Head of Institution");
  const emailLabel = stringOrDefault(business?.contact?.email, "No email saved");
  const slugLabel = stringOrDefault(business?.slug);
  const outerX = 24;
  const outerY = 24;
  const outerWidth = doc.page.width - outerX * 2;
  const outerHeight = doc.page.height - outerY * 2;
  const contentX = outerX + 32;
  const panelX = contentX;
  const panelY = outerY + 116;
  const panelWidth = 478;
  const panelHeight = 240;
  const photoX = outerX + 562;
  const photoY = outerY + 86;
  const photoWidth = 148;
  const photoHeight = 174;
  const statX = outerX + 548;
  const footerY = outerY + 380;
  const gradient = doc.linearGradient(outerX, outerY, outerX + outerWidth, outerY + outerHeight);

  gradient.stop(0, palette.primary).stop(1, palette.accent);
  doc.roundedRect(outerX, outerY, outerWidth, outerHeight, 24).fill(gradient);
  doc.save();
  doc.opacity(0.22);
  doc.roundedRect(outerX + 12, outerY + 12, outerWidth - 24, outerHeight - 24, 20).lineWidth(1).strokeColor("#ffffff").stroke();
  doc.restore();

  doc.fillColor("#e6f3ff").font("Helvetica").fontSize(16).text("EDUDATA NEPAL", contentX, outerY + 34, {
    characterSpacing: 2,
  });
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(30).text("Proof Of Registration", contentX, outerY + 56);
  doc.fillColor("#dce8f4").font("Helvetica").fontSize(13).text(
    "Printable registration card for the registered school record.",
    contentX,
    outerY + 92
  );

  doc.roundedRect(panelX, outerY + 96, panelWidth, 282, 22).fillColor("#ffffff").fill();
  doc.fillColor("#46617a").font("Helvetica").fontSize(12).text("School", panelX + 22, panelY + 22);
  doc.fillColor("#14304d").font("Helvetica-Bold").fontSize(22).text(schoolName, panelX + 22, panelY + 38, {
    width: panelWidth - 44,
    height: 48,
  });
  doc.fillColor("#46617a").font("Helvetica").fontSize(12).text(location, panelX + 22, panelY + 88, {
    width: panelWidth - 44,
  });

  doc.fillColor("#68798c").font("Helvetica").fontSize(11).text("Registration ID", panelX + 22, panelY + 128);
  doc.fillColor(palette.primary).font("Courier-Bold").fontSize(17).text(registrationId, panelX + 22, panelY + 146, {
    width: 190,
  });
  doc.fillColor("#68798c").font("Helvetica").fontSize(11).text("Directory Slug", panelX + 22, panelY + 186);
  doc.fillColor("#14304d").font("Courier").fontSize(13).text(slugLabel, panelX + 22, panelY + 204, {
    width: 190,
  });

  doc.fillColor("#68798c").font("Helvetica").fontSize(11).text("Payment Plan", panelX + 234, panelY + 128);
  doc.fillColor("#14304d").font("Helvetica-Bold").fontSize(14).text(planLabel, panelX + 234, panelY + 146, {
    width: 210,
  });
  doc.fillColor("#68798c").font("Helvetica").fontSize(11).text("Registered Email", panelX + 234, panelY + 186);
  doc.fillColor("#14304d").font("Helvetica").fontSize(11).text(emailLabel, panelX + 234, panelY + 204, {
    width: 210,
    height: 34,
  });

  drawIdCardPdfHeadshot(doc, photoX, photoY, photoWidth, photoHeight, palette, photoAsset, headName || schoolName, record?.head_photo_crop);

  doc.roundedRect(statX, outerY + 276, 178, 34, 17).fillColor(palette.badge).fill();
  doc.fillColor(palette.badge_text).font("Helvetica-Bold").fontSize(15).text(statusLabel, statX, outerY + 285, {
    width: 178,
    align: "center",
  });

  doc.fillColor("#ffffff").font("Helvetica").fontSize(11).text("Expires", statX, outerY + 328);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(15).text(expiryLabel, statX, outerY + 344, {
    width: 178,
  });

  doc.fillColor("#dce8f4").font("Helvetica").fontSize(11).text("Issued", contentX, footerY);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(15).text(issueDate, contentX, footerY + 16, {
    width: 120,
  });

  doc.fillColor("#dce8f4").font("Helvetica").fontSize(11).text("Head Of Institution", contentX + 140, footerY);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(15).text(headName, contentX + 140, footerY + 16, {
    width: 200,
  });
  doc.fillColor("#dce8f4").font("Helvetica").fontSize(11).text(headTitle, contentX + 140, footerY + 40, {
    width: 200,
  });
}

async function buildBusinessIdCardPdfBuffer(details) {
  const photoAsset = await loadIdCardPhotoAsset(details?.card).catch(() => null);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 0,
      compress: true,
      info: {
        Title: `Registration ID card for ${stringOrDefault(details?.business?.name, details?.business?.slug)}`,
        Author: "EduData Nepal Admin",
        Subject: "Institution registration proof",
      },
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      renderBusinessIdCardPdf(doc, details, photoAsset);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

async function buildBusinessIdCardAttachment(details) {
  return {
    filename: buildBusinessIdCardFilename(details?.business?.slug || details?.card?.slug),
    content: await buildBusinessIdCardPdfBuffer(details),
    contentType: "application/pdf",
  };
}

function getBusinessIdCardDetails(slugValue, options = {}) {
  const slug = sanitizeSlug(slugValue);
  const business = options.business || getAdminDirectoryList().find((item) => item.slug === slug) || null;
  if (!slug || !business) {
    const error = new Error("Business not found.");
    error.statusCode = 404;
    throw error;
  }

  const record =
    (options.createIfMissing === false
      ? getExistingIdCardRecord(slug)
      : ensureBusinessIdCardRecord(slug, { business })) || ensureBusinessIdCardRecord(slug, { business });
  const svg = buildBusinessIdCardSvg(business, record);

  return {
    business,
    card: record,
    svg,
    filename: buildBusinessIdCardFilename(slug),
    svg_filename: buildBusinessIdCardFilename(slug, "svg"),
  };
}

function buildIdCardSnapshot() {
  const businesses = getAdminDirectoryList();
  const recordMap = new Map(loadIdCardRecords().map((record) => [record.slug, record]));
  const cards = businesses.map((business) => {
    const record = recordMap.get(business.slug) || null;
    return {
      slug: business.slug,
      business_name: business.name,
      location_label: business.location_full_label || business.location_label || "No location",
      payment_status: stringOrDefault(business.subscription?.payment_status, "pending"),
      registration_id: record?.registration_id || getCanonicalBusinessRegistrationId(business, business.created_at),
      issue_date: record?.issue_date || "",
      updated_at: record?.updated_at || "",
      head_name: record?.head_name || "",
      has_card: Boolean(record),
      has_head_photo: Boolean(record?.head_photo),
    };
  });

  return {
    cards,
    stats: {
      total_businesses: businesses.length,
      total_cards: cards.filter((item) => item.has_card).length,
      with_head_photo: cards.filter((item) => item.has_head_photo).length,
    },
  };
}

function buildBusinessOfferSummary() {
  return ensureArray(PLAN_CATALOG?.plans)
    .map((plan) => {
      const months = Math.max(1, normalizeInteger(plan?.months) || 1);
      const monthCopy = `${months} month${months === 1 ? "" : "s"}`;
      const discount = normalizeFloat(plan?.discount_percent) || 0;
      const discountCopy = discount > 0 ? ` with ${discount}% off` : "";
      return `- ${stringOrDefault(plan?.label, "Plan")}: ${stringOrDefault(plan?.currency, PLAN_CATALOG?.currency || "NPR")} ${normalizeFloat(plan?.amount) ?? 0} for ${monthCopy}${discountCopy}`;
    })
    .join("\n");
}

function readEmailLogs() {
  return ensureArray(readJson(EMAIL_LOG_FILE, []));
}

function writeEmailLogs(items) {
  writeJson(EMAIL_LOG_FILE, ensureArray(items).slice(0, 120));
}

function getEmailConfig() {
  const env = loadEnvFile(ADMIN_ENV_FILE);
  const port = normalizeInteger(env.ADMIN_SMTP_PORT) ?? 587;
  const secure = normalizeBoolean(env.ADMIN_SMTP_SECURE, port === 465);
  const user = stringOrDefault(env.ADMIN_SMTP_USER);
  const pass = stringOrDefault(env.ADMIN_SMTP_PASS);
  if ((user && !pass) || (!user && pass)) {
    throw new Error("Both SMTP username and password must be provided together.");
  }

  return {
    host: stringOrDefault(env.ADMIN_SMTP_HOST),
    port,
    secure,
    user,
    pass,
    from_name: stringOrDefault(env.ADMIN_EMAIL_FROM_NAME, "EduData Nepal"),
    from_address: stringOrDefault(env.ADMIN_EMAIL_FROM_ADDRESS),
    reply_to: stringOrDefault(env.ADMIN_EMAIL_REPLY_TO),
  };
}

const EMAIL_TAGS = {
  business: [
    "{{current_date}}",
    "{{business_name}}",
    "{{business_slug}}",
    "{{district}}",
    "{{zone}}",
    "{{province}}",
    "{{business_email}}",
    "{{plan_name}}",
    "{{payment_status}}",
    "{{payment_amount}}",
    "{{payment_currency}}",
    "{{expiry_date}}",
    "{{days_remaining}}",
    "{{offer_summary}}",
    "{{registration_id}}",
    "{{website_ready}}",
    "{{apk_ready}}",
  ],
  staff: [
    "{{current_date}}",
    "{{staff_name}}",
    "{{staff_code}}",
    "{{staff_role}}",
    "{{staff_department}}",
    "{{staff_email}}",
    "{{salary_amount}}",
    "{{salary_currency}}",
    "{{next_payment_due}}",
  ],
};

function buildEmailSnapshot() {
  const config = getEmailConfig();
  const allBusinesses = getAdminDirectoryList();
  const staffSnapshot = buildStaffSnapshot();
  const businessRecipients = getBusinessEmailRecipients();
  const staffRecipients = getStaffEmailRecipients(staffSnapshot.staff);
  return {
    config_ready: isEmailConfigReady(config),
    config: {
      ...config,
      pass: config.pass ? "********" : "",
    },
    business_count: allBusinesses.length,
    business_recipient_count: businessRecipients.length,
    staff_count: staffSnapshot.staff.length,
    staff_recipient_count: staffRecipients.length,
    recipient_count: businessRecipients.length + staffRecipients.length,
    recipient_kinds: ["business", "staff"],
    available_tags: [...new Set([...EMAIL_TAGS.business, ...EMAIL_TAGS.staff])],
    available_tags_by_kind: EMAIL_TAGS,
    recent_logs: readEmailLogs(),
  };
}

function renderEmailTemplate(input, recipient) {
  const replacements = buildEmailReplacements(recipient);

  return Object.entries(replacements).reduce((output, [token, value]) => {
    return output.replaceAll(token, String(value || ""));
  }, String(input || ""));
}

function buildEmailHtml(textBody) {
  const encode = (value) =>
    String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  return String(textBody || "")
    .split(/\r?\n/)
    .map((line) => encode(line) || "&nbsp;")
    .join("<br>");
}

async function sendBusinessEmailCampaign(payload) {
  const config = getEmailConfig();
  if (!isEmailConfigReady(config)) {
    throw new Error("Configure SMTP host, port, and from address in Config App before sending mail.");
  }

  const recipientKind = normalizeEmailRecipientKind(payload.recipient_kind);
  const requestedRecipients = new Set(
    cleanStringArray(payload.recipient_ids || payload.recipient_slugs)
  );
  if (!requestedRecipients.size) {
    throw new Error(
      recipientKind === "staff"
        ? "Select at least one staff recipient with an email address."
        : "Select at least one business with an email address."
    );
  }

  const subject = stringOrDefault(payload.subject);
  const body = String(payload.body ?? "").trim();
  const attachments = ensureArray(payload.attachments).filter(
    (item) => item && typeof item === "object" && stringOrDefault(item.filename) && item.content != null
  );
  if (!subject) {
    throw new Error("Email subject is required.");
  }
  if (!body) {
    throw new Error("Email body is required.");
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
  });
  await transporter.verify();

  const recipients = resolveEmailRecipients(recipientKind, requestedRecipients);
  if (!recipients.length) {
    throw new Error(
      recipientKind === "staff"
        ? "No valid staff recipients were found for this send."
        : "No valid business recipients were found for this send."
    );
  }

  const results = [];
  for (const recipient of recipients) {
    const personalizedSubject = renderEmailTemplate(subject, recipient);
    const personalizedBody = renderEmailTemplate(body, recipient);
    try {
      const delivery = await transporter.sendMail({
        from: config.from_name ? `"${config.from_name}" <${config.from_address}>` : config.from_address,
        replyTo: stringOrDefault(payload.reply_to, config.reply_to),
        to: recipient.email,
        cc: stringOrDefault(payload.cc),
        bcc: stringOrDefault(payload.bcc),
        subject: personalizedSubject,
        text: personalizedBody,
        html: buildEmailHtml(personalizedBody),
        attachments,
      });
      results.push({
        recipient_kind: recipient.kind,
        recipient_id: recipient.id,
        recipient_name: recipient.name,
        email: recipient.email,
        ok: true,
        message_id: delivery.messageId,
      });
    } catch (error) {
      results.push({
        recipient_kind: recipient.kind,
        recipient_id: recipient.id,
        recipient_name: recipient.name,
        email: recipient.email,
        ok: false,
        error: error.message,
      });
    }
  }

  const sentCount = results.filter((item) => item.ok).length;
  const failedCount = results.length - sentCount;
  const logEntry = {
    id: generateId(),
    created_at: new Date().toISOString(),
    recipient_kind: recipientKind,
    subject,
    sent_count: sentCount,
    failed_count: failedCount,
    recipients: results,
  };
  writeEmailLogs([logEntry, ...readEmailLogs()]);

  return {
    recipient_kind: recipientKind,
    sent_count: sentCount,
    failed_count: failedCount,
    results,
    snapshot: buildEmailSnapshot(),
  };
}

function respondApiError(res, error, fallbackStatus = 500) {
  const statusCode = normalizeInteger(error?.statusCode) || fallbackStatus;
  const response = {
    success: false,
    error: error?.message || "Unexpected error.",
  };
  if (Object.prototype.hasOwnProperty.call(error || {}, "data")) {
    response.data = error.data;
  }
  res.status(statusCode).json(response);
}

function normalizeEmailRecipientKind(value) {
  return String(value || "").trim().toLowerCase() === "staff" ? "staff" : "business";
}

function isEmailConfigReady(config) {
  return Boolean(config.host && config.port && config.from_address && (!config.user || config.pass));
}

function getBusinessEmailRecipients() {
  return getAdminDirectoryList()
    .map((business) => buildBusinessEmailRecipient(business))
    .filter(Boolean);
}

function getStaffEmailRecipients(staffRecords = null) {
  const records = Array.isArray(staffRecords) ? staffRecords : buildStaffSnapshot().staff;
  return ensureArray(records)
    .map((staff) => buildStaffEmailRecipient(staff))
    .filter(Boolean);
}

function buildBusinessEmailRecipient(business) {
  const email = String(business?.contact?.email || "").trim();
  if (!email) {
    return null;
  }

  return {
    kind: "business",
    id: stringOrDefault(business.slug),
    name: stringOrDefault(business.name, business.slug),
    email,
    business,
  };
}

function buildStaffEmailRecipient(staff) {
  const email = String(staff?.email || "").trim();
  if (!email) {
    return null;
  }

  return {
    kind: "staff",
    id: stringOrDefault(staff.id),
    name: stringOrDefault(staff.full_name, staff.id),
    email,
    staff,
  };
}

function resolveEmailRecipients(kind, requestedRecipients) {
  const lookup = new Map(
    (kind === "staff" ? getStaffEmailRecipients() : getBusinessEmailRecipients()).map((recipient) => [
      recipient.id,
      recipient,
    ])
  );

  return [...requestedRecipients]
    .map((id) => lookup.get(String(id || "").trim()))
    .filter(Boolean);
}

function buildEmailReplacements(recipient) {
  const currentDate = new Date().toISOString().slice(0, 10);
  if (recipient?.kind === "staff") {
    const staff = recipient.staff || {};
    return {
      "{{current_date}}": currentDate,
      "{{staff_name}}": staff.full_name || recipient.name || "",
      "{{staff_code}}": staff.employee_code || "",
      "{{staff_role}}": staff.role || "",
      "{{staff_department}}": staff.department || "",
      "{{staff_email}}": recipient.email || "",
      "{{salary_amount}}": normalizeFloat(staff.salary_amount) ?? "",
      "{{salary_currency}}": staff.salary_currency || "",
      "{{next_payment_due}}": staff.next_payment_due_at ? staff.next_payment_due_at.slice(0, 10) : "",
    };
  }

  const business = recipient?.business || {};
  const subscription = business.subscription || {};
  const registrationCard =
    getExistingIdCardRecord(business.slug) ||
    (stringOrDefault(business.slug) ? ensureBusinessIdCardRecord(business.slug, { business }) : null);
  return {
    "{{current_date}}": currentDate,
    "{{business_name}}": business.name || recipient?.name || "",
    "{{business_slug}}": business.slug || "",
    "{{district}}": business.district || "",
    "{{zone}}": business.zone_name || "",
    "{{province}}": business.province_name || "",
    "{{business_email}}": recipient?.email || "",
    "{{plan_name}}": subscription.plan || "",
    "{{payment_status}}": buildIdCardStatusLabel(subscription.payment_status || "pending"),
    "{{payment_amount}}": normalizeFloat(subscription.amount) ?? "",
    "{{payment_currency}}": subscription.currency || PLAN_CATALOG?.currency || "NPR",
    "{{expiry_date}}": subscription.expires_at ? subscription.expires_at.slice(0, 10) : "",
    "{{days_remaining}}":
      subscription.days_remaining == null ? "" : String(subscription.days_remaining),
    "{{offer_summary}}": buildBusinessOfferSummary(),
    "{{registration_id}}": registrationCard?.registration_id || "",
    "{{website_ready}}": business.generator?.has_website ? "Yes" : "No",
    "{{apk_ready}}": business.generator?.has_apk ? "Yes" : "No",
  };
}

function buildBusinessRegistrationEmailTemplate(business, options = {}) {
  const openingLine = options.is_new_business
    ? "Your directory registration has been completed successfully."
    : "Your directory registration details have been updated successfully.";

  return {
    subject: "Registration confirmed for {{business_name}}",
    body: [
      "Hello {{business_name}},",
      "",
      openingLine,
      "",
      "Registration ID: {{registration_id}}",
      "Business slug: {{business_slug}}",
      "District: {{district}}",
      "Province: {{province}}",
      "Website ready: {{website_ready}}",
      "APK ready: {{apk_ready}}",
      "",
      "Your printable registration ID card PDF is attached to this email.",
      "",
      "Reply to this email if you need any changes in your listing.",
    ].join("\n"),
  };
}

function buildBusinessPaymentEmailTemplate(business, mode = "expired") {
  const normalizedMode = String(mode || "").trim().toLowerCase();
  if (normalizedMode === "reactivated") {
    return {
      subject: "Subscription reactivated for {{business_name}}",
      body: [
        "Hello {{business_name}},",
        "",
        "Your directory subscription has been reactivated successfully.",
        "",
        "Registration ID: {{registration_id}}",
        "Current plan: {{plan_name}}",
        "Status: {{payment_status}}",
        "Valid until: {{expiry_date}}",
        "",
        "Current renewal offers:",
        "{{offer_summary}}",
        "",
        "Reply to this email if you want to upgrade or extend the plan further.",
      ].join("\n"),
    };
  }

  return {
    subject: "Subscription expired for {{business_name}}",
    body: [
      "Hello {{business_name}},",
      "",
      "Your directory subscription is now marked as expired.",
      "",
      "Registration ID: {{registration_id}}",
      "Previous plan: {{plan_name}}",
      "Status: {{payment_status}}",
      "Expired on: {{expiry_date}}",
      "",
      "Available renewal offers:",
      "{{offer_summary}}",
      "",
      "Reply to this email if you want us to reactivate the listing.",
    ].join("\n"),
  };
}

function buildBusinessIdCardEmailTemplate() {
  return {
    subject: "Registration ID card for {{business_name}}",
    body: [
      "Hello {{business_name}},",
      "",
      "Attached is your printable proof of registration card PDF.",
      "",
      "Registration ID: {{registration_id}}",
      "Business slug: {{business_slug}}",
      "",
      "Keep this file for verification and printing.",
    ].join("\n"),
  };
}

async function sendBusinessRegistrationEmail(business, options = {}) {
  const recipient = buildBusinessEmailRecipient(business);
  if (!recipient) {
    return {
      status: "skipped",
      reason: "No business email address is available for registration mail.",
    };
  }

  let config;
  try {
    config = getEmailConfig();
  } catch (error) {
    return {
      status: "skipped",
      reason: error.message,
    };
  }

  if (!isEmailConfigReady(config)) {
    return {
      status: "skipped",
      reason: "SMTP is not configured yet.",
    };
  }

  try {
    const idCardDetails = getBusinessIdCardDetails(recipient.id, {
      business,
      createIfMissing: true,
    });
    const idCardAttachment = await buildBusinessIdCardAttachment(idCardDetails);
    const template = buildBusinessRegistrationEmailTemplate(business, options);
    const result = await sendBusinessEmailCampaign({
      recipient_kind: "business",
      recipient_ids: [recipient.id],
      subject: template.subject,
      body: template.body,
      attachments: [idCardAttachment],
    });
    const firstResult = ensureArray(result.results)[0] || null;
    return firstResult?.ok
      ? {
          status: "sent",
          email: recipient.email,
          message_id: firstResult.message_id || "",
          registration_id: idCardDetails.card.registration_id,
        }
      : {
          status: "failed",
          email: recipient.email,
          reason: firstResult?.error || "Registration email delivery failed.",
          registration_id: idCardDetails.card.registration_id,
        };
  } catch (error) {
    return {
      status: "failed",
      email: recipient.email,
      reason: error.message,
    };
  }
}

async function sendBusinessPaymentStatusEmail(business, mode = "expired") {
  const recipient = buildBusinessEmailRecipient(business);
  if (!recipient) {
    return {
      status: "skipped",
      reason: "No business email address is available for payment mail.",
    };
  }

  let config;
  try {
    config = getEmailConfig();
  } catch (error) {
    return {
      status: "skipped",
      reason: error.message,
    };
  }

  if (!isEmailConfigReady(config)) {
    return {
      status: "skipped",
      reason: "SMTP is not configured yet.",
    };
  }

  try {
    ensureBusinessIdCardRecord(recipient.id, { business });
    const template = buildBusinessPaymentEmailTemplate(business, mode);
    const result = await sendBusinessEmailCampaign({
      recipient_kind: "business",
      recipient_ids: [recipient.id],
      subject: template.subject,
      body: template.body,
    });
    const firstResult = ensureArray(result.results)[0] || null;
    return firstResult?.ok
      ? {
          status: "sent",
          email: recipient.email,
          mode,
          message_id: firstResult.message_id || "",
        }
      : {
          status: "failed",
          email: recipient.email,
          mode,
          reason: firstResult?.error || "Payment notification delivery failed.",
        };
  } catch (error) {
    return {
      status: "failed",
      email: recipient.email,
      mode,
      reason: error.message,
    };
  }
}

async function sendBusinessIdCardEmail(slugValue) {
  const details = getBusinessIdCardDetails(slugValue, { createIfMissing: true });
  const recipient = buildBusinessEmailRecipient(details.business);
  if (!recipient) {
    return {
      status: "skipped",
      reason: "No business email address is available for ID card mail.",
    };
  }

  let config;
  try {
    config = getEmailConfig();
  } catch (error) {
    return {
      status: "skipped",
      reason: error.message,
    };
  }

  if (!isEmailConfigReady(config)) {
    return {
      status: "skipped",
      reason: "SMTP is not configured yet.",
    };
  }

  try {
    const template = buildBusinessIdCardEmailTemplate();
    const idCardAttachment = await buildBusinessIdCardAttachment(details);
    const result = await sendBusinessEmailCampaign({
      recipient_kind: "business",
      recipient_ids: [recipient.id],
      subject: template.subject,
      body: template.body,
      attachments: [idCardAttachment],
    });
    const firstResult = ensureArray(result.results)[0] || null;
    return firstResult?.ok
      ? {
          status: "sent",
          email: recipient.email,
          registration_id: details.card.registration_id,
          message_id: firstResult.message_id || "",
        }
      : {
          status: "failed",
          email: recipient.email,
          registration_id: details.card.registration_id,
          reason: firstResult?.error || "ID card email delivery failed.",
        };
  } catch (error) {
    return {
      status: "failed",
      email: recipient.email,
      registration_id: details.card.registration_id,
      reason: error.message,
    };
  }
}

function addDaysUtc(date, dayCount) {
  return new Date(date.getTime() + dayCount * 86400000);
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

function safeStat(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return fs.statSync(filePath);
  } catch {
    return null;
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

function buildEnvConfigSnapshot() {
  return {
    admin: buildEnvTargetSnapshot("admin"),
    user: buildEnvTargetSnapshot("user"),
  };
}

function buildEnvTargetSnapshot(target) {
  const config = ENV_CONFIG_SCHEMA[target];
  if (!config) {
    throw new Error(`Unknown env target: ${target}`);
  }

  const fileValues = loadEnvFile(config.file_path);
  return {
    title: config.title,
    description: config.description,
    restart_note: config.restart_note,
    file_path: config.file_path,
    values: collectEnvTargetValues(target, fileValues),
    sections: config.sections.map((section) => ({
      title: section.title,
      description: section.description,
      fields: section.fields.map((field) => ({
        ...field,
        value: stringOrDefault(fileValues[field.key], ""),
      })),
    })),
  };
}

function collectEnvTargetValues(target, sourceValues = {}) {
  const config = ENV_CONFIG_SCHEMA[target];
  const values = {};
  for (const section of config.sections) {
    for (const field of section.fields) {
      values[field.key] = stringOrDefault(sourceValues[field.key], "");
    }
  }
  return values;
}

function saveEnvConfigSnapshot(payload) {
  const nextAdmin = Object.prototype.hasOwnProperty.call(payload, "admin")
    ? saveEnvTargetConfig("admin", payload.admin)
    : buildEnvTargetSnapshot("admin");
  const nextUser = Object.prototype.hasOwnProperty.call(payload, "user")
    ? saveEnvTargetConfig("user", payload.user)
    : buildEnvTargetSnapshot("user");

  return {
    admin: nextAdmin,
    user: nextUser,
  };
}

function saveEnvTargetConfig(target, nextValues) {
  const config = ENV_CONFIG_SCHEMA[target];
  if (!config) {
    throw new Error(`Unknown env target: ${target}`);
  }

  const currentValues = loadEnvFile(config.file_path);
  const allowedKeys = new Set(
    config.sections.flatMap((section) => section.fields.map((field) => field.key))
  );
  const mergedValues = { ...currentValues };

  for (const section of config.sections) {
    for (const field of section.fields) {
      mergedValues[field.key] = normalizeEnvString(nextValues?.[field.key]);
    }
  }

  writeEnvConfigFile(config.file_path, config, mergedValues, allowedKeys, currentValues);
  return buildEnvTargetSnapshot(target);
}

function writeEnvConfigFile(filePath, config, values, allowedKeys, currentValues) {
  const lines = [
    `# ${config.title}`,
    `# ${config.description}`,
    `# ${config.restart_note}`,
    "",
  ];

  for (const section of config.sections) {
    lines.push(`# ${section.title}`);
    if (section.description) {
      lines.push(`# ${section.description}`);
    }
    for (const field of section.fields) {
      if (field.example) {
        lines.push(`# Example: ${field.example}`);
      }
      if (field.description) {
        lines.push(`# ${field.description}`);
      }
      lines.push(`${field.key}=${stringOrDefault(values[field.key], "")}`);
      lines.push("");
    }
  }

  const extraEntries = Object.entries(currentValues || {})
    .filter(([key]) => !allowedKeys.has(key))
    .sort(([left], [right]) => left.localeCompare(right));
  if (extraEntries.length) {
    lines.push("# Additional values");
    for (const [key, value] of extraEntries) {
      lines.push(`${key}=${stringOrDefault(value, "")}`);
    }
    lines.push("");
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${lines.join("\n").trimEnd()}\n`, "utf8");
}

function normalizeEnvString(value) {
  return String(value ?? "").trim();
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

function sanitizeBusinessTags(value) {
  return cleanStringArray(value).filter(
    (tag) => String(tag || "").trim().toLowerCase() !== "featured-campus"
  );
}

function getDistrictCatalogRecord(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized ? DISTRICT_LOOKUP.get(normalized) || null : null;
}

function normalizeZone(value, fallbackDistrict = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (ZONE_NAMES[normalized]) {
    return normalized;
  }
  return getDistrictCatalogRecord(fallbackDistrict)?.zone_id || "";
}

function normalizeProvince(value) {
  const normalized = String(value || "").trim();
  if (PROVINCE_NAMES[normalized]) {
    return normalized;
  }
  return "";
}

function resolveProvinceFromDistrict(provinceValue, districtValue) {
  const normalized = normalizeProvince(provinceValue);
  if (normalized) {
    return normalized;
  }
  return String(getDistrictCatalogRecord(districtValue)?.province_id || "");
}

function resolveZoneFromDistrict(zoneValue, districtValue) {
  const normalized = normalizeZone(zoneValue, districtValue);
  if (normalized) {
    return normalized;
  }
  return String(getDistrictCatalogRecord(districtValue)?.zone_id || "");
}

function buildLocationLabels(record) {
  const district = stringOrDefault(record?.district);
  const zoneId = stringOrDefault(record?.zone).toLowerCase();
  const provinceId = stringOrDefault(record?.province);
  const zoneName = ZONE_NAMES[zoneId] || "";
  const provinceName = PROVINCE_NAMES[provinceId] || "";
  return {
    zone_name: zoneName,
    province_name: provinceName,
    location_label: [district, provinceName].filter(Boolean).join(", "),
    location_full_label: [district, zoneName, provinceName].filter(Boolean).join(", "),
  };
}

function buildLocationCatalogSnapshot() {
  return {
    provinces: PROVINCES,
    zones: ZONES,
    districts: DISTRICT_CATALOG,
    totals: {
      provinces: PROVINCES.length,
      zones: ZONES.length,
      districts: DISTRICT_CATALOG.length,
    },
  };
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

function normalizeFileSystemPath(value) {
  const resolved = path.resolve(String(value || "")).replace(/\\/g, "/").replace(/\/+$/, "");
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function pathsOverlap(left, right) {
  const normalizedLeft = normalizeFileSystemPath(left);
  const normalizedRight = normalizeFileSystemPath(right);
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }
  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.startsWith(`${normalizedRight}/`) ||
    normalizedRight.startsWith(`${normalizedLeft}/`)
  );
}

function pathsEqual(left, right) {
  const normalizedLeft = normalizeFileSystemPath(left);
  const normalizedRight = normalizeFileSystemPath(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

function isPathInsideBase(candidatePath, basePath) {
  const normalizedCandidate = normalizeFileSystemPath(candidatePath);
  const normalizedBase = normalizeFileSystemPath(basePath);
  if (!normalizedCandidate || !normalizedBase) {
    return false;
  }
  return (
    normalizedCandidate === normalizedBase ||
    normalizedCandidate.startsWith(`${normalizedBase}/`)
  );
}

function normalizeRequestPath(value) {
  const normalized = String(value || "/")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/");
  if (!normalized) {
    return "/";
  }
  const withLeadingSlash = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return withLeadingSlash === "/" ? "/" : withLeadingSlash.replace(/\/+$/, "");
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function restrictPrivateAdminSurface(req, res, next) {
  const requestPath = normalizeRequestPath(req.path);
  if (isPublicAdminRequestPath(requestPath)) {
    return next();
  }

  if (!canAccessPrivateAdmin(req)) {
    return denyPrivateAdminRequest(req, res, requestPath);
  }

  return next();
}

function canAccessPrivateAdmin(req) {
  return ALLOW_REMOTE_ADMIN_ACCESS || isLocalAdminRequest(req);
}

function isPublicAdminRequestPath(requestPath) {
  return (
    isPublicApiRequestPath(requestPath) ||
    isPublicUserRequestPath(requestPath) ||
    isPublicSeoAssetPath(requestPath)
  );
}

function isPublicApiRequestPath(requestPath) {
  return (
    requestPath === "/api/public/list" ||
    requestPath === "/api/public/meta" ||
    requestPath.startsWith("/api/public/get/")
  );
}

function isPublicUserRequestPath(requestPath) {
  if (!HAS_USER_DIST) {
    return false;
  }
  return (
    requestPath === USER_STATIC_ROUTE ||
    requestPath.startsWith(`${USER_STATIC_ROUTE}/`) ||
    requestPath === "/assets" ||
    requestPath.startsWith("/assets/") ||
    requestPath === "/nepal" ||
    requestPath.startsWith("/nepal/")
  );
}

function isPublicSeoAssetPath(requestPath) {
  if (!HAS_USER_DIST) {
    return false;
  }
  return requestPath === "/robots.txt" || requestPath === "/sitemap.xml";
}

function resolveUserDistPagePath(requestPath) {
  const normalizedPath = normalizeRequestPath(requestPath);
  const relativePath = normalizedPath.replace(/^\/+|\/+$/g, "");
  if (!relativePath) {
    return null;
  }

  const directFile = path.join(USER_DIST_DIR, relativePath);
  if (fs.existsSync(directFile) && fs.statSync(directFile).isFile()) {
    return directFile;
  }

  const nestedIndexFile = path.join(USER_DIST_DIR, relativePath, "index.html");
  if (fs.existsSync(nestedIndexFile) && fs.statSync(nestedIndexFile).isFile()) {
    return nestedIndexFile;
  }

  return null;
}

function applyPublicSecurityHeaders(res) {
  for (const [key, value] of PUBLIC_SECURITY_HEADERS) {
    res.setHeader(key, value);
  }
}

function denyPrivateAdminRequest(req, res, requestPath = normalizeRequestPath(req.path)) {
  const message =
    "Admin access is restricted to local requests. Public user routes remain available.";

  if (req.method === "GET" && HAS_USER_DIST && (requestPath === "/" || requestPath === "/index.html")) {
    return res.redirect(USER_STATIC_ROUTE);
  }

  if (String(req.headers.accept || "").toLowerCase().includes("text/html")) {
    return res.status(403).type("text/plain").send(message);
  }

  return res.status(403).json({
    success: false,
    error: message,
  });
}

function isLocalAdminRequest(req) {
  const remoteAddress = String(req.socket?.remoteAddress || "").trim();
  return (
    remoteAddress === "::1" ||
    remoteAddress === "127.0.0.1" ||
    remoteAddress === "::ffff:127.0.0.1"
  );
}

function scheduleAdminShutdown(reason = "Shutdown requested.") {
  if (!adminServer || adminShutdownScheduled) {
    return;
  }

  adminShutdownScheduled = true;
  setTimeout(() => {
    console.log(reason);
    adminServer.close(() => {
      process.exit(0);
    });

    setTimeout(() => {
      for (const socket of adminSockets) {
        try {
          socket.destroy();
        } catch {}
      }
    }, 300);
  }, 120);
}

migrateLegacyPayments();
refreshBusinessPaymentSummaries();
syncBusinessDataShadowCopies();

adminServer = app.listen(PORT, HOST, () => {
  const displayHost = HOST === "0.0.0.0" ? "localhost" : HOST;
  console.log(`EduData XP admin running at http://${displayHost}:${PORT}`);
  console.log(
    `Remote admin access: ${ALLOW_REMOTE_ADMIN_ACCESS ? "enabled" : "disabled (localhost only)"}`
  );
  console.log(`Business data root: ${BUSINESS_DATA_ROOT}`);
  console.log(`Basic card index: ${BASIC_INDEX_FILE}`);
  console.log(`Detailed data: ${DETAILED_DIR}`);
  console.log(`Expenses file: ${EXPENSES_FILE}`);
  if (HAS_USER_DIST) {
    console.log(`Public user route: http://${displayHost}:${PORT}${USER_STATIC_ROUTE}`);
  }
});

adminServer.on("connection", (socket) => {
  adminSockets.add(socket);
  socket.on("close", () => {
    adminSockets.delete(socket);
  });
});
