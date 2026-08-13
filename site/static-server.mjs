import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const root = path.join(projectDirectory, "website-dist");
const base = "/mannerhtml";
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".xml": "application/xml; charset=utf-8",
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const relative = url.pathname.startsWith(base) ? url.pathname.slice(base.length) : url.pathname;
    let target = path.normalize(path.join(root, decodeURIComponent(relative)));
    if (!target.startsWith(root)) throw new Error("Path outside site root");
    if ((await stat(target)).isDirectory()) target = path.join(target, "index.html");
    const body = await readFile(target);
    response.writeHead(200, { "content-type": contentTypes[path.extname(target)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(4321, "127.0.0.1", () => {
  console.log("MannerHTML site available at http://127.0.0.1:4321/mannerhtml/");
});
