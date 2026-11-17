/* Run from any directory: node site/drafts/verify-browser.cjs
 * Starts the requested python3 server from the repository root, tests, captures,
 * then closes every browser context and stops only the server it started.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { chromium } = require("/Users/hirakawa-takumi/tools/browser/node_modules/playwright-core");
const repo = path.resolve(__dirname, "../..");
const shots = path.join(__dirname, "shots");
const origin = "http://127.0.0.1:8799";
const expectedCopy = JSON.parse(fs.readFileSync(path.join(__dirname, "shared/i18n/ko.json"), "utf8"));
const sourceFiles = ["index.html", "ja/index.html", "prices.js"];
const originals = sourceFiles.map(file => fs.readFileSync(path.join(repo, file)));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser;
let server;
let serverError = "";
const results = [];
const ready = page => page.waitForSelector('#app[data-ready="true"]');
const value = (page, expression) => page.evaluate(expression);
const numeric = text => Number(text.replace(/[^0-9]/g, ""));
const log = message => { results.push(message); console.log(message); };

async function open(context, variant, screen = "s2") {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    assert.ok(request.url().startsWith(origin) || request.url().startsWith("data:"), "External request: " + request.url());
  });
  await page.goto(`${origin}/site/drafts/${variant}/${screen === "s2" ? "mounjaro/" : ""}`);
  await ready(page);
  assert.equal(await page.getAttribute('meta[name="robots"]', "content"), "noindex, nofollow");
  page.runtimeErrors = errors;
  return page;
}

async function runDraft(variant) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  try {
    const page = await open(context, variant);
    const prices = await page.evaluate(() => PRICES);
    assert.equal(await page.locator('[data-dose][aria-pressed="true"]').count(), 0);
    assert.equal(await page.locator('[data-pens][aria-pressed="true"]').count(), 0);
    assert.equal(await page.locator("#add-button").isDisabled(), true);
    assert.equal(await page.locator("#draft-price-table tbody tr").count(), prices.length);
    const tablePrices = await page.locator("#draft-price-table tbody td:not(:first-child)").allTextContents();
    assert.deepEqual(tablePrices.map(numeric), prices.flatMap(row => row.slice(1)));

    for (const [dose, ...fees] of prices) {
      await page.locator(`[data-dose="${dose}"]`).click();
      const labels = await page.locator(".count-price").allTextContents();
      assert.deepEqual(labels.map(numeric), fees);
      assert.equal(await page.locator("#add-button").isDisabled(), true);
      for (const [index, pens] of [4, 12, 24, 48].entries()) {
        await page.locator(`[data-pens="${pens}"]`).click();
        if (pens > 12) {
          assert.equal(await page.locator("#stay-notice").isVisible(), true);
          assert.equal(await page.locator("#add-button").isDisabled(), true);
          await page.locator("#long-stay").check();
          assert.equal(await page.locator("#add-button").isEnabled(), true);
          await page.locator("#long-stay").uncheck();
          assert.equal(await page.locator("#add-button").isDisabled(), true);
          await page.locator("#long-stay").check();
        }
        assert.equal(await page.locator("#add-button").isEnabled(), true);
        assert.equal(await page.evaluate(() => document.querySelector("#add-button").previousElementSibling.classList.contains("required-notices")), true);
        await page.locator("#add-button").click();
        assert.equal(await page.locator("#request-sheet").isVisible(), true);
        assert.equal(await page.locator(".sheet-lines li").count(), 1);
        assert.equal(numeric(await page.locator(".sheet-line-price .price").textContent()), fees[index]);
        assert.ok((await page.locator("#bar-count").textContent()).includes(`${pens}펜`));
        assert.equal(numeric(await page.locator("#bar-price").textContent()), fees[index]);
        assert.equal(await page.locator('[data-event="reserve-pending"]').isDisabled(), true);
        assert.equal(await page.locator(".sheet-contact a").getAttribute("href"), `mailto:${expectedCopy.reviewed.email}`);
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("#request-sheet").isVisible(), false);
        assert.equal(await page.evaluate(() => document.activeElement.id), "add-button");
      }
    }
    log(`${variant}: all 24 prices/add paths, residency toggle, replacement, modal focus passed`);
    await page.reload(); await ready(page);
    assert.equal(await page.locator("[data-cart-badge]").textContent(), "1");
    await page.locator(".header [data-cart-open]").click();
    assert.equal(await page.locator(".sheet-lines li").count(), 1);
    await page.locator("#sheet-medical summary").click();
    assert.equal(await page.locator("#sheet-medical .medical-item").count(), 7);
    assert.equal(await page.locator("#sheet-medical").getAttribute("open"), "");
    await page.locator("[data-close-sheet]").click();
    for (const width of [360, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await value(page, () => document.documentElement.scrollWidth <= window.innerWidth), true, `${variant} S2 overflow at ${width}`);
      assert.ok(await value(page, () => document.querySelector(".app").getBoundingClientRect().width <= 520));
    }
    assert.deepEqual(page.runtimeErrors, []);
    const s1 = await open(context, variant, "s1");
    assert.equal(await s1.locator("[data-cart-badge]").textContent(), "1");
    for (const p of [page, s1]) {
      await p.locator("#medical-info summary").click();
      const rendered = await p.locator("#medical-info .medical-item").evaluateAll(items => items.map(item => ({ title: item.querySelector("h3").textContent, body: item.querySelector("p").textContent })));
      assert.deepEqual(rendered, expectedCopy.reviewed.medical);
      for (const width of [360, 390, 768, 1280]) {
        await p.setViewportSize({ width, height: 900 });
        assert.equal(await value(p, () => document.documentElement.scrollWidth <= innerWidth), true, `${variant} overflow at ${width}`);
      }
    }
    assert.deepEqual(s1.runtimeErrors, []);
    log(`${variant}: reload, S1/S2 shared cart, full notices and four viewport sizes passed`);
  } finally { await context.close(); }

  for (const failure of ["read", "write"]) {
    const fallback = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      await fallback.addInitScript(mode => {
        if (mode === "read") Object.defineProperty(window, "localStorage", { get() { throw new DOMException("denied", "SecurityError"); } });
        else Storage.prototype.setItem = () => { throw new DOMException("quota", "QuotaExceededError"); };
      }, failure);
      const page = await open(fallback, variant);
      await page.locator('[data-dose="2.5mg"]').click();
      await page.locator('[data-pens="12"]').click();
      await page.locator("#add-button").click();
      assert.equal(await page.locator(".sheet-lines li").count(), 1);
      assert.equal(await page.locator("#memory-note").isVisible(), true);
      await page.locator("[data-close-sheet]").click();
      await page.locator("#bar-action").click();
      assert.equal(await page.locator(".sheet-lines li").count(), 1);
      assert.deepEqual(page.runtimeErrors, []);
    } finally { await fallback.close(); }
  }
  log(`${variant}: localStorage read/write failures retain the working add flow`);
}

async function capture() {
  fs.mkdirSync(shots, { recursive: true });
  for (const variant of ["a", "b"]) {
    for (const screen of ["s1", "s2"]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
      try {
        const page = await open(context, variant, screen);
        // Demonstrate a user selection, never a preselected pen count in the app.
        if (screen === "s2") {
          await page.locator('[data-dose="2.5mg"]').click();
          await page.locator('[data-pens="4"]').click();
          await page.locator("#add-button").click();
          await page.locator("[data-close-sheet]").click();
        }
        await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
        await page.screenshot({ path: path.join(shots, `${variant}-${screen}.png`), fullPage: true, animations: "disabled" });
      } finally { await context.close(); }
    }
  }
  const context = await browser.newContext({ viewport: { width: 1640, height: 1100 }, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage();
    const cards = ["a-s1", "a-s2", "b-s1", "b-s2"].map(name => {
      const data = fs.readFileSync(path.join(shots, `${name}.png`)).toString("base64");
      return `<section><h2>${name[0].toUpperCase()} <span>${name.slice(2).toUpperCase()}</span></h2><img alt="${name}" src="data:image/png;base64,${data}"></section>`;
    }).join("");
    await page.setContent(`<!doctype html><html lang="en"><head><meta name="robots" content="noindex, nofollow"><style>*{box-sizing:border-box}body{margin:0;background:#e9ecf0;padding:20px;display:grid;grid-template-columns:repeat(4,390px);gap:12px;font-family:system-ui}section{width:390px}h2{margin:0 0 12px;color:#202630;font-size:24px}h2 span{font-size:16px;font-weight:400;color:#596271}img{display:block;width:390px;border:1px solid #dde2e8}</style></head><body>${cards}</body></html>`);
    await page.locator("img").evaluateAll(images => Promise.all(images.map(img => img.decode())));
    await page.screenshot({ path: path.join(shots, "compare.png"), fullPage: true });
  } finally { await context.close(); }
  log("390px full-page screenshots and labeled four-screen comparison saved");
}

(async () => {
  try {
    server = spawn("python3", ["-m", "http.server", "8799", "--bind", "127.0.0.1"], { cwd: repo, stdio: ["ignore", "ignore", "pipe"] });
    server.stderr.on("data", data => { serverError += data.toString(); });
    server.on("error", error => { serverError += error.message; });
    let serving = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      await sleep(100);
      if (server.exitCode !== null) throw new Error("Repository HTTP server failed: " + serverError.trim());
      try { const response = await fetch(`${origin}/prices.js`); if (response.ok) { serving = true; break; } } catch {}
    }
    if (!serving) throw new Error("Repository HTTP server unavailable: " + serverError.trim());
    browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
    await runDraft("a");
    await runDraft("b");
    await capture();
    sourceFiles.forEach((file, index) => assert.deepEqual(fs.readFileSync(path.join(repo, file)), originals[index]));
    fs.writeFileSync(path.join(shots, "verification.json"), JSON.stringify({ passed: true, verifiedAt: new Date().toISOString(), checks: results }, null, 2) + "\n");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (server && server.exitCode === null) server.kill("SIGTERM");
  }
})();
