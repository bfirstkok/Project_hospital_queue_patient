import { rm } from "node:fs/promises";
import { resolve } from "node:path";

// Next.js เขียนไฟล์ใหม่ใน out; dist อาจถูก Caddy mount อยู่ จึงห้ามลบก่อน build สำเร็จ
await rm(resolve("out"), { force: true, recursive: true, maxRetries: 3 });

