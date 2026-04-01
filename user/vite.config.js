import fs from "fs";
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.resolve(ROOT_DIR, "admin", "data");
const BASIC_INDEX_FILE = path.join(DATA_DIR, "basic", "_cards.json");
const DETAILED_DIR = path.join(DATA_DIR, "detailed");
const PROVINCE_NAMES = {
  "1": "Koshi",
  "2": "Madhesh",
  "3": "Bagmati",
  "4": "Gandaki",
  "5": "Lumbini",
  "6": "Karnali",
  "7": "Sudurpashchim",
};

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/user/" : "/",
  plugins: [react(), localPublicApiPlugin()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
}));

function localPublicApiPlugin() {
  return {
    name: "local-public-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || "").split("?")[0];

        if (url === "/api/public/list") {
          sendJson(res, {
            success: true,
            data: loadPublicBusinessList(),
          });
          return;
        }

        const detailMatch = url.match(/^\/api\/public\/get\/([^/]+)$/);
        if (detailMatch) {
          const record = loadPublicBusinessDetail(detailMatch[1]);
          if (!record) {
            res.statusCode = 404;
            sendJson(res, { success: false, error: "Not found" });
            return;
          }

          sendJson(res, {
            success: true,
            data: record,
          });
          return;
        }

        next();
      });
    },
  };
}

function loadPublicBusinessList() {
  return loadBasicCards().filter(isPublicRecordVisible).map(decoratePublicRecord);
}

function loadPublicBusinessDetail(slug) {
  const normalizedSlug = sanitizeSlug(slug);
  if (!normalizedSlug) {
    return null;
  }

  const basicCards = loadBasicCards();
  const basic = basicCards.find((item) => item.slug === normalizedSlug) || {};
  const detailed = readJson(path.join(DETAILED_DIR, `${normalizedSlug}.json`), null);
  const mergedSource = { ...basic, ...(detailed || {}) };
  const merged = decoratePublicRecord(mergedSource);

  if (!merged.slug || !isPublicRecordVisible(mergedSource)) {
    return null;
  }

  return merged;
}

function loadBasicCards() {
  const cards = readJson(BASIC_INDEX_FILE, []);
  return Array.isArray(cards) ? cards : [];
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
    search_text: buildSearchText(record, provinceName),
  };
}

function isPublicRecordVisible(record) {
  return normalizeStatus(record?.subscription?.payment_status) === "active";
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
    ...(record?.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function normalizeStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "active" ? "active" : normalized === "expired" ? "expired" : "pending";
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
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

function sendJson(res, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}
