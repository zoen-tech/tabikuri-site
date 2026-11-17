const { test, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const childProcess = require("node:child_process");
const { create, COUNTS, TTL } = require("./src/cart.js");

const repo = path.resolve(__dirname, "..");
const dist = path.join(repo, "dist");
const pricesText = fs.readFileSync(path.join(repo, "prices.js"), "utf8");
const prices = vm.runInNewContext(`${pricesText}; JSON.parse(JSON.stringify(PRICES));`, { document: { querySelector: () => null } });
const copies = Object.fromEntries(["ko", "ja"].map(lang => [lang, JSON.parse(fs.readFileSync(path.join(__dirname, "i18n", `${lang}.json`), "utf8"))]));
const memoryStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};
const options = extra => ({ prices, storage: memoryStorage(), key: "test", ...extra });

before(() => childProcess.execFileSync(process.execPath, [path.join(__dirname, "build.cjs")], { cwd: repo }));

test("all 24 source prices are selectable without an extra quantity gate", () => {
  assert.equal(prices.length, 6);
  for (const row of prices) for (const [index, pens] of COUNTS.entries()) {
    const cart = create(options());
    assert.equal(cart.snapshot().count, 0);
    assert.equal(cart.lookup(row[0], pens), row[index + 1]);
    assert.equal(cart.add(row[0], pens).ok, true);
    assert.equal(cart.snapshot().total, row[index + 1]);
  }
});

test("multi-line is the default: different doses accumulate and the same dose replaces", () => {
  const cart = create(options());
  cart.add("2.5mg", 4);
  cart.add("5mg", 12);
  assert.equal(cart.snapshot().count, 2);
  assert.equal(cart.snapshot().total, prices[0][1] + prices[1][2]);
  const replacement = cart.add("2.5mg", 48);
  assert.equal(replacement.replaced, true);
  assert.equal(cart.snapshot().count, 2);
  assert.equal(cart.snapshot().total, prices[0][4] + prices[1][2]);
  assert.deepEqual(cart.snapshot().lines.map(line => line.dose), ["5mg", "2.5mg"]);
});

test("request codes use dose times ten, round-trip, and reject forged URL state", () => {
  const cart = create(options({ storage: null }));
  for (const [dose, expected] of [["2.5mg", "M025"], ["5mg", "M050"], ["10mg", "M100"], ["12.5mg", "M125"], ["15mg", "M150"]]) {
    cart.add(dose, 12);
    assert.ok(cart.requestCode().includes(`${expected}-12`));
  }
  const restored = create(options({ storage: null, initialCode: "M025-4,M050-12" }));
  assert.deepEqual(restored.snapshot().lines.map(({ dose, pens }) => ({ dose, pens })), [
    { dose: "2.5mg", pens: 4 }, { dose: "5mg", pens: 12 }
  ]);
  assert.equal(restored.requestCode(), "M025-4,M050-12");
  for (const initialCode of ["M25-4", "M025-8", "M999-4", "M025-4,M025-12", "not-a-request"]) {
    assert.equal(create(options({ storage: null, initialCode })).snapshot().count, 0, initialCode);
  }
  assert.equal(create(options({ initialCode: "M025-4" })).snapshot().count, 0, "working storage ignores URL state");
});

test("ALLOW_MULTI_LINES=false keeps only the latest dose", () => {
  const cart = create(options({ allowMultiLines: false }));
  cart.add("2.5mg", 4);
  cart.add("5mg", 12);
  assert.equal(cart.snapshot().count, 1);
  assert.equal(cart.snapshot().lines[0].dose, "5mg");
});

test("incomplete and forged selections cannot be stored", () => {
  const cart = create(options());
  for (const [dose, pens] of [[null, null], ["2.5mg", null], ["bogus", 4], ["2.5mg", 8], ["2.5mg", "4"]]) {
    assert.equal(cart.add(dose, pens).ok, false);
  }
  assert.equal(cart.snapshot().count, 0);
});

test("storage contains only dose, pens and expiry; current prices are resolved on reload", () => {
  const storage = memoryStorage();
  create(options({ storage })).add("7.5mg", 24);
  const persisted = JSON.parse(storage.getItem("test"));
  assert.deepEqual(Object.keys(persisted).sort(), ["expiresAt", "lines"]);
  assert.deepEqual(Object.keys(persisted.lines[0]).sort(), ["dose", "pens"]);
  const changed = prices.map(row => [...row]);
  changed[2][3] += 1;
  assert.equal(create(options({ storage, prices: changed })).snapshot().total, changed[2][3]);
});

test("stored request expires after seven days and corrupt state recovers", () => {
  let clock = 100;
  const storage = memoryStorage();
  const cart = create(options({ storage, now: () => clock }));
  cart.add("2.5mg", 48);
  clock += TTL;
  assert.equal(cart.snapshot().count, 0);
  for (const raw of ["broken", "{}", JSON.stringify({ lines: [{ dose: "bad", pens: 4 }], expiresAt: clock + 1 })]) {
    storage.setItem("test", raw);
    assert.equal(create(options({ storage, now: () => clock })).snapshot().count, 0);
  }
});

