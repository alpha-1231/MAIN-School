const fs = require("fs");
const { spawnSync } = require("child_process");

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanStringArray(value) {
  return ensureArray(value)
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function stringOrDefault(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
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

function normalizeUrl(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  if (/^(https?:|mailto:|tel:)/i.test(text)) {
    return text;
  }
  if (/^www\./i.test(text) || /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(text)) {
    return `https://${text.replace(/^https?:\/\//i, "")}`;
  }
  return "";
}

function sanitizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizePathSegment(value) {
  return (
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "business"
  );
}

function normalizeHexColor(value, fallback = "#355da8") {
  const text = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(text)) {
    return text;
  }
  return fallback;
}

function hexToRgb(hex) {
  const cleaned = hex.replace("#", "");
  return {
    r: Number.parseInt(cleaned.slice(0, 2), 16),
    g: Number.parseInt(cleaned.slice(2, 4), 16),
    b: Number.parseInt(cleaned.slice(4, 6), 16),
  };
}

function buildThemePalette(seed) {
  const hex = normalizeHexColor(seed, "#355da8");
  const rgb = hexToRgb(hex);
  return {
    primary: hex,
    primarySoft: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`,
    paper: "#f8f4ee",
    ink: "#1f2937",
    muted: "#5f6b7a",
    border: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18)`,
  };
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
  fs.mkdirSync(require("path").dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, spacing), "utf8");
}

function runCommand(command, args, cwd, timeoutMs) {
  const useShell = process.platform === "win32" && /\.(bat|cmd)$/i.test(String(command || ""));
  const result = useShell
    ? spawnSync(
        buildShellCommand(command, args),
        {
          cwd,
          encoding: "utf8",
          timeout: timeoutMs,
          windowsHide: true,
          shell: true,
        }
      )
    : spawnSync(command, args, {
        cwd,
        encoding: "utf8",
        timeout: timeoutMs,
        windowsHide: true,
      });

  return {
    status: typeof result.status === "number" ? result.status : 1,
    log: [result.stdout, result.stderr, result.error?.message]
      .map((part) => stringOrDefault(part))
      .filter(Boolean)
      .join("\n")
      .trim(),
  };
}

function buildShellCommand(command, args) {
  return [command, ...ensureArray(args).map((value) => quoteShellArg(value))]
    .filter(Boolean)
    .join(" ");
}

function quoteShellArg(value) {
  const text = String(value ?? "");
  if (!text) {
    return '""';
  }
  if (!/[\s"]/u.test(text)) {
    return text;
  }
  return `"${text.replace(/(\\*)"/g, '$1$1\\"')}"`;
}

function trimLog(logText) {
  const log = String(logText || "").trim();
  if (log.length <= 4000) {
    return log;
  }
  return `${log.slice(0, 3800)}\n\n...[truncated]...`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeXml(value) {
  return escapeHtml(value);
}

function escapeYaml(value) {
  return String(value ?? "").replaceAll('"', '\\"');
}

function initialsOf(value) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) {
    return "I";
  }
  const first = parts[0][0] || "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] || "" : "";
  return `${first}${second}`.toUpperCase();
}

function toEmbedVideoUrl(url) {
  const value = String(url || "").trim();
  if (!value) {
    return "";
  }

  try {
    const parsed = new URL(value);
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replaceAll("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : "";
    }
  } catch {}

  return "";
}

function isDirectVideoUrl(url) {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(String(url || "").trim());
}

module.exports = {
  buildThemePalette,
  cleanStringArray,
  ensureArray,
  escapeHtml,
  escapeXml,
  escapeYaml,
  initialsOf,
  isDirectVideoUrl,
  normalizeFloat,
  normalizeHexColor,
  normalizeInteger,
  normalizeUrl,
  readJson,
  runCommand,
  sanitizePathSegment,
  sanitizeSlug,
  stringOrDefault,
  toEmbedVideoUrl,
  trimLog,
  writeJson,
};
