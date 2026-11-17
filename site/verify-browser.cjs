/* Run outside the sandbox: node site/verify-browser.cjs */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { chromium } = require("/Users/hirakawa-takumi/tools/browser/node_modules/playwright-core");

const repo = path.resolve(__dirname, "..");
const dist = path.join(repo, "dist");
const shots = path.join(__dirname, "shots");
const origin = "http://127.0.0.1:8799";
const copies = Object.fromEntries(["ko", "ja"].map(lang => [lang, JSON.parse(fs.readFileSync(path.join(__dirname, "i18n", `${lang}.json`), "utf8"))]));
const routes = ["", "mounjaro/", "cart/", "confirm/", "guide/", "notice/", "legal/", "privacy/", "terms/", "404.html"];
const widths = [360, 390, 768, 1280];
const results = [];
let browser;
let server;

const log = message => { results.push(message); console.log(message); };
const numeric = text => Number(text.replace(/[^0-9]/g, ""));
const mime = file => ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" }[path.extname(file)] || "application/octet-stream");

function startServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((request, response) => {
      const pathname = decodeURIComponent(new URL(request.url, origin).pathname);
      let file = path.resolve(dist, `.${pathname}`);
      if (!file.startsWith(dist + path.sep) && file !== dist) { response.writeHead(403).end(); return; }
      if (pathname.endsWith("/")) file = path.join(file, "index.html");
      fs.readFile(file, (error, data) => {
        if (error) { response.writeHead(404, { "content-type": "text/plain" }).end("404"); return; }
        response.writeHead(200, { "content-type": mime(file), "cache-control": "no-store" });
        response.end(data);
      });
    });
    server.once("error", reject);
    server.listen(8799, "127.0.0.1", resolve);
  });
}

async function open(context, route) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => assert.ok(request.url().startsWith(origin) || request.url().startsWith("data:"), `external request: ${request.url()}`));
  await page.goto(`${origin}${route}`);
  await page.waitForSelector('#app[data-ready="true"]');
  assert.equal(await page.getAttribute('meta[name="robots"]', "content"), "noindex, nofollow");
  page.runtimeErrors = errors;
  return page;
}

async function checkAllPages() {
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
  try {
    for (const lang of ["ko", "ja"]) for (const route of routes) {
      const prefix = lang === "ja" ? "/ja/" : "/";
      const url = route === "404.html" ? `${prefix}404.html` : `${prefix}${route}`;
      const page = await open(context, url);
      const copy = copies[lang];
      assert.equal(await page.locator(`html[lang="${lang}"]`).count(), 1);
      assert.equal(await page.locator(`a[href="mailto:${copy.reviewed.email}"]`).count() > 0, true, `${url}: email`);
      assert.ok((await page.locator("body").innerText()).includes(copy.reviewed.contactBody), `${url}: pending LINE guidance`);
      assert.deepEqual(page.runtimeErrors, [], `${url}: runtime errors`);
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        assert.equal(overflow, false, `${url}: page overflow at ${width}`);
        assert.ok(await page.locator(".shell").evaluate(node => node.getBoundingClientRect().width <= 560.5), `${url}: shell width`);
      }
      await page.close();
    }
  } finally { await context.close(); }
  log("S1-S9 and 404 in both languages: noindex, local-only requests, LINE pending guidance, and 360/390/768/1280 layouts passed");
}

async function checkRequestFlow() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await open(context, "/mounjaro/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('#app[data-ready="true"]');
    const prices = await page.evaluate(() => PRICES.map(row => [...row]));
    assert.equal(await page.locator('[data-dose][aria-pressed="true"]').count(), 0);
    assert.equal(await page.locator('[data-pens][aria-pressed="true"]').count(), 0);
    assert.equal(await page.locator("#add-button").isDisabled(), true);
    assert.equal(await page.locator('input[type="checkbox"]').count(), 0, "S2 must not have an extra checkbox");
    const table = (await page.locator("#price-table tbody td:not(:first-child)").allTextContents()).map(numeric);
    assert.deepEqual(table, prices.flatMap(row => row.slice(1)));
    for (const [dose, ...fees] of prices) {
      await page.locator(`[data-dose="${dose}"]`).click();
      assert.deepEqual((await page.locator("[data-count-price]").allTextContents()).map(numeric), fees);
      assert.equal(await page.locator("#add-button").isDisabled(), true);
    }
    await page.locator('[data-dose="2.5mg"]').click();
    await page.locator('[data-pens="24"]').click();
    assert.equal(await page.locator("#add-button").isEnabled(), true);
    await page.locator("#add-button").click();
    await page.locator("[data-close-sheet]").click();
    await page.locator('[data-dose="5mg"]').click();
    await page.locator('[data-pens="48"]').click();
    assert.equal(await page.locator("#add-button").isEnabled(), true);
    await page.locator("#add-button").click();
    await Promise.all([page.waitForURL(`${origin}/cart/`), page.locator("#added-sheet .primary").click()]);
    await page.waitForSelector('#app[data-ready="true"]');
    assert.equal(await page.locator("[data-cart-dose]").count(), 2);
    assert.equal(numeric(await page.locator(".total-box .price").textContent()), prices[0][3] + prices[1][4]);
    const language = page.locator(".lang-link");
    await Promise.all([page.waitForURL("**/ja/cart/"), language.click()]);
    await page.waitForSelector('#app[data-ready="true"]');
    assert.equal(await page.locator("[data-cart-dose]").count(), 2);
    await Promise.all([page.waitForURL(`${origin}/cart/`), page.locator(".lang-link").click()]);
    await page.waitForSelector('#app[data-ready="true"]');
    await Promise.all([page.waitForURL(`${origin}/confirm/`), page.locator('[data-event="proceed-confirm"]').click()]);
    await page.waitForSelector('#app[data-ready="true"]');
    assert.equal(await page.locator("[data-final-facts] > div").count(), 6);
    assert.equal(await page.locator("[data-agreement]").count(), 4);
    assert.equal(await page.locator("#line-button").isDisabled(), true);
    for (const checkbox of await page.locator("[data-agreement]").all()) await checkbox.check();
    assert.equal(await page.locator("#line-button").isEnabled(), true);
    assert.equal((await page.locator("#line-button").textContent()).trim(), copies.ko.ui.ready);
    await page.locator("#line-button").click();
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains("email")), true);
    assert.deepEqual(page.runtimeErrors, []);
  } finally { await context.close(); }
  log("24 prices, no default/quantity gate, 24/48 selection, multi-dose sum, language retention, six final facts, four required agreements, and LINE pending fallback passed");
}