test("unavailable storage retains an in-memory request", () => {
  for (const storage of [null, { getItem() { throw new Error("denied"); } }, { getItem() { return null; }, setItem() { throw new Error("quota"); } }]) {
    const cart = create(options({ storage }));
    assert.equal(cart.add("15mg", 48).ok, true);
    assert.equal(cart.snapshot().total, prices[5][4]);
    assert.equal(cart.snapshot().volatile, true);
  }
});

test("configuration enables multi-line requests, keeps review markers, and defines the canonical origin", () => {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "config.js"), "utf8"), sandbox);
  assert.equal(sandbox.window.SITE_CONFIG.ALLOW_MULTI_LINES, true);
  assert.equal(sandbox.window.SITE_CONFIG.LINE_ADD_URL, "");
  assert.equal(sandbox.window.SITE_CONFIG.NOINDEX, true);
  assert.equal(sandbox.window.SITE_CONFIG.PUBLIC_BUILD, false);
  assert.equal(sandbox.window.SITE_CONFIG.SITE_ORIGIN, "https://tabikuri.online");
});

test("build emits S1-S9 and 404 in both languages with noindex and local assets", () => {
  const routes = ["", "mounjaro", "cart", "confirm", "guide", "notice", "legal", "privacy", "terms"];
  for (const lang of ["ko", "ja"]) {
    for (const route of routes) {
      const file = path.join(dist, ...(lang === "ja" ? ["ja"] : []), route, "index.html");
      const html = fs.readFileSync(file, "utf8");
      assert.match(html, new RegExp(`<html lang="${lang}">`));
      assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
      assert.match(html, new RegExp(`<title>${copies[lang].langName === "日本語" ? "たびクリ" : "타비 클리닉"} \\| `));
      assert.match(html, /<link rel="alternate" hreflang="ko" href="https:\/\/tabikuri\.online\//);
      assert.match(html, /<link rel="alternate" hreflang="ja" href="https:\/\/tabikuri\.online\/ja\//);
      assert.doesNotMatch(html, /src="https?:/);
    }
    assert.ok(fs.existsSync(path.join(dist, ...(lang === "ja" ? ["ja", "404.html"] : ["404.html"]))));
  }
  const builtPrices = fs.readFileSync(path.join(dist, "prices.js"), "utf8");
  assert.equal(JSON.stringify(vm.runInNewContext(`${builtPrices}; JSON.parse(JSON.stringify(PRICES));`, { document: { querySelector: () => null } })), JSON.stringify(prices));
  assert.doesNotMatch(builtPrices, /\/\/|\/\*|repo_kabukuri|カブクリ現行価格/);
});

test("new and revised copy is review-marked and Korean selector copy uses 합니다 style", () => {
  const ko = copies.ko;
  const ja = copies.ja;
  assert.equal(ko.ui.toConfirm, "신청 내용 확인하기");
  assert.equal(ko.ui.goCart, "신청 내역 보기");
  assert.equal(ja.ui.goCart, "ご希望内容を見る");
  assert.equal(ko.ui.reserve, "진료 예약하기");
  assert.equal(ja.ui.reserve, "診察の予約に進む");
  assert.match(ko.ui.selectBoth, /습니다\.$/);
  assert.match(ko.ui.selectCount, /습니다\.$/);
  for (const key of ["ui.changed", "ui.priceTableLink", "ui.readyHelp", "ui.goCart"]) {
    assert.ok(ko.pending.includes(key), `ko ${key}`);
    assert.ok(ja.pending.includes(key), `ja ${key}`);
  }
  for (const key of ["ui.finalPayment", "ui.finalDelivery", "ui.finalCancel", "ui.finalNotPrescribed"]) {
    assert.ok(ko.pending.includes(key), key);
    assert.ok(ko.ui[key.slice(3)], key);
  }
});

test("app source keeps required notices adjacent to S3/S4 actions and uses the required LINE code formula", () => {
  const app = fs.readFileSync(path.join(__dirname, "src/app.js"), "utf8");
  assert.match(app, /\$\{requiredNotices\(\)\}<a class="primary"[^>]+data-event="proceed-confirm">\$\{ui\("reserve"\)\}/);
  assert.match(app, /\$\{requiredNotices\(\)\}\$\{lineAction\}/);
  assert.match(app, /String\(Math\.round\(parseFloat\(line\.dose\) \* 10\)\)\.padStart\(3, "0"\)/);
  assert.match(app, /aria-label="\$\{escape\(copy\.ui\.cartCount\)\}: \$\{state\.count\}"/);
});

test("price values are defined only in root prices.js and its generated copy", () => {
  const sourceFiles = [
    "site/src/app.js", "site/src/cart.js", "site/src/styles.css", "site/i18n/ko.json", "site/i18n/ja.json",
    "dist/assets/app.js", "dist/assets/cart.js", "dist/assets/styles.css", "dist/i18n/ko.json", "dist/i18n/ja.json"
  ];
  for (const relative of sourceFiles) {
    const text = fs.readFileSync(path.join(repo, relative), "utf8");
    for (const price of prices.flatMap(row => row.slice(1))) {
      assert.ok(!text.includes(String(price)), `${relative} duplicates ${price}`);
      assert.ok(!text.includes(price.toLocaleString("ja-JP")), `${relative} duplicates formatted ${price}`);
    }
  }
});

test("new site contains no extra stay control, removed sentence, promotional labels, drug images or external calls", () => {
  const files = ["site/src/app.js", "site/src/cart.js", "site/i18n/ko.json", "site/i18n/ja.json", "dist/assets/app.js", "dist/assets/cart.js", "dist/i18n/ko.json", "dist/i18n/ja.json"];
  const obsolete = ["long" + "Stay", "24펜·48펜은 일본에 중" + "장" + "기 체류", "24本・48本は、日本に中" + "長" + "期滞在"];
  for (const relative of files) {
    const text = fs.readFileSync(path.join(repo, relative), "utf8");
    for (const token of obsolete) assert.equal(text.toLowerCase().includes(token.toLowerCase()), false, `${relative}: ${token}`);
    assert.doesNotMatch(text, /<img\b|<del\b|line-through|No\. ?1|추천|おすすめ|割引|할인|ランキング|랭킹|カートに入れる|購入する|구매/);
    assert.doesNotMatch(text, /https?:\/\//);
  }
});

test("reviewed medical, flow, services, footer and unchanged legal rows match current pages", () => {
  const koSource = fs.readFileSync(path.join(repo, "index.html"), "utf8");
  const jaSource = fs.readFileSync(path.join(repo, "ja/index.html"), "utf8");
  const plain = html => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const compact = html => plain(html).replace(/\s+/g, "");
  for (const [lang, source] of [["ko", koSource], ["ja", jaSource]]) {
    const copy = copies[lang].reviewed;
    const sourceText = compact(source);
    assert.equal(copy.medical.length, 7);
    for (const item of [...copy.services, ...copy.medical]) {
      assert.ok(sourceText.includes(compact(item.title)), item.title);
      assert.ok(sourceText.includes(compact(item.body)), item.body.slice(0, 30));
    }
    for (const item of copy.flow) assert.ok(sourceText.includes(compact(item)));
    assert.ok(sourceText.includes(compact(copy.footerHtml)));
    assert.ok(sourceText.includes(compact(copy.priceNote)));
    for (const item of copy.legal.filter(item => item.key !== "quantity")) {
      assert.ok(source.includes(`<dt>${item.label}</dt><dd>${item.value}</dd>`), item.key);
    }
  }
});

test("edited customs copy and legal quantity row are marked pending in both dictionaries", () => {
  for (const copy of Object.values(copies)) {
    assert.ok(copy.pending.includes("reviewed.importNotice"));
    assert.ok(copy.pending.includes("reviewed.legal.quantity"));
    assert.doesNotMatch(copy.reviewed.importNotice, /24.*48/);
    const row = copy.reviewed.legal.find(item => item.key === "quantity");
    assert.doesNotMatch(row.value, /24.*48/);
  }
});

test("primary, body, muted and warning text colors meet 4.5:1 contrast", () => {
  const luminance = hex => {
    const rgb = hex.match(/\w\w/g).map(byte => parseInt(byte, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  for (const [foreground, background] of [["174ea6", "ffffff"], ["172033", "ffffff"], ["536174", "ffffff"], ["8f3e12", "fff4e9"]]) {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    assert.ok((values[0] + .05) / (values[1] + .05) >= 4.5, foreground);
  }
});

test("PUBLIC_BUILD strips review-only metadata and a normal rebuild restores it", () => {
  try {
    childProcess.execFileSync(process.execPath, [path.join(__dirname, "build.cjs")], {
      cwd: repo,
      env: { ...process.env, PUBLIC_BUILD: "true" }
    });
    for (const lang of ["ko", "ja"]) {
      const copy = JSON.parse(fs.readFileSync(path.join(dist, "i18n", `${lang}.json`), "utf8"));
      assert.equal("pending" in copy, false);
    }
    const textFiles = [];
    const collect = directory => fs.readdirSync(directory, { withFileTypes: true }).forEach(entry => {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) collect(file);
      else if (/\.(?:html|js|json|css)$/.test(entry.name)) textFiles.push(file);
    });
    collect(dist);
    for (const file of textFiles) {
      const text = fs.readFileSync(file, "utf8");
      assert.doesNotMatch(text, /data-review=|data-copy-key=/, path.relative(repo, file));
    }
  } finally {
    childProcess.execFileSync(process.execPath, [path.join(__dirname, "build.cjs")], { cwd: repo });
  }
  assert.match(fs.readFileSync(path.join(dist, "index.html"), "utf8"), /data-review="pending"/);
  assert.ok(JSON.parse(fs.readFileSync(path.join(dist, "i18n", "ko.json"), "utf8")).pending.length > 0);
});
