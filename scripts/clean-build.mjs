import { rm } from "node:fs/promises";
import { resolve } from "node:path";

await Promise.all([
  rm(resolve("dist"), { force: true, recursive: true, maxRetries: 3 }).catch(() => {}),
  rm(resolve("out"), { force: true, recursive: true, maxRetries: 3 }).catch(() => {}),
  rm(resolve("patient"), { force: true, recursive: true, maxRetries: 3 }).catch(() => {}),
  rm(resolve("_next"), { force: true, recursive: true, maxRetries: 3 }).catch(() => {}),
  rm(resolve("index.html"), { force: true, maxRetries: 3 }).catch(() => {}),
]);

