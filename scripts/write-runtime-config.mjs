import { writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";

let envFileContent = "";
try {
  envFileContent = await readFile(resolve(".env"), "utf8");
} catch {
  // Ignore
}

let existingRuntimeConfig = "";
try {
  existingRuntimeConfig = await readFile(resolve("public", "runtime-config.js"), "utf8");
} catch {
  // A fresh checkout may not have the generated file yet.
}

function getExistingRuntimeValue(key) {
  const match = existingRuntimeConfig.match(
    new RegExp(`["']?${key}["']?\\s*:\\s*["']([^"']*)["']`)
  );
  return match ? match[1].trim() : "";
}

function getEnvVal(key, fallback) {
  if (process.env[key]) return process.env[key];
  const match = envFileContent.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match ? match[1].trim() : fallback;
}

const apiBaseUrl = String(getEnvVal("PATIENT_API_BASE_URL", "https://hospital.bfirstkok.me")).replace(/\/$/, "");
const refreshMs = Number(getEnvVal("PATIENT_STATUS_REFRESH_MS", "10000")) || 10000;
const googleClientId = String(
  getEnvVal("GOOGLE_CLIENT_ID", "") ||
  getEnvVal("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "") ||
  getEnvVal("PATIENT_GOOGLE_CLIENT_ID", "") ||
  getExistingRuntimeValue("GOOGLE_CLIENT_ID")
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

await writeFile(resolve("public", "runtime-config.js"), output, "utf8");
