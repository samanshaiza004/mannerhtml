import { cp, mkdir, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(siteRoot);
const outputRoot = join(projectRoot, "website-dist");

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await cp(siteRoot, outputRoot, {
  recursive: true,
  filter: (source) => !["build.mjs", "server.mjs", "dist"].includes(basename(source)),
});
await cp(join(projectRoot, "dist"), join(outputRoot, "dist"), { recursive: true });
console.log(`Website built at ${outputRoot}`);
