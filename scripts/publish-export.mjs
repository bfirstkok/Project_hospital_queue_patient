import { cp, rm } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve("out");

await cp(output, resolve("dist"), { recursive: true });
await rm(output, { force: true, recursive: true });
