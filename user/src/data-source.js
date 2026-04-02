import {
  decoratePublicRecord,
  isPublicRecordVisible,
  processPublicBusinessRecords,
} from "./directory-records";

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

export async function fetchBusinessDirectory(options = {}) {
  const { forceRefresh = false, status = null } = options;

  if (DATA_SOURCE.mode === "github-raw") {
    const response = await fetch(buildRawUrl("basic/_cards.json", forceRefresh), {
      cache: forceRefresh ? "no-store" : "default",
    });
    const records = await parseJsonResponse(response);

    return {
      businesses: await processDirectoryList(records, { sourceIsPublic: false }),
      status: normalizeDirectoryStatus(status || extractDirectoryStatusFromHeaders(response)),
    };
  }

  const payload = await fetchLocalJson("/api/public/list", {
    cache: forceRefresh ? "no-store" : "default",
  });

  return {
    businesses: await processDirectoryList(payload.data, { sourceIsPublic: true }),
    status: normalizeDirectoryStatus(payload.meta || status),
  };
}

export async function fetchBusinessList(options = {}) {
  const payload = await fetchBusinessDirectory(options);
  return payload.businesses;
}

export async function fetchBusinessListStatus(options = {}) {
  const { forceRefresh = false } = options;

  if (DATA_SOURCE.mode === "github-raw") {
    return fetchRawDirectoryStatus(forceRefresh);
  }

  const payload = await fetchLocalJson("/api/public/meta", {
    cache: forceRefresh ? "no-store" : "default",
  });
  return normalizeDirectoryStatus(payload.data);
}

export async function fetchBusinessDetail(slug) {
  const normalizedSlug = sanitizeSlug(slug);
  if (!normalizedSlug) {
    throw new Error("Invalid business identifier.");
  }

  if (DATA_SOURCE.mode === "github-raw") {
    const record = await fetchRawJson(buildRawUrl(`detailed/${normalizedSlug}.json`, true), true);
    if (!record || !isPublicRecordVisible(record)) {
      throw new Error("Not found.");
    }

    return decoratePublicRecord(record);
  }

  const payload = await fetchLocalJson(`/api/public/get/${normalizedSlug}`, { cache: "no-store" });
  return payload.data ? decoratePublicRecord(payload.data) : null;
}

async function processDirectoryList(records, options = {}) {
  if (!Array.isArray(records) || !records.length) {
    return [];
  }

  if (shouldUseDirectoryWorker(records.length)) {
    try {
      return await runDirectoryWorker(records, options);
    } catch {
      // Fall back to synchronous processing below.
    }
  }

  return processPublicBusinessRecords(records, { ...options, summary: true });
}

function shouldUseDirectoryWorker(recordCount) {
  return typeof window !== "undefined" && typeof Worker === "function" && recordCount >= 150;
}

function runDirectoryWorker(records, options = {}) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./directory-worker.js", import.meta.url), {
      type: "module",
    });

    function cleanup() {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      worker.terminate();
    }

    function handleMessage(event) {
      cleanup();
      if (event.data?.success) {
        resolve(Array.isArray(event.data.data) ? event.data.data : []);
        return;
      }

      reject(new Error(event.data?.error || "Unable to process the directory."));
    }

    function handleError(event) {
      cleanup();
      reject(event.error || new Error("Unable to process the directory."));
    }

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    worker.postMessage({ records, options: { ...options, summary: true } });
  });
}

async function fetchLocalJson(url, options = {}) {
  const payload = await fetchJson(url, options);
  if (payload?.success === false) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload;
}

async function fetchRawDirectoryStatus(forceRefresh = false) {
  const url = buildRawUrl("basic/_cards.json", forceRefresh);

  try {
    const response = await fetch(url, {
      method: "HEAD",
      cache: forceRefresh ? "no-store" : "default",
    });
    return normalizeDirectoryStatus(extractDirectoryStatusFromHeaders(response));
  } catch {
    const response = await fetch(url, {
      method: "GET",
      cache: forceRefresh ? "no-store" : "default",
    });
    return normalizeDirectoryStatus(extractDirectoryStatusFromHeaders(response));
  }
}

async function fetchRawJson(url, forceRefresh = false) {
  return fetchJson(url, { cache: forceRefresh ? "no-store" : "default" });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  return parseJsonResponse(response);
}

async function parseJsonResponse(response) {
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

function extractDirectoryStatusFromHeaders(response) {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}.`);
  }

  const headers = response.headers;
  return {
    version: [
      headers.get("etag"),
      headers.get("last-modified"),
      headers.get("content-length"),
    ]
      .filter(Boolean)
      .join("|"),
    updated_at: headers.get("last-modified") || "",
  };
}

function normalizeDirectoryStatus(status) {
  const normalized = status || {};
  return {
    version: String(normalized.version || "").trim(),
    updated_at: String(normalized.updated_at || "").trim(),
    count: Number.isFinite(Number(normalized.count)) ? Number(normalized.count) : null,
  };
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
  if (!root) {
    return "";
  }

  return normalizeGithubRoot(root).replace(/\/+$/, "");
}

function normalizeGithubRoot(value) {
  try {
    const url = new URL(value);
    const hostname = String(url.hostname || "").toLowerCase();
    if (hostname !== "github.com" && hostname !== "www.github.com") {
      return value;
    }

    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length < 4) {
      return value;
    }

    const marker = segments[2];
    if (marker !== "tree" && marker !== "blob") {
      return value;
    }

    const owner = segments[0];
    const repo = segments[1];
    const branch = segments[3];
    const rest = segments.slice(4).join("/");
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}${rest ? `/${rest}` : ""}`;
  } catch {
    return value;
  }
}

function sanitizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
