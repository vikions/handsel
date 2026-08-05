import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const root = resolve("frontend/dist");
const host = "127.0.0.1";
const port = Number(process.env.FRONTEND_PORT || 5173);
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
]);

if (!existsSync(resolve(root, "index.html"))) {
  throw new Error("frontend/dist is missing. Run the frontend build first.");
}

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || "/", `http://${host}`).pathname);
  const requested = resolve(root, `.${pathname}`);
  const insideRoot = requested === root || requested.startsWith(`${root}${sep}`);
  const file = insideRoot && existsSync(requested) && statSync(requested).isFile() ? requested : resolve(root, "index.html");

  response.statusCode = 200;
  response.setHeader("Content-Type", contentTypes.get(extname(file)) || "application/octet-stream");
  response.setHeader("Cache-Control", file.endsWith("index.html") ? "no-cache" : "public, max-age=3600");
  createReadStream(file).pipe(response);
}).listen(port, host, () => {
  console.log(`Handsel frontend available at http://${host}:${port}`);
});

