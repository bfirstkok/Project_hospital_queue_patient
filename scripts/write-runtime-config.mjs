import { writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";

let envFileContent = "";
try {
  envFileContent = await readFile(resolve(".env"), "utf8");
} catch {
  // Ignore
}

function getEnvVal(key, fallback) {
  if (process.env[key]) return process.env[key];
  const match = envFileContent.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match ? match[1].trim() : fallback;
}

const apiBaseUrl = String(getEnvVal("PATIENT_API_BASE_URL", "http://127.0.0.1:8000")).replace(/\/$/, "");
const refreshMs = Number(getEnvVal("PATIENT_STATUS_REFRESH_MS", "10000")) || 10000;
const googleClientId = String(
  getEnvVal("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "") ||
  getEnvVal("PATIENT_GOOGLE_CLIENT_ID", "") ||
  getEnvVal("GOOGLE_CLIENT_ID", "")
).trim();
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
