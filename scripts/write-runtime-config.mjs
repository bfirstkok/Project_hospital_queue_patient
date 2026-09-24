import { writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";

let envFileContent = "";
try {
  // พยายามอ่านค่าคอนฟิกจากไฟล์ .env (ถ้ามี)
  envFileContent = await readFile(resolve(".env"), "utf8");
} catch {
  // ข้ามหากไม่มีไฟล์ .env (จะใช้ค่าจาก Environment Variables ของระบบ หรือค่าเริ่มต้นแทน)
}

<<<<<<< HEAD
// ฟังก์ชันดึงค่า Environment Variable จาก process.env หรือจากไฟล์ .env พร้อมกำหนดค่าเริ่มต้น (Fallback)
=======
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

>>>>>>> 96a0cf62c16669447fee14d9b22268b0c1f96be3
function getEnvVal(key, fallback) {
  if (process.env[key]) return process.env[key];
  const match = envFileContent.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match ? match[1].trim() : fallback;
}

// กำหนด URL ของ Backend API, ระยะเวลาการ Polling คิว, และ Google OAuth Client ID
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

// มาตรการความปลอดภัย: บังคับใช้ HTTPS เสมอเมื่ออยู่นอกโหมด Localhost เพื่อป้องกันการส่งข้อมูลทางการแพทย์ผ่านเครือข่ายที่ไม่เข้ารหัส
if (parsedUrl.protocol !== "https:" && !localHosts.has(parsedUrl.hostname)) {
  throw new Error("PATIENT_API_BASE_URL must use HTTPS outside local development");
}

// สร้างเนื้อหาไฟล์ JavaScript ที่ประกาศตัวแปรส่วนกลาง window.PATIENT_APP_ENV ให้ Client โหลดใช้งานแบบ Runtime Config
const output = `window.PATIENT_APP_ENV = ${JSON.stringify({
  API_BASE_URL: apiBaseUrl,
  STATUS_REFRESH_MS: refreshMs,
  GOOGLE_CLIENT_ID: googleClientId,
}, null, 2)};\n`;

// เขียนไฟล์ไปยัง public/runtime-config.js
await writeFile(resolve("public", "runtime-config.js"), output, "utf8");
