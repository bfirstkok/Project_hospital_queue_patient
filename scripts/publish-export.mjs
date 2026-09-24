import { cp, rm, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve("out");
const dist = resolve("dist");
const distPatient = resolve("dist/patient");

// อัปเดตไฟล์ใน dist เดิมโดยไม่เปลี่ยนตัวโฟลเดอร์ เพราะ Caddy bind mount โฟลเดอร์นี้อยู่
// หาก build ล้มเหลวสคริปต์นี้จะไม่ถูกเรียก และ dist ที่ใช้งานอยู่จะยังคงอยู่
await cp(output, dist, { recursive: true });
await cp(output, distPatient, { recursive: true });
await rm(output, { force: true, recursive: true });

// เพิ่มสคริปต์ Redirect อัตโนมัติใน dist/index.html ให้วิ่งไปยัง /patient เพื่อป้องกันปัญหา basePath ไม่ตรงกันใน Next.js Static Export
const rootHtmlPath = resolve(dist, "index.html");
try {
  let content = await readFile(rootHtmlPath, "utf8");
  const redirectScript = "<script>if(location.pathname==='/'||location.pathname===''){location.replace('/patient/'+location.search+location.hash);}</script>";
  if (!content.includes(redirectScript)) {
    content = content.replace("<head>", `<head>${redirectScript}`);
    await writeFile(rootHtmlPath, content, "utf8");
  }
} catch (error) {
  throw new Error(`Missing published index.html: ${rootHtmlPath}`, { cause: error });
}

