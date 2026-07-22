import { cp, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "dist");
const apiBaseUrl = String(process.env.PATIENT_API_BASE_URL || "").replace(/\/$/, "");
const refreshMs = Number(process.env.PATIENT_STATUS_REFRESH_MS) || 10000;

if (!apiBaseUrl) {
  throw new Error("PATIENT_API_BASE_URL is required");
}

const parsedUrl = new URL(apiBaseUrl);
const localHosts = new Set(["localhost", "127.0.0.1"]);
if (parsedUrl.protocol !== "https:" && !localHosts.has(parsedUrl.hostname)) {
  throw new Error("PATIENT_API_BASE_URL must use HTTPS outside local development");
}

await mkdir(output, { recursive: true });
for (const filename of ["index.html", "styles.css", "app.js", "config.js"]) {
  await cp(resolve(root, filename), resolve(output, filename));
}

const runtimeConfig = `window.PATIENT_APP_ENV = ${JSON.stringify({
  API_BASE_URL: apiBaseUrl,
  STATUS_REFRESH_MS: refreshMs,
}, null, 2)};\n`;
await writeFile(resolve(output, "runtime-config.js"), runtimeConfig, "utf8");

console.log(`Built patient portal in ${output}`);
