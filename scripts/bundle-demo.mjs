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
  ".webp": "image/webp",
};
const dataURL = (file) =>
  `data:${mime[path.extname(file)] || "application/octet-stream"};base64,${fs.readFileSync(file).toString("base64")}`;
function embedArt(folder, extension) {
  const directory = path.join(dist, folder);
  return Object.fromEntries(
    fs
      .readdirSync(directory)
      .filter((name) => name.endsWith(extension))
      .map((name) => [
        path.basename(name, extension),
        dataURL(path.join(directory, name)),
      ]),
  );
}
const artwork = embedArt("characters", ".png");
const scenery = embedArt("scenery", ".png");
const abilities = embedArt("abilities", ".webp");
const ui = embedArt("ui", ".webp");
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
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Adventures of Mint — Play the Demo</title><link rel="icon" href="${dataURL(path.join(dist, "favicon.svg"))}"><style>${css}</style></head><body><div id="root"></div><script>globalThis.__MINT_ART__=${JSON.stringify(artwork)};globalThis.__MINT_SCENERY__=${JSON.stringify(scenery)};globalThis.__MINT_ABILITIES__=${JSON.stringify(abilities)};globalThis.__MINT_UI__=${JSON.stringify(ui)};</script><script type="module">${js}</script></body></html>`;
fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
const output = path.join(root, "artifacts", "adventures-of-mint.html");
fs.writeFileSync(output, html);
console.log(
  `Standalone playable demo: ${output} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MiB)`,
);
