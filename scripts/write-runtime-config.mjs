import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

let envFileContent = "";
try {
  envFileContent = await readFile(resolve(".env"), "utf8");
} catch {
  // Fresh production checkouts may not have an .env file.
}

function getEnvVal(key, fallback = "") {
  if (process.env[key]) return process.env[key];
  const prefix = `${key}=`;
  const line = envFileContent
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  return line ? line.slice(prefix.length).trim() : fallback;
}

async function readExistingRuntimeConfig() {
  const candidates = [
    resolve("public", "runtime-config.js"),
    resolve("dist", "patient", "runtime-config.js"),
    resolve("dist", "runtime-config.js"),
  ];

  for (const candidate of candidates) {
    try {
      return await readFile(candidate, "utf8");
    } catch {
      // Try the next previously published config.
    }
  }

  return "";
}

function parseRuntimeConfig(content) {
  if (!content) return {};
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  try {
    return JSON.parse(content.slice(start, end + 1));
  } catch {
    return {};
  }
}

const existingRuntimeConfig = parseRuntimeConfig(await readExistingRuntimeConfig());

const apiBaseUrl = String(
  getEnvVal("PATIENT_API_BASE_URL", "") ||
  existingRuntimeConfig.API_BASE_URL ||
  "https://hospital.bfirstkok.me"
).trim().replace(/\/$/, "");

const refreshMs = Number(
  getEnvVal("PATIENT_STATUS_REFRESH_MS", "") ||
  existingRuntimeConfig.STATUS_REFRESH_MS ||
  "10000"
) || 10000;

const googleClientId = String(
  getEnvVal("GOOGLE_CLIENT_ID", "") ||
  getEnvVal("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "") ||
  getEnvVal("PATIENT_GOOGLE_CLIENT_ID", "") ||
  existingRuntimeConfig.GOOGLE_CLIENT_ID ||
  ""
).trim();

if (!googleClientId) {
  console.warn(
    "[runtime-config] GOOGLE_CLIENT_ID is empty; Google Sign-In will be unavailable."
  );
}

const parsedUrl = new URL(apiBaseUrl);
const localHosts = new Set(["localhost", "127.0.0.1"]);

if (parsedUrl.protocol !== "https:" && !localHosts.has(parsedUrl.hostname)) {
  throw new Error("PATIENT_API_BASE_URL must use HTTPS outside local development");
}

const output = `window.PATIENT_APP_ENV = ${JSON.stringify({
  API_BASE_URL: apiBaseUrl,
  STATUS_REFRESH_MS: refreshMs,
  GOOGLE_CLIENT_ID: googleClientId,
}, null, 2)};\n`;

await mkdir(resolve("public"), { recursive: true });
await writeFile(resolve("public", "runtime-config.js"), output, "utf8");
