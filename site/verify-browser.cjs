/* Run outside the sandbox: node site/verify-browser.cjs */
const assert = require("node:assert/strict");
const fs = require("node:fs");
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

const log = message => { results.push(message); console.log(message); };
const numeric = text => Number(text.replace(/[^0-9]/g, ""));
const mime = file => ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" }[path.extname(file)] || "application/octet-stream");

async function createContext(options, virtualFiles = {}) {
  const context = await browser.newContext(options);
  await context.route(`${origin}/**`, async route => {
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
    if (virtualFiles[pathname]) {
      await route.fulfill(virtualFiles[pathname]);
      return;
    }
    let file = path.resolve(dist, `.${pathname}`);
    if (!file.startsWith(dist + path.sep) && file !== dist) {
      await route.fulfill({ status: 403, body: "403" });
      return;
    }
    if (pathname.endsWith("/")) file = path.join(file, "index.html");
    try {
      await route.fulfill({ status: 200, contentType: mime(file), body: fs.readFileSync(file), headers: { "cache-control": "no-store" } });
    } catch {
      await route.fulfill({ status: 404, contentType: "text/plain", body: "404" });
    }
  });
  return context;
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
  const context = await createContext({ viewport: { width: 390, height: 900 } });
  try {
    for (const lang of ["ko", "ja"]) for (const route of routes) {
      const prefix = lang === "ja" ? "/ja/" : "/";
      const url = route === "404.html" ? `${prefix}404.html` : `${prefix}${route}`;
      const page = await open(context, url);
      const copy = copies[lang];
      assert.equal(await page.locator(`html[lang="${lang}"]`).count(), 1);
      assert.equal(await page.locator(`a[href="mailto:${copy.reviewed.email}"]`).count() > 0, true, `${url}: email`);
      assert.ok((await page.locator("body").innerText()).includes(copy.reviewed.contactBody), `${url}: pending LINE guidance`);
      assert.doesNotMatch(await page.locator("body").innerText(), /동봉|함께 보내|의약품과 영문|お付けします|同梱|お薬と英文/, `${url}: certificate is not enclosed`);
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
  const context = await createContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await open(context, "/mounjaro/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('#app[data-ready="true"]');
    assert.equal(await page.locator(".bottom-bar").count(), 0, "S2 hides the sticky bar when no line is selected");
    const prices = await page.evaluate(() => PRICES.map(row => [...row]));
    assert.equal(await page.locator('[data-dose][aria-pressed="true"]').count(), 0);
    assert.equal(await page.locator('[data-pens][aria-pressed="true"]').count(), 0);
    assert.equal(await page.locator("#add-button").isDisabled(), true);
    assert.equal(await page.locator('input[type="checkbox"]').count(), 0, "S2 must not have an extra checkbox");
    const table = (await page.locator("#price-table tbody td:not(:first-child)").allTextContents()).map(numeric);
    assert.deepEqual(table, prices.flatMap(row => row.slice(1)));
    for (const [dose, ...fees] of prices) {
      await page.locator(`[data-dose="${dose}"]`).click();
      assert.equal(await page.locator("#selected-product-image img").getAttribute("src"), `/assets/pens/pen-${dose}.png`);
      assert.ok((await page.locator("#selected-product-image img").getAttribute("alt")).includes(dose));
      assert.deepEqual((await page.locator("[data-count-price]").allTextContents()).map(numeric), fees);
      assert.equal(await page.locator("#add-button").isDisabled(), true);
    }
    await page.locator('[data-dose="2.5mg"]').click();
    await page.locator('[data-pens="24"]').click();
    assert.equal(await page.locator("#add-button").isEnabled(), true);
    await page.locator("#add-button").click();
    assert.equal((await page.locator("#added-sheet .primary").textContent()).trim(), copies.ko.ui.goCart);
    assert.equal(await page.locator("#added-sheet [data-breakdown-line]").count(), 1);
    assert.equal(await page.locator("#added-sheet [data-breakdown-zero]").count(), 3);
    assert.deepEqual((await page.locator("#added-sheet [data-breakdown-zero] .breakdown-amount").allTextContents()), ["0엔", "0엔", "0엔"]);
    assert.equal(numeric(await page.locator("#added-sheet .breakdown-total .price").textContent()), prices[0][3]);
    assert.ok((await page.locator(".bottom-bar .bar-label").textContent()).includes("1"), "sticky count refreshes after add");
    assert.equal(numeric(await page.locator(".bottom-bar .bar-price").textContent()), prices[0][3]);
    assert.equal((await page.locator(".bottom-bar .primary").textContent()).trim(), copies.ko.ui.goCart);
    assert.equal(await page.locator("[data-cart-badge]").getAttribute("aria-label"), `${copies.ko.ui.cartCount}: 1`);
    await page.locator("[data-close-sheet]").click();
    await page.locator('[data-pens="12"]').click();
    await page.locator("#add-button").click();
    assert.equal((await page.locator("#sheet-title").textContent()).trim(), copies.ko.ui.changed);
    assert.equal(await page.locator('#sheet-title[data-review="pending"]').count(), 1);
    await page.locator("[data-close-sheet]").click();
    await page.locator('[data-dose="5mg"]').click();
    await page.locator('[data-pens="48"]').click();
    assert.equal(await page.locator("#add-button").isEnabled(), true);
    await page.locator("#add-button").click();
    await Promise.all([page.waitForURL(`${origin}/cart/`), page.locator("#added-sheet .primary").click()]);
    await page.waitForSelector('#app[data-ready="true"]');
    assert.equal(await page.locator("[data-cart-dose]").count(), 2);
    assert.equal(await page.locator("[data-breakdown-line]").count(), 2);
    assert.equal(await page.locator("[data-breakdown-zero]").count(), 3);
    assert.deepEqual(await page.locator("[data-breakdown-zero] .breakdown-amount").allTextContents(), ["0엔", "0엔", "0엔"]);
    assert.equal(await page.locator('[data-breakdown-zero] [data-review="pending"]').count(), 3);
    assert.equal(numeric(await page.locator(".breakdown-total .price").textContent()), prices[0][2] + prices[1][4]);
    assert.equal((await page.locator('[data-event="proceed-confirm"]').textContent()).trim(), copies.ko.ui.reserve);
    assert.equal(await page.locator('.required-notices + [data-event="proceed-confirm"]').count(), 1);
    assert.equal((await page.locator('.bottom-bar .primary').textContent()).trim(), copies.ko.ui.reserve);
    assert.equal(await page.locator('.bottom-bar .primary').getAttribute("href"), "/confirm/");
    const language = page.locator(".lang-link");
    await Promise.all([page.waitForURL("**/ja/cart/"), language.click()]);
    await page.waitForSelector('#app[data-ready="true"]');
    assert.equal(await page.locator("[data-cart-dose]").count(), 2);
    assert.deepEqual(await page.locator("[data-breakdown-zero] .breakdown-amount").allTextContents(), ["0円", "0円", "0円"]);
    assert.ok((await page.locator('[data-cart-dose="2.5mg"] [data-breakdown-line]').innerText()).includes("マンジャロ 2.5mg・12本"));
    assert.equal((await page.locator(".breakdown-total").innerText()).includes(copies.ja.ui.totalTaxIncluded), true);
    await Promise.all([page.waitForURL(`${origin}/cart/`), page.locator(".lang-link").click()]);
    await page.waitForSelector('#app[data-ready="true"]');
    await Promise.all([page.waitForURL(`${origin}/confirm/`), page.locator('[data-event="proceed-confirm"]').click()]);
    await page.waitForSelector('#app[data-ready="true"]');
    assert.equal(await page.locator("[data-breakdown-line]").count(), 2);
    assert.equal(await page.locator("[data-breakdown-zero]").count(), 3);
    assert.deepEqual(await page.locator("[data-breakdown-zero] .breakdown-amount").allTextContents(), ["0엔", "0엔", "0엔"]);
    assert.equal(numeric(await page.locator(".breakdown-total .price").textContent()), prices[0][2] + prices[1][4]);
    assert.equal(await page.locator("[data-final-facts] > div").count(), 5);
    assert.equal(await page.locator('[data-final-facts] .fact-translation[data-review="pending"]').count(), 4);
    assert.equal(await page.locator('[data-final-facts] .fact-original[lang="ja"]').count(), 4);
    assert.equal(await page.locator("[data-agreement]").count(), 4);
    assert.equal(await page.locator("#line-button").count(), 0);
    assert.equal(await page.locator('#line-panel[data-review="pending"] .email').count(), 1);
    assert.equal((await page.locator("body").innerText()).includes(copies.ko.ui.handoff), false);
    assert.ok((await page.locator("body").innerText()).includes(copies.ko.ui.finalCancel));
    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, `Korean S4 overflow at ${width}`);
    }
    assert.deepEqual(page.runtimeErrors, []);
  } finally { await context.close(); }
  log("S2-S4 flow: sticky refresh, replacement notice, revised actions, adjacent notices, Korean/Japanese final facts, and pending email-only LINE state passed");
}

