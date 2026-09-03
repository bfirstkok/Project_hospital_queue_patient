import { cp, rm } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve("out");
const dist = resolve("dist");
const distPatient = resolve("dist/patient");

await cp(output, dist, { recursive: true });
await cp(output, distPatient, { recursive: true });
await rm(output, { force: true, recursive: true });
