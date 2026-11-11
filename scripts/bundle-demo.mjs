import fs from "node:fs";
import path from "node:path";
const root = process.cwd(),
  dist = path.join(root, "dist");
const index = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const jsFile = index.match(/<script[^>]+src="([^"]+)"/)?.[1];
const cssFile = index.match(/<link[^>]+href="([^"]+\.css)"/)?.[1];
if (!jsFile || !cssFile)
  throw new Error("Build the website first with npm run build.");
const mime = {
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};
const dataURL = (file) =>
  `data:${mime[path.extname(file)] || "application/octet-stream"};base64,${fs.readFileSync(file).toString("base64")}`;
const artwork = Object.fromEntries(
  fs
    .readdirSync(path.join(dist, "characters"))
    .filter((n) => n.endsWith(".png"))
    .map((n) => [
      path.basename(n, ".png"),
      dataURL(path.join(dist, "characters", n)),
    ]),
);
const css = fs
  .readFileSync(path.join(dist, cssFile), "utf8")
  .replace(/url\(([^)]+)\)/g, (original, ref) => {
    const clean = ref.replace(/^['"]|['"]$/g, "");
    if (clean.startsWith("data:")) return original;
    const file = path.join(
      dist,
      clean.startsWith("/") ? clean : path.join("assets", clean),
    );
    return fs.existsSync(file) ? `url("${dataURL(file)}")` : original;
  });
const js = fs
  .readFileSync(path.join(dist, jsFile), "utf8")
  .replace(/<\/script/gi, "<\\/script");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Adventures of Mint — Play the Demo</title><link rel="icon" href="${dataURL(path.join(dist, "favicon.svg"))}"><style>${css}</style></head><body><div id="root"></div><script>globalThis.__MINT_ART__=${JSON.stringify(artwork)};</script><script type="module">${js}</script></body></html>`;
fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
const output = path.join(root, "artifacts", "adventures-of-mint.html");
fs.writeFileSync(output, html);
console.log(
  `Standalone playable demo: ${output} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MiB)`,
);