async function checkStorageFallback() {
  const context = await createContext({ viewport: { width: 390, height: 844 } });
  try {
    await context.addInitScript(() => {
      for (const name of ["localStorage", "sessionStorage"]) {
        Object.defineProperty(window, name, { get() { throw new DOMException("denied", "SecurityError"); } });
      }
    });
    const page = await open(context, "/mounjaro/");
    await page.locator('[data-dose="15mg"]').click();
    await page.locator('[data-pens="48"]').click();
    await page.locator("#add-button").click();
    assert.equal(new URL(page.url()).searchParams.get("r"), "M150-48", "add updates the current URL");
    await page.reload();
    await page.waitForSelector('#app[data-ready="true"]');
    assert.equal(await page.locator("[data-cart-badge]").textContent(), "1", "reload restores the URL-backed line");
    await Promise.all([page.waitForURL("**/cart/?r=M150-48"), page.locator(".cart-link").click()]);
    await page.waitForSelector('#app[data-ready="true"]');
    assert.equal(new URL(page.url()).searchParams.get("r"), "M150-48");
    assert.equal(await page.locator("[data-cart-dose]").count(), 1);
    await page.locator('[data-remove="15mg"]').click();
    assert.equal(new URL(page.url()).searchParams.has("r"), false, "removing the final line clears the current URL");
    await page.reload();
    await page.waitForSelector('#app[data-ready="true"]');
    assert.equal(await page.locator("[data-cart-dose]").count(), 0, "reload does not resurrect a removed line");
    await Promise.all([page.waitForURL("**/mounjaro/"), page.locator(".primary").click()]);
    await page.locator('[data-dose="15mg"]').click();
    await page.locator('[data-pens="48"]').click();
    await page.locator("#add-button").click();
    await Promise.all([page.waitForURL("**/cart/?r=M150-48"), page.locator("#added-sheet .primary").click()]);
    await Promise.all([page.waitForURL("**/confirm/?r=M150-48"), page.locator('[data-event="proceed-confirm"]').click()]);
    await page.waitForSelector('#app[data-ready="true"]');
    assert.equal(new URL(page.url()).searchParams.get("r"), "M150-48");
    assert.equal(await page.locator("[data-agreement]").count(), 4);
    assert.deepEqual(page.runtimeErrors, []);
  } finally { await context.close(); }
  log("localStorage and sessionStorage denied: add/remove update the current URL and reload preserves the resulting S2-S4 state");
}

