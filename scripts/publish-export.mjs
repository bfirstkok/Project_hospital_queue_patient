import { cp, rm, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve("out");
const dist = resolve("dist");
const distPatient = resolve("dist/patient");

// คัดลอกไฟล์จาก Next.js Static Export (โฟลเดอร์ out) ไปยัง dist และ dist/patient เพื่อรองรับทั้ง Base URL และ Subpath /patient
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
} catch {
  // ไม่ต้องดำเนินการใดหากไม่พบไฟล์ root index.html
}

