const fs = require("node:fs");
const path = require("node:path");

const repo = path.resolve(__dirname, "..");
const dist = path.join(repo, "dist");
const configText = fs.readFileSync(path.join(__dirname, "config.js"), "utf8");
const noindex = /NOINDEX:\s*true/.test(configText);
const pages = [
  ["s1", ""], ["s2", "mounjaro"], ["s3", "cart"], ["s4", "confirm"],
  ["s5", "guide"], ["s6", "notice"], ["s7", "legal"], ["s8", "privacy"],
  ["s9", "terms"], ["s404", "404"]
];

function shell(lang, page, route) {
  const copy = JSON.parse(fs.readFileSync(path.join(__dirname, "i18n", `${lang}.json`), "utf8"));
  const opposite = lang === "ko" ? "ja" : "ko";
  const sameRoute = route === "404" ? "/" : `/${route ? `${route}/` : ""}`;
  const koURL = lang === "ko" ? sameRoute : sameRoute.replace(/^\//, "/").replace(/^\/(?!ja)/, "/");
  const jaURL = route === "404" ? "/ja/" : `/ja/${route ? `${route}/` : ""}`;
  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  ${noindex ? '<meta name="robots" content="noindex, nofollow">' : ""}
  <meta name="color-scheme" content="light">
  <title>${copy.meta[page]}</title>
  <link rel="alternate" hreflang="ko" href="${koURL}">
  <link rel="alternate" hreflang="ja" href="${jaURL}">
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="/assets/styles.css">
  <script defer src="/config.js"></script>
  <script defer src="/prices.js"></script>
  <script defer src="/assets/cart.js"></script>
  <script defer src="/assets/app.js"></script>
</head>
<body data-lang="${lang}" data-page="${page}" data-opposite="${opposite}">
  <div id="app" aria-busy="true"></div>
  <noscript data-review="pending">${copy.ui.noScript} <a href="mailto:${copy.reviewed.email}">${copy.reviewed.email}</a></noscript>
</body>
</html>
`;
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, "assets"), { recursive: true });
fs.mkdirSync(path.join(dist, "i18n"), { recursive: true });
for (const file of ["app.js", "cart.js", "styles.css"]) {
  fs.copyFileSync(path.join(__dirname, "src", file), path.join(dist, "assets", file));
}
for (const lang of ["ko", "ja"]) {
  fs.copyFileSync(path.join(__dirname, "i18n", `${lang}.json`), path.join(dist, "i18n", `${lang}.json`));
  for (const [page, route] of pages) {
    const target = route === "404"
      ? path.join(dist, ...(lang === "ja" ? ["ja", "404.html"] : ["404.html"]))
      : path.join(dist, ...(lang === "ja" ? ["ja"] : []), route, "index.html");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, shell(lang, page, route));
  }
}
fs.copyFileSync(path.join(repo, "prices.js"), path.join(dist, "prices.js"));
fs.copyFileSync(path.join(__dirname, "config.js"), path.join(dist, "config.js"));
console.log(`Built ${pages.length * 2} pages in ${dist}`);
