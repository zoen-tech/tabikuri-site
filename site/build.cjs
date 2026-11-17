const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const repo = path.resolve(__dirname, "..");
const dist = path.join(repo, "dist");
const configText = fs.readFileSync(path.join(__dirname, "config.js"), "utf8");
const configSandbox = { window: {} };
vm.runInNewContext(configText, configSandbox);
const config = configSandbox.window.SITE_CONFIG;
const noindex = config.NOINDEX === true;
const publicBuild = config.PUBLIC_BUILD === true || process.env.PUBLIC_BUILD === "true";
const siteOrigin = String(config.SITE_ORIGIN || "https://tabikuri.online").replace(/\/$/, "");
const pages = [
  ["s1", ""], ["s2", "mounjaro"], ["s3", "cart"], ["s4", "confirm"],
  ["s5", "guide"], ["s6", "notice"], ["s7", "legal"], ["s8", "privacy"],
  ["s9", "terms"], ["s404", "404"]
];

function shell(lang, page, route) {
  const copy = JSON.parse(fs.readFileSync(path.join(__dirname, "i18n", `${lang}.json`), "utf8"));
  const brand = typeof config.BRAND_NAME === "object" ? config.BRAND_NAME[lang] : config.BRAND_NAME;
  const opposite = lang === "ko" ? "ja" : "ko";
  const sameRoute = route === "404" ? "/" : `/${route ? `${route}/` : ""}`;
  const koURL = sameRoute;
  const jaURL = route === "404" ? "/ja/" : `/ja/${route ? `${route}/` : ""}`;
  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  ${noindex ? '<meta name="robots" content="noindex, nofollow">' : ""}
  <meta name="color-scheme" content="light">
  <title>${brand} | ${copy.meta[page]}</title>
  <link rel="alternate" hreflang="ko" href="${siteOrigin}${koURL}">
  <link rel="alternate" hreflang="ja" href="${siteOrigin}${jaURL}">
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="/assets/styles.css">
  <script defer src="/config.js"></script>
  <script defer src="/prices.js"></script>
  <script defer src="/assets/cart.js"></script>
  <script defer src="/assets/app.js"></script>
</head>
<body data-lang="${lang}" data-page="${page}" data-opposite="${opposite}">
  <div id="app" aria-busy="true"></div>
  <noscript${publicBuild ? "" : ' data-review="pending"'}>${copy.ui.noScript} <a href="mailto:${copy.reviewed.email}">${copy.reviewed.email}</a></noscript>
</body>
</html>
`;
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, "assets"), { recursive: true });
fs.mkdirSync(path.join(dist, "i18n"), { recursive: true });
for (const file of ["app.js", "cart.js", "styles.css"]) {
  let source = fs.readFileSync(path.join(__dirname, "src", file), "utf8");
  if (publicBuild && file === "app.js") {
    source = source
      .replace(/^\s*const pending = new Set\([^\n]+\);$/m, '    const pending = new Set();')
      .replace(/^\s*const attr = key =>[^\n]+;$/m, '    const attr = () => "";')
      .replace(/ data-review="pending"/g, "");
  }
  if (publicBuild && file === "styles.css") {
    source = source.replace(/^.*data-(?:review|copy-key).*$(?:\r?\n)?/gm, "");
  }
  fs.writeFileSync(path.join(dist, "assets", file), source);
}
for (const lang of ["ko", "ja"]) {
  const source = path.join(__dirname, "i18n", `${lang}.json`);
  if (publicBuild) {
    const copy = JSON.parse(fs.readFileSync(source, "utf8"));
    delete copy.pending;
    fs.writeFileSync(path.join(dist, "i18n", `${lang}.json`), `${JSON.stringify(copy, null, 2)}\n`);
  } else {
    fs.copyFileSync(source, path.join(dist, "i18n", `${lang}.json`));
  }
  for (const [page, route] of pages) {
    const target = route === "404"
      ? path.join(dist, ...(lang === "ja" ? ["ja", "404.html"] : ["404.html"]))
      : path.join(dist, ...(lang === "ja" ? ["ja"] : []), route, "index.html");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, shell(lang, page, route));
  }
}
const pricesSource = fs.readFileSync(path.join(repo, "prices.js"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*(?:\r?\n|$)/gm, "")
  .replace(/^\s*\n/gm, "");
fs.writeFileSync(path.join(dist, "prices.js"), pricesSource);
fs.copyFileSync(path.join(__dirname, "config.js"), path.join(dist, "config.js"));
console.log(`Built ${pages.length * 2} pages in ${dist}`);
