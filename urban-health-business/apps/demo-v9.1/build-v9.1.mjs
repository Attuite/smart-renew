import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(process.argv[2] || path.dirname(fileURLToPath(import.meta.url)));
const read = (relative, encoding = null) => fs.readFileSync(path.join(root, relative), encoding || undefined);
const mime = (relative) => relative.endsWith(".png") ? "image/png"
  : relative.endsWith(".jpg") || relative.endsWith(".jpeg") ? "image/jpeg"
  : relative.endsWith(".woff2") ? "font/woff2"
  : "application/octet-stream";
const dataUri = (relative) => `data:${mime(relative)};base64,${read(relative).toString("base64")}`;

let html = read("index-v9.1.html", "utf8");
let css = read("styles-v9.1.css", "utf8");
const js = read("app-v9.1.js", "utf8");
let fontCss = read("assets/fonts/noto-sans-sc.css", "utf8");

for (const file of fs.readdirSync(path.join(root, "assets/fonts")).filter((file) => file.endsWith(".woff2"))) {
  const uri = dataUri(`assets/fonts/${file}`);
  fontCss = fontCss.split(`url(./${file})`).join(`url("${uri}")`);
  fontCss = fontCss.split(`url("./${file}")`).join(`url("${uri}")`);
}
css = css.replace(/^@import\s+url\(["']\.\/assets\/fonts\/noto-sans-sc\.css["']\);\s*/m, fontCss + "\n");

const binaryPaths = [
  "assets/xian-city-map.jpg",
  ...fs.readdirSync(path.join(root, "assets/project-thumbnails")).sort().map((file) => `assets/project-thumbnails/${file}`),
  ...fs.readdirSync(path.join(root, "assets/recognition")).sort().map((file) => `assets/recognition/${file}`)
];

// Callback replacers preserve every `$` and `$$` in the source JavaScript.
html = html.replace(/<link\s+rel="stylesheet"\s+href="\.\/styles-v9\.1\.css"\s*\/?>/, () => `<style>\n${css}\n</style>`);
html = html.replace(/<script\s+src="\.\/app-v9\.1\.js"><\/script>/, () => `<script>\n${js}\n</script>`);
for (const relative of binaryPaths) html = html.split(`./${relative}`).join(dataUri(relative));

if (/\bassets\//.test(html)) throw new Error("Built preview still contains assets/ path");
if (/https?:\/\//i.test(html)) throw new Error("Built preview contains external HTTP(S) resource");
if (!html.includes("const $$ =")) throw new Error("Inline JavaScript lost the $$ selector helper");
if ((html.match(/<script>/g) || []).length !== 1 || (html.match(/<\/script>/g) || []).length !== 1) throw new Error("Unexpected inline script count");

fs.writeFileSync(path.join(root, "preview-v9.1.html"), html);
console.log(`built ${Buffer.byteLength(html)} bytes`);