async function checkStorageFallback() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    await context.addInitScript(() => Object.defineProperty(window, "localStorage", { get() { throw new DOMException("denied", "SecurityError"); } }));
    const page = await open(context, "/mounjaro/");
    await page.locator('[data-dose="15mg"]').click();
    await page.locator('[data-pens="48"]').click();
    await page.locator("#add-button").click();
    await Promise.all([page.waitForURL(`${origin}/cart/`), page.locator("#added-sheet .primary").click()]);
    await page.waitForSelector('#app[data-ready="true"]');
    assert.equal(await page.locator("[data-cart-dose]").count(), 1);
    await Promise.all([page.waitForURL(`${origin}/confirm/`), page.locator('[data-event="proceed-confirm"]').click()]);
    await page.waitForSelector('#app[data-ready="true"]');
    assert.equal(await page.locator("[data-agreement]").count(), 4);
    assert.deepEqual(page.runtimeErrors, []);
  } finally { await context.close(); }
  log("localStorage denied: session-scoped fallback completes S2-S4");
}

async function checkCopyAndAccessibility() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const home = await open(context, "/");
    const heroBox = await home.locator(".hero").boundingBox();
    assert.ok(heroBox.y + heroBox.height <= 844, "first view hero fits the mobile viewport");
    assert.equal(await home.getByText(copies.ko.reviewed.clinic, { exact: true }).isVisible(), true);
    assert.equal(await home.getByText(copies.ko.ui.doctorOnline, { exact: true }).isVisible(), true);
    assert.equal(await home.locator(".hero .primary").count(), 1);
    assert.equal(await home.locator("img").count(), 0);
    const pendingText = await home.locator('[data-review="pending"]').allTextContents();
    assert.ok(pendingText.some(text => text.includes(copies.ko.reviewed.importNotice)));
    const controls = home.locator(".primary, .lang-link, .cart-link");
    for (const control of await controls.all()) assert.ok((await control.boundingBox()).height >= 48);
    assert.deepEqual(home.runtimeErrors, []);
    await home.close();
    const legal = await open(context, "/legal/");
    const pendingRow = legal.locator('.law [data-copy-key="reviewed.legal.quantity"]');
    assert.equal(await pendingRow.count(), 1);
    assert.equal((await pendingRow.innerText()).includes("24本"), false);
    await legal.close();
  } finally { await context.close(); }

  const luminance = hex => {
    const rgb = hex.match(/\w\w/g).map(byte => parseInt(byte, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  for (const [foreground, background] of [["174ea6", "ffffff"], ["172033", "ffffff"], ["536174", "ffffff"], ["8f3e12", "fff4e9"]]) {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    assert.ok((values[0] + .05) / (values[1] + .05) >= 4.5, foreground);
  }
  log("clinic-style first view, one primary hero action, no imagery, pending customs/legal copy, 48px controls, and text contrast passed");
}

async function capture() {
  fs.mkdirSync(shots, { recursive: true });
  for (const [name, route] of [["ko-s1", "/"], ["ko-s2", "/mounjaro/"], ["ko-s3", "/cart/"], ["ko-s4", "/confirm/"], ["ja-s1", "/ja/"]]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
    try {
      if (name === "ko-s3" || name === "ko-s4") await context.addInitScript(() => {
        localStorage.setItem("tabikuri-request-v2", JSON.stringify({ lines: [{ dose: "2.5mg", pens: 4 }, { dose: "5mg", pens: 12 }], expiresAt: Date.now() + 86400000 }));
      });
      const page = await open(context, route);
      if (name === "ko-s2") {
        await page.locator('[data-dose="2.5mg"]').click();
        await page.locator('[data-pens="4"]').click();
      }
      await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
      await page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true, animations: "disabled" });
    } finally { await context.close(); }
  }
  log("390px screenshots saved for Korean S1-S4 and Japanese S1");
}

(async () => {
  try {
    execFileSync(process.execPath, [path.join(__dirname, "build.cjs")], { cwd: repo, stdio: "inherit" });
    await startServer();
    browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
    await checkAllPages();
    await checkRequestFlow();
    await checkStorageFallback();
    await checkCopyAndAccessibility();
    await capture();
    fs.mkdirSync(shots, { recursive: true });
    fs.writeFileSync(path.join(shots, "verification.json"), JSON.stringify({ passed: true, verifiedAt: new Date().toISOString(), checks: results }, null, 2) + "\n");
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
  }
})();