async function checkConfiguredLine() {
  const context = await createContext({ viewport: { width: 390, height: 844 } }, {
    "/config.js": {
      contentType: "text/javascript",
      body: `window.SITE_CONFIG = Object.freeze({ BRAND_NAME: Object.freeze({ ko: "타비 클리닉", ja: "たびクリ" }), LINE_ADD_URL: "${origin}/line-add", SITE_ORIGIN: "https://tabikuri.online", ALLOW_MULTI_LINES: true, NOINDEX: true, PUBLIC_BUILD: false });`
    }
  });
  try {
    await context.addInitScript(() => {
      localStorage.setItem("tabikuri-request-v2", JSON.stringify({
        lines: [{ dose: "5mg", pens: 12 }, { dose: "12.5mg", pens: 4 }],
        expiresAt: Date.now() + 86400000
      }));
    });
    const page = await open(context, "/confirm/");
    assert.equal(await page.locator(".footer-contact").count(), 0);
    assert.equal((await page.locator("body").innerText()).includes(copies.ko.reviewed.contactBody), false);
    assert.equal(await page.locator("#line-panel").count(), 0);
    assert.equal(await page.locator("#line-button").isDisabled(), true);
    assert.equal(await page.locator('.required-notices + #line-button').count(), 1);
    assert.equal(await page.locator(`[data-copy-key="ui.handoff"][data-review="pending"]`).count(), 1);
    assert.ok((await page.locator("body").innerText()).includes(copies.ko.ui.handoff));
    for (const checkbox of await page.locator("[data-agreement]").all()) await checkbox.check();
    assert.equal(await page.locator("#line-button").isEnabled(), true);
    await Promise.all([page.waitForURL("**/line-add?request=*"), page.locator("#line-button").click()]);
    assert.equal(new URL(page.url()).searchParams.get("request"), "M050-12,M125-4");
    assert.deepEqual(page.runtimeErrors, []);
    const home = await open(context, "/");
    assert.equal((await home.locator("body").innerText()).includes(copies.ko.reviewed.contactBody), false);
    await home.close();
  } finally { await context.close(); }
  log("Configured LINE: pending footer/card hidden, enabled button shown, adjacent notices, and M025-style request code passed");
}

