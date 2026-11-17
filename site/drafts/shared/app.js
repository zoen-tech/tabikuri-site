(async function () {
  "use strict";
  const scriptURL = document.currentScript.src;
  const root = document.querySelector("#app");
  try {
    const response = await fetch(new URL("i18n/ko.json", scriptURL));
    if (!response.ok) throw new Error("copy unavailable");
    const { reviewed: copy, ui, pending } = await response.json();
    if (typeof PRICES === "undefined" || !Array.isArray(PRICES) || PRICES.length !== 6) throw new Error("prices unavailable");
    const config = window.SITE_CONFIG;
    const productPage = document.body.dataset.page === "s2";
    const variant = document.body.dataset.draft;
    const homeURL = productPage ? "../" : "./";
    const productURL = productPage ? "./" : "mounjaro/";
    const pendingKeys = new Set(pending);
    const escape = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    const review = key => pendingKeys.has(key) ? ` data-review="pending" data-copy-key="${key}"` : "";
    const word = (key, tag = "span", attrs = "") => `<${tag}${review(key)}${attrs}>${escape(ui[key])}</${tag}>`;
    const number = value => value.toLocaleString("ko-KR");
    const money = value => `<span class="price">${number(value)}<small>엔</small></span>`;
    const icons = {
      brand: '<path d="M5 15V9a3 3 0 0 1 3-3h3M19 9v6a3 3 0 0 1-3 3h-3M9 12h6M12 9v6"/>',
      cart: '<path d="M3 4h2l2 12h11l3-8H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
      arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
      chevron: '<path d="m9 6 6 6-6 6"/>',
      video: '<rect x="3" y="5" width="13" height="14" rx="3"/><path d="m16 10 5-3v10l-5-3M7 12h5m-2.5-2.5v5"/>',
      hotel: '<path d="M5 21V4h14v17M3 21h18M9 8h1m4 0h1M9 12h1m4 0h1M10 21v-5h4v5"/>',
      file: '<path d="M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 12h8m-8 4h5"/>',
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.5"/>',
      close: '<path d="m6 6 12 12M18 6 6 18"/>',
      home: '<path d="m3 11 9-8 9 8M5 9v12h5v-7h4v7h5V9"/>',
      grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    };
    const icon = key => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[key]}</svg>`;
    const doseDot = index => `<span class="dose-dot dose-${index}" aria-hidden="true"></span>`;
    const medical = id => `<details class="disclosure medical" id="${id}">
      <summary>${escape(copy.medicalTitle)}${word("noticeSummary", "small")}</summary>
      <div class="disclosure-body">${copy.medical.map(item => `<section class="medical-item"><h3>${escape(item.title)}</h3><p>${escape(item.body)}</p></section>`).join("")}</div>
    </details>`;
    const requiredNotices = () => `<div class="required-notices"><p>${escape(copy.noPrescription)}</p>${word("physicianChoice", "p")}</div>`;
    const importNotice = () => `<div class="notice"><h3>${icon("info")}${word("importTitle")}</h3><p>${escape(copy.importNotice)}</p></div>`;
    const contact = () => `<section class="section contact" id="contact"><h2>${escape(copy.contactTitle)}</h2><p>${escape(copy.contactBody)}</p><a class="email" href="mailto:${escape(copy.email)}">${escape(copy.email)}</a></section>`;
    const infoSections = () => `<section class="section" id="information">${medical("medical-info")}
      <details class="disclosure"><summary>${word("deliveryTitle")}</summary><div class="disclosure-body">${copy.services[1].bodyHtml}</div></details>
      <details class="disclosure"><summary>${word("cancelTitle")}</summary><div class="disclosure-body">${escape(copy.priceNote)}</div></details>
      <details class="disclosure" id="law"><summary>${word("legalTitle")}</summary><div class="disclosure-body" lang="ja"><dl class="law">${copy.legalHtml}</dl></div></details>
    </section>`;
    const footer = () => `<footer class="footer"><nav aria-label="${escape(ui.home)}"><a href="${homeURL}">${word("home")}</a><a href="${productURL}">${word("priceView")}</a><a href="#medical-info" data-open-notice>${escape(copy.medicalTitle)}</a></nav><div class="footer-copy" lang="ja">${copy.footerHtml}</div></footer>`;
    const art = () => `<div class="dose-art" aria-label="${escape(ui.doseRange)}">${PRICES.map(([dose], index) => `<div class="dose-tile">${doseDot(index)}<span>${escape(dose.replace("mg", ""))}<small>mg</small></span></div>`).join("")}</div>`;
    const products = [{ id: "mounjaro", title: ui.product, href: productURL }];
    function home() {
      return `<nav class="categories" aria-label="${escape(ui.home)}">
        ${[["video", "storeCategory", "#services"], ["grid", "doseCategory", "#catalog"], ["file", "flowCategory", "#flow"]].map(([symbol, key, href]) => `<a class="category" href="${href}"><span class="category-icon">${icon(symbol)}</span>${word(key)}</a>`).join("")}
      </nav>
      <section class="section hero"><div class="eyebrow">${word("eyebrow")}</div><h1>${copy.heroTitleHtml}</h1><p>${escape(copy.heroBody)}</p><a class="primary" href="${productURL}" data-event="view-prices">${word("priceView")}${icon("arrow")}</a></section>
      <section class="section services-section" id="services"><div class="section-heading"><h2>${escape(copy.servicesTitle)}</h2></div><ul class="services">${copy.services.map((item, index) => `<li class="service"><div class="service-icon">${icon(["video", "hotel", "file"][index])}</div><div><h3>${escape(item.title)}</h3><p>${item.bodyHtml}</p></div></li>`).join("")}</ul></section>
      <section class="section catalog" id="catalog"><div class="section-heading">${word("catalogTitle", "h2")}${word("doseRange", "small")}</div>${products.map(item => `<a class="product-card" href="${item.href}" data-event="view-product" data-product="${item.id}">${art()}<h3>${escape(item.title)}</h3><p class="subtle">${PRICES[0][0]} – ${PRICES[PRICES.length - 1][0]}</p><div class="product-price"><div class="subtle">${PRICES[0][0]} · 4${escape(ui.pens)}</div>${money(PRICES[0][1])}</div>${word("included", "div", ' class="subtle"')}<div class="product-link">${word("priceView")}${icon("arrow")}</div></a>`).join("")}</section>
      <section class="section" id="flow"><h2>${escape(copy.flowTitle)}</h2><ol class="flow">${copy.flow.map(text => `<li>${escape(text)}</li>`).join("")}</ol></section>
      <section class="section">${importNotice()}</section>${infoSections()}${contact()}`;
    }
    function product() {
      return `<section class="section product-heading"><div class="breadcrumb"><a href="${homeURL}">${word("home")}</a>${icon("chevron")}${word("product")}</div><div class="eyebrow">${word("eyebrow")}</div><h1>${escape(ui.product)}</h1>${word("physician", "p")}</section>
      <section class="section selector" id="selection">
        <fieldset><legend><span class="step-number" aria-hidden="true">01</span>${word("chooseDose")}</legend><div class="dose-grid">${PRICES.map(([dose], index) => `<button type="button" class="dose-button" data-dose="${dose}" data-event="select-dose" aria-pressed="false">${doseDot(index)}<span>${dose}</span></button>`).join("")}</div>${word("beginner", "p", ' class="beginner"')}</fieldset>
        <fieldset class="counts-field"><legend><span class="step-number" aria-hidden="true">02</span>${word("chooseCount")}</legend>${word("totalCaption", "p", ' class="total-caption"')}<div class="count-grid">${DraftCart.COUNTS.map(pens => `<button type="button" class="count-button" data-pens="${pens}" data-event="select-count" aria-pressed="false" disabled><span class="count-top"><strong>${pens}${escape(ui.pens)}</strong><small>${pens / 4}${escape(ui.month)}</small></span><span class="count-price"><span class="count-placeholder">${escape(ui.doseFirst)}</span></span></button>`).join("")}</div></fieldset>
        <div id="stay-notice" class="stay-notice" hidden>${importNotice()}<label class="stay-check" for="long-stay"><input type="checkbox" id="long-stay" data-event="confirm-long-stay">${word("longStay")}</label></div>
        <a class="text-link" href="#medical-info" data-open-notice>${icon("info")}${word("noticeLink")}</a>
        <div class="add-area" id="add-area">${requiredNotices()}<button type="button" class="primary" id="add-button" data-event="add-request" aria-describedby="disabled-reason" disabled>${word("add")}</button><p class="disabled-reason" id="disabled-reason" aria-live="polite"></p></div>
        ${!config.ALLOW_MULTI_LINES ? word("currentOnly", "p", ' class="selection-rule"') : ""}
      </section>
      <section class="section prices-section" id="prices"><h2>${word("allPrices")}</h2>${word("totalCaption", "p", ' class="subtle"')}${word("scrollHint", "p", ' class="subtle"')}<div class="table-scroll" tabindex="0" role="region" aria-label="${escape(ui.allPrices)}"><table id="draft-price-table"><thead><tr><th scope="col">${escape(ui.dose)}</th>${DraftCart.COUNTS.map(pens => `<th scope="col">${pens}${escape(ui.pens)}</th>`).join("")}</tr></thead><tbody>${PRICES.map(([dose, ...prices]) => `<tr><td>${dose}</td>${prices.map(value => `<td>${number(value)}엔</td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="price-note">${escape(copy.priceNote)}</p></section>
      <section class="section">${importNotice()}</section>${infoSections()}${contact()}`;
    }

    let storage;
    try { storage = window.localStorage; } catch { storage = null; }
    const storageKey = `tabikuri-draft-${variant}-v1`;
    const cart = DraftCart.create({ prices: PRICES, storage, key: storageKey, allowMultiLines: config.ALLOW_MULTI_LINES });
    let dose = null;
    let pens = null;
    let lastFocus = null;
    document.title = `${config.BRAND_NAME} | ${productPage ? ui.pageProduct : ui.pageHome}`;
    root.innerHTML = `<a class="skip" href="#main">${word("skip")}</a><header class="header"><a class="brand" href="${homeURL}"><span class="brand-mark">${icon("brand")}</span>${escape(config.BRAND_NAME)}</a><div class="header-actions">${word("language", "span", ' class="language"')}<button class="icon-button" type="button" data-cart-open aria-label="${escape(ui.cart)}" data-event="view-request">${icon("cart")}<span class="cart-badge" data-cart-badge>0</span></button></div></header>
      <main id="main">${productPage ? product() : home()}<div class="section memory-note" id="memory-note" hidden>${word("memoryOnly", "p", ' class="subtle"')}</div></main>${footer()}
      <aside class="bottom-bar" aria-label="${escape(ui.selected)}"><div class="bar-summary" aria-live="polite" aria-atomic="true"><div><div class="bar-label" id="bar-label"></div><div class="bar-count" id="bar-count"></div></div><div class="bar-total">${word("fee", "div", ' class="bar-label"')}<div id="bar-price"></div></div></div><button class="primary bar-action" id="bar-action" type="button" data-event="bottom-action"></button>
        <nav class="bottom-nav" aria-label="${escape(ui.home)}"><a href="${homeURL}"${!productPage ? ' aria-current="page"' : ""}>${icon("home")}${word("home")}</a><a href="${productURL}"${productPage ? ' aria-current="page"' : ""}>${icon("grid")}${word("priceView")}</a><button type="button" data-cart-open>${icon("cart")}${word("cart")}</button></nav>
      </aside>
      <dialog class="sheet" id="request-sheet" aria-labelledby="sheet-title"><div class="sheet-inner"><div class="sheet-handle" aria-hidden="true"></div><div class="sheet-header"><h2 id="sheet-title"></h2><button class="icon-button" type="button" data-close-sheet aria-label="${escape(ui.close)}" autofocus>${icon("close")}</button></div><div id="sheet-content"></div></div></dialog>`;

    const sheet = document.querySelector("#request-sheet");
    function update() {
      const saved = cart.snapshot();
      document.querySelectorAll("[data-cart-badge]").forEach(el => { el.textContent = saved.count; });
      document.querySelectorAll("[data-cart-open]").forEach(el => { el.setAttribute("aria-label", `${ui.cart} ${saved.count}${ui.lineUnit}`); });
      document.querySelector("#memory-note").hidden = !saved.memoryOnly;
      const current = productPage && dose && pens ? cart.preview(dose, pens) : null;
      const previewing = !saved.count && current;
      const display = previewing || saved;
      document.querySelector("#bar-label").innerHTML = word(previewing ? "selected" : "cart");
      document.querySelector("#bar-count").textContent = `${display.lines.length}${ui.lineUnit} · ${display.pens}${ui.pens}`;
      document.querySelector("#bar-price").innerHTML = display.lines.length ? money(display.total) : '<span class="price">—<small>엔</small></span>';
      document.querySelector("#bar-action").innerHTML = word(saved.count ? "cart" : productPage ? "choose" : "priceView");
      if (!productPage) return;
      document.querySelectorAll("[data-dose]").forEach(button => { button.setAttribute("aria-pressed", String(button.dataset.dose === dose)); });
      document.querySelectorAll("[data-pens]").forEach(button => {
        const count = Number(button.dataset.pens);
        button.disabled = !dose;
        button.setAttribute("aria-pressed", String(count === pens));
        button.querySelector(".count-price").innerHTML = dose ? money(cart.price(dose, count)) : word("doseFirst", "span", ' class="count-placeholder"');
      });
      const requiresStay = current && current.pens > 12;
      document.querySelector("#stay-notice").hidden = !requiresStay;
      const checked = document.querySelector("#long-stay").checked;
      const reason = !dose ? "selectBoth" : !pens ? "selectCount" : requiresStay && !checked ? "confirmStay" : null;
      document.querySelector("#add-button").disabled = !!reason;
      document.querySelector("#disabled-reason").innerHTML = reason ? word(reason) : "";
    }
    function renderSheet(added = false) {
      const saved = cart.snapshot();
      document.querySelector("#sheet-title").innerHTML = word(added ? "added" : "cart");
      document.querySelector("#sheet-content").innerHTML = saved.count ? `
        <ul class="sheet-lines">${saved.lines.map(line => `<li><div class="sheet-line-main"><span>${escape(ui.product)} ${escape(line.dose)}</span><span>${line.pens}${escape(ui.pens)}</span></div><div class="sheet-line-price">${word("fee")}${money(line.price)}</div></li>`).join("")}</ul>
        <div class="sheet-total"><span>${saved.pens}${escape(ui.pens)}</span>${money(saved.total)}</div>${word("included", "p", ' class="subtle"')}
        ${saved.pens > 12 ? importNotice() : ""}
        ${medical("sheet-medical")}
        ${requiredNotices()}
        <button class="primary" type="button" data-event="reserve-pending" disabled>${word("linePending")}</button>
        <button class="secondary" type="button" data-return-prices>${word("returnPrices")}</button>
        <div class="sheet-contact"><p>${escape(copy.contactBody)}</p><a class="email" href="mailto:${escape(copy.email)}">${escape(copy.email)}</a></div>
        ${saved.memoryOnly ? word("memoryOnly", "p", ' class="subtle memory-note"') : ""}` : `
        <p>${word("empty")}</p><p class="subtle">${word("emptyHelp")}</p><a class="primary" href="${productURL}">${word("priceView")}</a>${medical("sheet-medical")}`;
    }
    function openSheet(added = false) {
      renderSheet(added);
      lastFocus = document.activeElement;
      sheet.showModal();
      document.body.style.overflow = "hidden";
      sheet.scrollTop = 0;
    }
    sheet.addEventListener("close", () => {
      document.body.style.overflow = "";
      if (lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
    });
    sheet.addEventListener("click", event => {
      if (event.target !== sheet) return;
      const rect = sheet.getBoundingClientRect();
      if (event.clientY < rect.top || event.clientX < rect.left || event.clientX > rect.right) sheet.close();
    });
    root.addEventListener("click", event => {
      const button = event.target.closest("button, a");
      if (!button) return;
      if (button.matches("[data-dose]")) {
        if (dose !== button.dataset.dose) {
          dose = button.dataset.dose;
          pens = null;
          document.querySelector("#long-stay").checked = false;
        }
        update();
      } else if (button.matches("[data-pens]")) {
        if (!dose) return;
        pens = Number(button.dataset.pens);
        document.querySelector("#long-stay").checked = false;
        update();
      } else if (button.id === "add-button") {
        const result = cart.add(dose, pens, document.querySelector("#long-stay").checked);
        update();
        if (result.ok) openSheet(true);
      } else if (button.matches("[data-cart-open]")) {
        openSheet();
      } else if (button.matches("[data-close-sheet]")) {
        sheet.close();
      } else if (button.matches("[data-return-prices]")) {
        sheet.close();
        if (productPage) document.querySelector("#prices").scrollIntoView({ block: "start" });
        else window.location.href = productURL;
      } else if (button.matches("[data-open-notice]")) {
        event.preventDefault();
        const details = document.querySelector("#medical-info");
        details.open = true;
        details.scrollIntoView({ block: "start" });
        details.querySelector("summary").focus({ preventScroll: true });
      } else if (button.id === "bar-action") {
        if (cart.snapshot().count) openSheet();
        else if (productPage) {
          const needsStay = !document.querySelector("#stay-notice").hidden && !document.querySelector("#long-stay").checked;
          const target = !dose ? document.querySelector("[data-dose]")
            : !pens ? document.querySelector("[data-pens]")
            : needsStay ? document.querySelector("#long-stay")
            : document.querySelector("#add-button");
          target.scrollIntoView({ block: "center" });
          target.focus({ preventScroll: true });
        } else window.location.href = productURL;
      }
    });
    document.querySelector("#long-stay")?.addEventListener("change", update);
    window.addEventListener("storage", event => {
      if (event.key !== storageKey && event.key !== null) return;
      cart.sync(event.newValue);
      update();
      if (sheet.open) renderSheet();
    });
    window.addEventListener("pageshow", update);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") { update(); if (sheet.open) renderSheet(); }
    });
    update();
    root.setAttribute("aria-busy", "false");
    root.dataset.ready = "true";
  } catch (error) {
    root.innerHTML = '<div class="error"><p data-review="pending">화면을 불러오지 못했습니다. 새로고침해 주세요.</p><a href="mailto:yamanashi-zaitaku@zoen-tech.co.jp">yamanashi-zaitaku@zoen-tech.co.jp</a></div>';
    root.dataset.ready = "error";
    root.setAttribute("aria-busy", "false");
    console.error("Draft initialization failed:", error);
  }
})();
