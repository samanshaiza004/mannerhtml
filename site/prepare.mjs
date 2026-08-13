import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const siteDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.dirname(siteDirectory);
const source = path.join(projectDirectory, "dist");
const target = path.join(siteDirectory, "public", "dist");

await rm(target, { recursive: true, force: true });
await mkdir(path.dirname(target), { recursive: true });
await cp(source, target, { recursive: true });