async function checkCopyAndAccessibility() {
  const context = await createContext({ viewport: { width: 390, height: 844 } });
  try {
    const home = await open(context, "/");
    const heroBox = await home.locator(".hero").boundingBox();
    assert.ok(heroBox.y + heroBox.height <= 844, "first view hero fits the mobile viewport");
    assert.equal((await home.locator(".clinic-name").textContent()).trim(), "타비 클리닉");
    assert.equal((await home.locator(".hero").innerText()).includes("山梨在宅リハビリクリニック"), false);
    assert.equal((await home.locator(".service-list").innerText()).includes("山梨在宅リハビリクリニック"), false);
    assert.equal(await home.locator('[data-copy-key="ui.doctorOnline"][data-review="pending"]').count(), 1);
    assert.equal(await home.locator('[data-copy-key="reviewed.services.0.body"][data-review="pending"]').count(), 1);
    assert.equal(await home.locator('[data-copy-key="reviewed.footerHtml"][data-review="pending"]').count(), 1);
    for (const key of ["ui.trust3", "reviewed.services.2.title", "reviewed.services.2.body", "reviewed.flow.3", "ui.penAlt"]) {
      assert.equal(await home.locator(`[data-copy-key="${key}"][data-review="pending"]`).count(), 1, key);
    }
    assert.equal(await home.getByText(copies.ko.ui.doctorOnline, { exact: true }).isVisible(), true);
    assert.equal(await home.locator(".hero .primary").count(), 1);
    assert.equal(await home.locator(".product-card [data-product-image] img").count(), 1);
    assert.equal(await home.locator(".product-card [data-product-image] img").getAttribute("src"), "/assets/pens/pen-2.5mg.png");
    assert.equal(await home.locator(".product-card [data-product-image] img").getAttribute("alt"), copies.ko.ui.penAlt.replace("{dose}", "2.5mg"));
    await home.waitForSelector('.product-card [data-product-image][data-image-fallback="true"]');
    assert.equal(await home.locator(".product-card .image-fallback").isVisible(), true);
    assert.equal(await home.locator(".product-card .image-fallback span").count(), 6);
    assert.equal(await home.locator(".bottom-bar .bar-label, .bottom-bar .bar-price").count(), 0);
    assert.equal((await home.locator(".bottom-bar .primary").textContent()).trim(), copies.ko.ui.priceView);
    assert.equal(await home.locator("[data-cart-badge]").getAttribute("aria-label"), `${copies.ko.ui.cartCount}: 0`);
    const pendingText = await home.locator('[data-review="pending"]').allTextContents();
    assert.ok(pendingText.some(text => text.includes(copies.ko.reviewed.importNotice)));
    const card = home.locator(".product-card");
    assert.ok((await card.innerText()).includes(copies.ko.ui.noticeSummary));
    assert.ok((await card.innerText()).includes(copies.ko.ui.trust1));
    assert.equal(await card.locator(`a[href="/notice/"]`).count(), 1);
    assert.ok(Math.abs(parseFloat(await card.locator(".price").evaluate(node => getComputedStyle(node).fontSize)) - 24) <= 1);
    const controls = home.locator(".primary, .lang-link, .cart-link");
    for (const control of await controls.all()) assert.ok((await control.boundingBox()).height >= 48);
    assert.deepEqual(home.runtimeErrors, []);
    await home.close();
    const legal = await open(context, "/legal/");
    const pendingRow = legal.locator('.law [data-copy-key="reviewed.legal.quantity"]');
    assert.equal(await pendingRow.count(), 1);
    assert.equal((await pendingRow.innerText()).includes("24本"), false);
    const priceLink = legal.locator(".legal-price-link");
    assert.equal(await priceLink.count(), 1);
    assert.equal(await priceLink.locator('[data-review="pending"]').count(), 1);
    assert.equal(await priceLink.getAttribute("href"), "/mounjaro/#price-table");
    assert.equal((await priceLink.textContent()).trim(), copies.ko.ui.priceTableLink);
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
  log("S1 empty sticky bar and badge label, partner-only hero/service copy, pending legal price link, controls, and text contrast passed");
}

async function checkRevisedPagesAndFallback() {
  const context = await createContext({ viewport: { width: 390, height: 844 } });
  try {
    for (const [lang, prefix] of [["ko", ""], ["ja", "/ja"]]) {
      const copy = copies[lang];
      const privacy = await open(context, `${prefix}/privacy/`);
      assert.equal((await privacy.locator(".placeholder").innerText()).trim(), copy.ui.privacyIntro);
      assert.equal(await privacy.locator('.placeholder [data-review="pending"]').count(), 1);
      await privacy.close();
      const guide = await open(context, `${prefix}/guide/`);
      assert.ok((await guide.locator("body").innerText()).includes(copy.ui.scheduleBody));
      if (lang === "ko") assert.deepEqual(await guide.locator(".line-list li").allTextContents(), copy.ui.lineSteps);
      await guide.close();
    }
  } finally { await context.close(); }

  for (const [lang, route] of [["ko", "/"], ["ja", "/ja/"]]) {
    const context = await createContext({ viewport: { width: 390, height: 844 } }, {
      [`/i18n/${lang}.json`]: { status: 500, body: "load failed" }
    });
    try {
      const page = await context.newPage();
      await page.goto(`${origin}${route}`);
      await page.waitForSelector('#app[data-ready="error"]');
      const line = page.locator('main p[data-review="pending"]');
      assert.equal((await line.textContent()).trim(), copies[lang].ui.loadError);
      assert.equal(await line.evaluate(node => Boolean(node.nextElementSibling?.matches("a.email"))), true);
    } finally { await context.close(); }
  }
  log("Revised placeholders, schedule/LINE guide copy, and bilingual load-failure guidance passed");
}

async function capture() {
  fs.mkdirSync(shots, { recursive: true });
  for (const [name, route] of [["ko-s1", "/"], ["ko-s2", "/mounjaro/"], ["ko-s3", "/cart/"], ["ko-s4", "/confirm/"], ["ja-s1", "/ja/"]]) {
    const context = await createContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
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
    browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
    await checkAllPages();
    await checkRequestFlow();
    await checkStorageFallback();
    await checkConfiguredLine();
    await checkCopyAndAccessibility();
    await checkRevisedPagesAndFallback();
    await capture();
    fs.mkdirSync(shots, { recursive: true });
    fs.writeFileSync(path.join(shots, "verification.json"), JSON.stringify({ passed: true, verifiedAt: new Date().toISOString(), checks: results }, null, 2) + "\n");
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
})();
