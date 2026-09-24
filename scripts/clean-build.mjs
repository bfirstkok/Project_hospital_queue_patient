import { rm } from "node:fs/promises";
import { resolve } from "node:path";

// สคริปต์ทำความสะอาด (Clean Build Artifacts)
// ลบโฟลเดอร์ผลลัพธ์จากการ Build ครั้งก่อนหน้า (dist, out, patient, _next, index.html) เพื่อป้องกันไฟล์แคชตกค้างก่อนเริ่มกระบวนการ Build ใหม่
await Promise.all([
  rm(resolve("dist"), { force: true, recursive: true, maxRetries: 3 }).catch(() => {}),
  rm(resolve("out"), { force: true, recursive: true, maxRetries: 3 }).catch(() => {}),
  rm(resolve("patient"), { force: true, recursive: true, maxRetries: 3 }).catch(() => {}),
  rm(resolve("_next"), { force: true, recursive: true, maxRetries: 3 }).catch(() => {}),
  rm(resolve("index.html"), { force: true, maxRetries: 3 }).catch(() => {}),
]);

