import { cp, rm, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve("out");
const dist = resolve("dist");
const distPatient = resolve("dist/patient");

await cp(output, dist, { recursive: true });
await cp(output, distPatient, { recursive: true });
await rm(output, { force: true, recursive: true });

// Ensure root index.html in dist/ redirects to /patient to prevent Next.js basePath mismatch crash
const rootHtmlPath = resolve(dist, "index.html");
try {
  let content = await readFile(rootHtmlPath, "utf8");
  const redirectScript = "<script>if(location.pathname==='/'||location.pathname===''){location.replace('/patient/'+location.search+location.hash);}</script>";
  if (!content.includes(redirectScript)) {
    content = content.replace("<head>", `<head>${redirectScript}`);
    await writeFile(rootHtmlPath, content, "utf8");
  }
} catch {
  // Ignore if root index.html not found
}

