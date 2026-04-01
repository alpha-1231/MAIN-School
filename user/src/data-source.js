const PROVINCE_NAMES = {
  "1": "Koshi",
  "2": "Madhesh",
  "3": "Bagmati",
  "4": "Gandaki",
  "5": "Lumbini",
  "6": "Karnali",
  "7": "Sudurpashchim",
};

const RAW_DATA_ROOT = normalizeRoot(import.meta.env.VITE_PUBLIC_DATA_ROOT);

export const DATA_SOURCE = RAW_DATA_ROOT
  ? {
      mode: "github-raw",
      label: "GitHub Raw",
      root: RAW_DATA_ROOT,
    }
  : {
      mode: "local-api",
      label: "Local API",
      root: "/api/public",
    };

export async function fetchBusinessList() {
  if (DATA_SOURCE.mode === "github-raw") {
    const records = await fetchRawJson(buildRawUrl("basic/_cards.json", true));
    return Array.isArray(records)
      ? records.filter(isPublicRecordVisible).map(decoratePublicRecord).sort(sortPublicBusinesses)
      : [];
  }

  const payload = await fetchLocalJson("/api/public/list", { cache: "no-store" });
  return Array.isArray(payload.data) ? payload.data.map(decoratePublicRecord).sort(sortPublicBusinesses) : [];
}

export async function fetchBusinessDetail(slug) {
  const normalizedSlug = sanitizeSlug(slug);
  if (!normalizedSlug) {
    throw new Error("Invalid business identifier.");
  }

  if (DATA_SOURCE.mode === "github-raw") {
    const record = await fetchRawJson(buildRawUrl(`detailed/${normalizedSlug}.json`, true));
    if (!record || !isPublicRecordVisible(record)) {
      throw new Error("Not found.");
    }
    return decoratePublicRecord(record);
  }

  const payload = await fetchLocalJson(`/api/public/get/${normalizedSlug}`, { cache: "no-store" });
  return payload.data || null;
}

function decoratePublicRecord(record) {
  const provinceName = PROVINCE_NAMES[String(record?.province || "")] || "";
  const locationLabel = [record?.district, provinceName].filter(Boolean).join(", ");

  return {
    id: stringOrDefault(record?.id),
    slug: sanitizeSlug(record?.slug),
    name: stringOrDefault(record?.name),
    name_np: stringOrDefault(record?.name_np),
    type: stringOrDefault(record?.type),
    level: cleanStringArray(record?.level),
    field: cleanStringArray(record?.field),
    affiliation: stringOrDefault(record?.affiliation),
    district: stringOrDefault(record?.district),
    province: stringOrDefault(record?.province),
    province_name: provinceName,
    location_label: locationLabel,
    is_verified: Boolean(record?.is_verified),
    is_certified: Boolean(record?.is_certified),
    tags: sanitizeBusinessTags(record?.tags),
    logo: stringOrDefault(record?.logo || record?.media?.logo),
    cover: stringOrDefault(record?.cover || record?.media?.cover),
    description: stringOrDefault(record?.description),
    programs: cleanStringArray(record?.programs),
    facilities: cleanStringArray(record?.facilities),
    contact: {
      address: stringOrDefault(record?.contact?.address),
      phone: cleanStringArray(record?.contact?.phone),
      email: stringOrDefault(record?.contact?.email),
      website: stringOrDefault(record?.contact?.website),
      map: {
        lat: numberOrNull(record?.contact?.map?.lat),
        lng: numberOrNull(record?.contact?.map?.lng),
      },
    },
    stats: {
      students: integerOrNull(record?.stats?.students),
      faculty: integerOrNull(record?.stats?.faculty),
      rating: numberOrNull(record?.stats?.rating),
      programs_count: integerOrNull(record?.stats?.programs_count),
    },
    media: {
      logo: stringOrDefault(record?.media?.logo || record?.logo),
      cover: stringOrDefault(record?.media?.cover || record?.cover),
      gallery: cleanStringArray(record?.media?.gallery),
      videos: cleanStringArray(record?.media?.videos),
    },
    social: {
      facebook: stringOrDefault(record?.social?.facebook),
      instagram: stringOrDefault(record?.social?.instagram),
      youtube: stringOrDefault(record?.social?.youtube),
      twitter: stringOrDefault(record?.social?.twitter),
    },
    created_at: stringOrDefault(record?.created_at),
    updated_at: stringOrDefault(record?.updated_at),
    search_text: buildSearchText(record, provinceName),
  };
}

function buildSearchText(record, provinceName) {
  return [
    record?.name,
    record?.slug,
    record?.type,
    ...(record?.level || []),
    ...(record?.field || []),
    ...(record?.programs || []),
    record?.district,
    provinceName,
    record?.affiliation,
    ...sanitizeBusinessTags(record?.tags),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function sortPublicBusinesses(left, right) {
  const nameCompare = String(left?.name || "").localeCompare(String(right?.name || ""));
  return nameCompare || String(left?.slug || "").localeCompare(String(right?.slug || ""));
}

function isPublicRecordVisible(record) {
  const subscription = record?.subscription || {};
  const expiresAt = subscription?.expires_at ? new Date(subscription.expires_at) : null;
  if (expiresAt && !Number.isNaN(expiresAt.getTime())) {
    return expiresAt.getTime() > Date.now();
  }

  return String(subscription?.payment_status || "").trim().toLowerCase() === "active";
}

async function fetchLocalJson(url, options = {}) {
  const payload = await fetchJson(url, options);
  if (payload?.success === false) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload;
}

async function fetchRawJson(url) {
  return fetchJson(url, { cache: "no-store" });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(text || `Request failed with status ${response.status}.`);
  }

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed with status ${response.status}.`);
  }

  return payload;
}

function buildRawUrl(relativePath, bustCache = false) {
  const baseUrl = `${RAW_DATA_ROOT}/${String(relativePath || "").replace(/^\/+/, "")}`;
  if (!bustCache) {
    return baseUrl;
  }
  return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}ts=${Date.now()}`;
}

function normalizeRoot(value) {
  const root = String(value || "").trim();
  return root ? root.replace(/\/+$/, "") : "";
}

function sanitizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanStringArray(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];
}

function sanitizeBusinessTags(value) {
  return cleanStringArray(value).filter(
    (tag) => String(tag || "").trim().toLowerCase() !== "featured-campus"
  );
}

function stringOrDefault(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function integerOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}
