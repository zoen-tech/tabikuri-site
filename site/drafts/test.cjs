const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { create, COUNTS, TTL } = require("./shared/cart.js");
const repo = path.resolve(__dirname, "../..");
const prices = vm.runInNewContext(fs.readFileSync(path.join(repo, "prices.js"), "utf8") + "; JSON.parse(JSON.stringify(PRICES));", { document: { querySelector: () => null } });
const copy = JSON.parse(fs.readFileSync(path.join(__dirname, "shared/i18n/ko.json"), "utf8"));
const source = fs.readFileSync(path.join(repo, "index.html"), "utf8");
const normalize = text => text.replace(/\s+/g, " ").trim();
const strip = text => text.replace(/<span class="ja" lang="ja">[\s\S]*?<\/span>/g, "").replace(/<[^>]*>/g, "").trim();
const memoryStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};
const options = extra => ({ prices, storage: memoryStorage(), key: "test", ...extra });

test("all 24 source prices, no default selection, and long-stay gate", () => {
  for (const row of prices) for (const [index, pens] of COUNTS.entries()) {
    const cart = create(options());
    assert.equal(cart.snapshot().count, 0);
    assert.equal(cart.price(row[0], pens), row[index + 1]);
    assert.equal(cart.add(row[0], pens, false).ok, pens <= 12);
    assert.equal(cart.add(row[0], pens, true).ok, true);
    assert.equal(cart.snapshot().total, row[index + 1]);
    assert.equal(cart.snapshot().pens, pens);
  }
});
test("incomplete and forged selections cannot be added", () => {
  const cart = create(options());
  for (const pair of [[null, null], [prices[0][0], null], ["bogus", 4], [prices[0][0], 8], [prices[0][0], "4"]]) {
    assert.equal(cart.add(...pair, true).ok, false);
  }
  assert.equal(cart.snapshot().count, 0);
});
test("single-line replacement and repeated add are idempotent", () => {
  const cart = create(options());
  cart.add(prices[0][0], 4, false);
  cart.add(prices[0][0], 4, false);
  assert.equal(cart.snapshot().count, 1);
  cart.add(prices[1][0], 12, false);
  assert.equal(cart.snapshot().count, 1);
  assert.equal(cart.snapshot().lines[0].dose, prices[1][0]);
  assert.equal(cart.snapshot().total, prices[1][2]);
});
test("multi-line mode gates the combined count, and same-dose edits replace", () => {
  const cart = create(options({ allowMultiLines: true }));
  cart.add(prices[0][0], 12, false);
  assert.equal(cart.preview(prices[1][0], 4).pens, 16);
  assert.equal(cart.add(prices[1][0], 4, false).ok, false);
  assert.equal(cart.add(prices[1][0], 4, true).ok, true);
  assert.equal(cart.snapshot().total, prices[0][2] + prices[1][1]);
  cart.add(prices[0][0], 4, false);
  assert.equal(cart.snapshot().pens, 8);
  assert.equal(cart.snapshot().count, 2);
});
test("reload resolves current prices; persisted data excludes price and patient fields", () => {
  const storage = memoryStorage();
  create(options({ storage })).add(prices[2][0], 12, false);
  const serialized = JSON.parse(storage.getItem("test"));
  assert.deepEqual(Object.keys(serialized.lines[0]).sort(), ["dose", "pens"]);
  const changedPrices = prices.map(row => [...row]);
  changedPrices[2][2] += 1;
  const reloaded = create(options({ storage, prices: changedPrices }));
  assert.equal(reloaded.snapshot().total, changedPrices[2][2]);
});
test("expires after seven days, including an already open page", () => {
  let clock = 1000;
  const storage = memoryStorage();
  const cart = create(options({ storage, now: () => clock }));
  cart.add(prices[0][0], 4, false);
  clock += TTL - 1;
  assert.equal(cart.snapshot().count, 1);
  clock += 1;
  assert.equal(cart.snapshot().count, 0);
  assert.equal(create(options({ storage, now: () => clock })).snapshot().count, 0);
});
test("corrupt or unsafe localStorage recovers to an empty state", () => {
  for (const raw of ["broken", "null", "{}", JSON.stringify({ lines: [{ dose: "invalid", pens: 4 }], expiresAt: 100 }), JSON.stringify({ lines: [{ dose: prices[0][0], pens: 48 }], expiresAt: 100, longStayConfirmed: false })]) {
    const storage = memoryStorage();
    storage.setItem("test", raw);
    const cart = create(options({ storage, now: () => 0 }));
    assert.equal(cart.snapshot().count, 0);
    assert.equal(cart.add(prices[0][0], 4, false).ok, true);
  }
});
test("denied reads, denied writes, and unavailable storage retain in-memory interaction", () => {
  for (const storage of [null, { getItem() { throw new Error("denied"); } }, { getItem() { return null; }, setItem() { throw new Error("quota"); } }]) {
    const cart = create(options({ storage }));
    assert.equal(cart.add(prices[0][0], 4, false).ok, true);
    assert.equal(cart.snapshot().total, prices[0][1]);
    assert.equal(cart.snapshot().memoryOnly, true);
  }
});
test("sync and invalid external state never bypass the residency gate", () => {
  const cart = create(options());
  cart.sync(JSON.stringify({ lines: [{ dose: prices[0][0], pens: 48 }], expiresAt: Date.now() + 1000, longStayConfirmed: false }));
  assert.equal(cart.snapshot().count, 0);
  cart.add(prices[0][0], 4, false);
  cart.sync(null);
  assert.equal(cart.snapshot().count, 0);
});
test("seven medical items, notes, hero, services, footer and legal text match reviewed source", () => {
  const block = source.match(/<section id="medical-info"[\s\S]*?<\/section>/)[0];
  const paragraphs = [...block.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(match => normalize(strip(match[1])));
  assert.equal(copy.reviewed.medical.length, 7);
  assert.deepEqual(copy.reviewed.medical.map(item => normalize(item.title + " " + item.body)), paragraphs);
  assert.ok(source.includes(copy.reviewed.importNotice));
  assert.ok(source.includes(copy.reviewed.priceNote));
  assert.ok(source.includes(copy.reviewed.noPrescription));
  assert.ok(source.includes(copy.reviewed.heroTitleHtml));
  assert.ok(normalize(source).includes(normalize(copy.reviewed.heroBody)));
  assert.ok(source.includes(copy.reviewed.footerHtml));
  assert.ok(source.includes(copy.reviewed.legalHtml));
  for (const service of copy.reviewed.services) assert.ok(source.includes(`<b>${service.title}</b>${service.bodyHtml}`));
});
test("four noindex Korean pages reference existing local scripts and styles", () => {
  for (const variant of ["a", "b"]) for (const screen of ["index.html", "mounjaro/index.html"]) {
    const file = path.join(__dirname, variant, screen);
    const html = fs.readFileSync(file, "utf8");
    assert.match(html, /<html lang="ko">/);
    assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
    for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      if (/^(data:|mailto:|#)/.test(match[1])) continue;
      assert.ok(!/^https?:/.test(match[1]));
      assert.ok(fs.existsSync(path.resolve(path.dirname(file), match[1])), match[1]);
    }
    const pricePath = html.match(/<script defer src="([^"]*prices.js)">/)[1];
    assert.equal(path.resolve(path.dirname(file), pricePath), path.join(repo, "prices.js"));
  }
});
test("shared UI contains no copied prices, promotional labels, drug images, or external CDNs", () => {
  const files = ["shared/app.js", "shared/styles.css", "a/style.css", "b/style.css", "shared/i18n/ko.json"];
  for (const relative of files) {
    const text = fs.readFileSync(path.join(__dirname, relative), "utf8");
    assert.doesNotMatch(text, /<img\b|<del\b|<s\b|line-through|https?:\/\//);
    assert.doesNotMatch(text, /추천|할인|구매|장바구니|베스트|랭킹|별점/);
    for (const row of prices) for (const price of row.slice(1)) {
      assert.ok(!text.includes(String(price)), `${relative}: duplicated ${price}`);
      assert.ok(!text.includes(price.toLocaleString("ko-KR")), `${relative}: duplicated formatted price`);
    }
  }
});
test("primary and warning text colors meet 4.5:1 contrast", () => {
  const luminance = hex => {
    const rgb = hex.match(/\w\w/g).map(byte => parseInt(byte, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  for (const [fg, bg] of [["2456ac", "ffffff"], ["633b60", "ffffff"], ["202630", "ffffff"], ["596271", "ffffff"], ["8f3e12", "fff4e9"], ["626a75", "e9ecf0"]]) {
    const values = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
    assert.ok((values[0] + .05) / (values[1] + .05) >= 4.5, fg);
  }
});
