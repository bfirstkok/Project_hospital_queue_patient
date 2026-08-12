import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const apiBaseUrl = String(process.env.PATIENT_API_BASE_URL || "https://hospital.bfirstkok.me").replace(/\/$/, "");
const refreshMs = Number(process.env.PATIENT_STATUS_REFRESH_MS) || 10000;
const parsedUrl = new URL(apiBaseUrl);
const localHosts = new Set(["localhost", "127.0.0.1"]);

if (parsedUrl.protocol !== "https:" && !localHosts.has(parsedUrl.hostname)) {
  throw new Error("PATIENT_API_BASE_URL must use HTTPS outside local development");
}

const output = `window.PATIENT_APP_ENV = ${JSON.stringify({
  API_BASE_URL: apiBaseUrl,
  STATUS_REFRESH_MS: refreshMs,
}, null, 2)};\n`;

await writeFile(resolve("public", "runtime-config.js"), output, "utf8");
