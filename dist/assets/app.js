(async function () {
  "use strict";

  const root = document.querySelector("#app");
  const lang = document.body.dataset.lang;
  const page = document.body.dataset.page;
  const config = window.SITE_CONFIG;
  const COUNTS = window.TabikuriCart.COUNTS;
  const storageKey = "tabikuri-request-v2";
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

  try {
    const response = await fetch(`/i18n/${lang}.json`);
    if (!response.ok) throw new Error("copy");
    const copy = await response.json();
    if (typeof PRICES === "undefined" || !Array.isArray(PRICES) || PRICES.length !== 6) throw new Error("prices");
    const prices = PRICES;
    const pending = new Set(copy.pending);
    const attr = key => pending.has(key) ? ` data-review="pending" data-copy-key="${escape(key)}"` : "";
    const ui = (key, tag = "span", extra = "") => `<${tag}${attr(`ui.${key}`)}${extra}>${escape(copy.ui[key])}</${tag}>`;
    const reviewed = (key, text, tag = "span", extra = "") => `<${tag}${attr(`reviewed.${key}`)}${extra}>${escape(text)}</${tag}>`;
    const unit = lang === "ko" ? "엔" : "円";
    const number = value => value.toLocaleString(lang === "ko" ? "ko-KR" : "ja-JP");
    const money = value => `<span class="price">${number(value)}<small>${unit}</small></span>`;
    const brand = typeof config.BRAND_NAME === "object" ? config.BRAND_NAME[lang] : config.BRAND_NAME;

    function availableStorage() {
      for (const candidate of ["localStorage", "sessionStorage"]) {
        try {
          const storage = window[candidate];
          const probe = `${storageKey}-probe`;
          storage.setItem(probe, "1");
          storage.removeItem(probe);
          return storage;
        } catch {}
      }
      return null;
    }

    const cart = window.TabikuriCart.create({
      prices,
      storage: availableStorage(),
      key: storageKey,
      allowMultiLines: config.ALLOW_MULTI_LINES
    });

    const routes = {
      s1: "", s2: "mounjaro", s3: "cart", s4: "confirm", s5: "guide",
      s6: "notice", s7: "legal", s8: "privacy", s9: "terms", s404: ""
    };
    const href = target => `${lang === "ja" ? "/ja" : ""}/${routes[target] ? `${routes[target]}/` : ""}`;
    const languageHref = (() => {
      const route = routes[page] || "";
      return `${lang === "ko" ? "/ja" : ""}/${route ? `${route}/` : ""}`;
    })();
    const icon = name => {
      const paths = {
        cart: '<path d="M3 4h2l2 12h11l3-8H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
        arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>'
      };
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${paths[name]}</svg>`;
    };

    function header() {
      const state = cart.snapshot();
      return `<a class="skip" href="#main">${ui("skip")}</a><header class="header">
        <a class="brand" href="${href("s1")}">${escape(brand)}</a>
        <a class="lang-link" href="${languageHref}" hreflang="${lang === "ko" ? "ja" : "ko"}">${escape(copy.otherLang)}</a>
        <a class="cart-link" href="${href("s3")}" aria-label="${escape(copy.ui.cart)}">${icon("cart")}<span class="badge" data-cart-badge aria-label="${escape(copy.ui.cartCount)}">${state.count}</span></a>
      </header>`;
    }

    function footer() {
      return `<footer class="footer"><nav class="footer-nav" aria-label="${escape(copy.ui.home)}">
        <a href="${href("s5")}">${escape(copy.reviewed.flowTitle)}</a>
        <a href="${href("s6")}">${escape(copy.reviewed.medicalTitle)}</a>
        <a href="${href("s7")}">${escape(copy.reviewed.legalTitle)}</a>
        <a href="${href("s8")}">${escape(copy.meta.s8)}</a>
        <a href="${href("s9")}">${escape(copy.meta.s9)}</a>
      </nav><div class="footer-contact"><strong>${escape(copy.reviewed.contactTitle)}</strong><br>${escape(copy.reviewed.contactBody)}<br><a class="email" href="mailto:${escape(copy.reviewed.email)}">${escape(copy.reviewed.email)}</a></div>
      <div lang="ja">${copy.reviewed.footerHtml}</div></footer>`;
    }

    function medical(open = false) {
      return `<details class="disclosure medical"${open ? " open" : ""}><summary>${escape(copy.reviewed.medicalTitle)}<br>${ui("noticeSummary", "small")}</summary><div class="disclosure-body">${copy.reviewed.medical.map(item => `<section class="medical-item"><h3>${escape(item.title)}</h3><p>${escape(item.body)}</p></section>`).join("")}</div></details>`;
    }

    function importNotice() {
      return `<aside class="notice"${attr("reviewed.importNotice")}><h3>${escape(copy.ui.importTitle)}</h3><p>${escape(copy.reviewed.importNotice)}</p></aside>`;
    }

    function requiredNotices() {
      return `<div class="required-notices"><p>${escape(copy.reviewed.noPrescription)}</p>${ui("physicianChoice", "p")}</div>`;
    }

    function doseArt() {
      return `<div class="dose-art" aria-hidden="true">${prices.map(() => "<span></span>").join("")}</div>`;
    }

    function summaryLines(state, actions = false) {
      return `<ul class="cart-lines">${state.lines.map(line => `<li class="cart-line" data-cart-dose="${escape(line.dose)}"><div class="line-main"><strong>${escape(copy.ui.product)} ${escape(line.dose)} · ${line.pens}${escape(copy.ui.pens)}</strong>${money(line.price)}</div>${actions ? `<div class="line-actions"><a class="text-button" href="${href("s2")}?dose=${encodeURIComponent(line.dose)}">${escape(copy.ui.change)}</a><button class="text-button" type="button" data-remove="${escape(line.dose)}">${escape(copy.ui.remove)}</button></div>` : ""}</li>`).join("")}</ul>`;
    }

    function bottomBar() {
      const state = cart.snapshot();
      const destination = state.count ? href("s3") : href("s2");
      const label = state.count ? ui("goCart") : escape(copy.ui.priceView);
      return `<div class="bottom-bar"><div class="bottom-bar-inner"><div><div class="bar-label">${ui("fee")} · ${state.count}${escape(copy.ui.requestsUnit)}</div><div class="bar-price">${number(state.total)}${unit}</div></div><a class="primary" href="${destination}" data-event="bottom-action">${label}</a></div></div>`;
    }

    function home() {
      const first = prices[0];
      return `<main id="main"><section class="section hero"><div class="clinic-name" lang="ja">${escape(copy.reviewed.clinic)}</div><div class="eyebrow">${ui("clinicEyebrow")}</div><h1>${escape(copy.reviewed.heroTitle)}</h1><p class="doctor-line">${ui("doctorOnline")}</p><p class="hero-copy">${escape(copy.reviewed.heroBody)}</p><ul class="trust-list"><li>${escape(copy.ui.trust1)}</li><li>${escape(copy.ui.trust2)}</li><li>${escape(copy.ui.trust3)}</li></ul><a class="primary" href="${href("s2")}" data-event="view-prices">${escape(copy.ui.priceView)} ${icon("arrow")}</a></section>
        <section class="section"><h2>${escape(copy.reviewed.servicesTitle)}</h2><ul class="service-list">${copy.reviewed.services.map(item => `<li class="service-card"><h3>${escape(item.title)}</h3><p>${escape(item.body)}</p></li>`).join("")}</ul></section>
        <section class="section soft"><h2>${ui("catalogTitle")}</h2><a class="product-card" href="${href("s2")}" data-event="view-product">${doseArt()}<h3>${escape(copy.ui.product)}</h3><p class="subtle">${escape(copy.ui.doseRange)}</p><p>${escape(first[0])} · 4${escape(copy.ui.pens)} ${money(first[1])}</p><p class="subtle">${escape(copy.ui.included)}</p></a></section>
        <section class="section"><h2>${escape(copy.reviewed.flowTitle)}</h2><ol class="flow-list">${copy.reviewed.flow.map(item => `<li>${escape(item)}</li>`).join("")}</ol><p><a href="${href("s5")}">${escape(copy.ui.moreGuide)}</a></p></section>
        <section class="section">${importNotice()}${medical()}</section>
        <section class="section"><div class="contact-card"><h2>${escape(copy.reviewed.contactTitle)}</h2><p>${escape(copy.reviewed.contactBody)}</p><a class="email" href="mailto:${escape(copy.reviewed.email)}">${escape(copy.reviewed.email)}</a></div></section></main>${bottomBar()}`;
    }

    function product() {
      return `<main id="main"><section class="section"><div class="eyebrow">${escape(copy.ui.product)}</div><h1>${escape(copy.meta.s2)}</h1><p>${ui("doctorOnline")}</p>${doseArt()}</section>
        <section class="section" id="selector"><div class="selector-group"><span class="selector-label">${escape(copy.ui.chooseDose)}</span><div class="dose-grid">${prices.map(([dose], index) => `<button class="dose-button" type="button" data-dose="${escape(dose)}" aria-pressed="false" data-event="select-dose"><span class="dose-dot" style="--dose:${["#212631","#7a50a2","#388560","#bc4b4b","#3c73bd","#d27632"][index]}"></span>${escape(dose)}</button>`).join("")}</div>${ui("beginner", "p", ' class="subtle"')}</div>
        <div class="selector-group"><span class="selector-label">${escape(copy.ui.chooseCount)}</span><p class="subtle">${escape(copy.ui.totalCaption)}</p><div class="count-grid">${COUNTS.map(count => `<button class="count-button" type="button" data-pens="${count}" aria-pressed="false" data-event="select-count"><span>${count}${escape(copy.ui.pens)} · ${count / 4}${escape(copy.ui.months)}</span><span class="count-price" data-count-price>—</span></button>`).join("")}</div></div>
        ${importNotice()}${requiredNotices()}<button class="primary" id="add-button" type="button" data-event="add-request" disabled>${ui("add")}</button><p class="disabled-reason" id="disabled-reason"${attr("ui.selectBoth")}>${escape(copy.ui.selectBoth)}</p></section>
        <section class="section soft"><h2>${escape(copy.ui.allPrices)}</h2><p class="subtle">${escape(copy.ui.scrollHint)}</p><div class="table-scroll"><table id="price-table" aria-label="${escape(copy.ui.allPrices)}"><thead><tr><th>${escape(copy.ui.chooseDose)}</th>${COUNTS.map(count => `<th>${count}${escape(copy.ui.pens)}</th>`).join("")}</tr></thead><tbody>${prices.map(([dose, ...fees]) => `<tr><td>${escape(dose)}</td>${fees.map(fee => `<td>${number(fee)}${unit}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="subtle">${escape(copy.reviewed.priceNote)}</p></section>
        <section class="section">${medical()}<details class="disclosure"><summary>${escape(copy.ui.deliveryTitle)}</summary><div class="disclosure-body"><p>${escape(copy.reviewed.services[1].body)}</p></div></details><details class="disclosure"><summary>${escape(copy.ui.cancelTitle)}</summary><div class="disclosure-body"><p>${escape(copy.reviewed.priceNote)}</p></div></details></section></main>
        <dialog class="sheet" id="added-sheet"><div class="sheet-inner"><h2>${ui("added")}</h2><div id="added-summary"></div><div class="sheet-actions"><a class="primary" href="${href("s3")}">${ui("goCart")}</a><button class="secondary" type="button" data-close-sheet>${escape(copy.ui.returnPrices)}</button></div></div></dialog>${bottomBar()}`;
    }

    function cartPage() {
      const state = cart.snapshot();
      if (!state.count) return `<main id="main"><section class="section"><h1>${escape(copy.meta.s3)}</h1>${ui("empty", "p")} ${ui("emptyHelp", "p", ' class="subtle"')}<a class="primary" href="${href("s2")}">${escape(copy.ui.priceView)}</a></section></main>`;
      return `<main id="main"><section class="section"><h1>${ui("cart")}</h1>${summaryLines(state, true)}<div class="total-box"><div class="total-row"><strong>${ui("fee")}</strong>${money(state.total)}</div><p class="subtle">${escape(copy.ui.includedDetail)}</p></div>${state.volatile ? ui("memoryOnly", "p", ' class="subtle"') : ""}</section><section class="section">${importNotice()}${requiredNotices()}${medical()}<a class="primary" href="${href("s4")}" data-event="proceed-confirm">${ui("toConfirm")}</a></section></main>${bottomBar()}`;
    }

    function legalValue(key) {
      return copy.reviewed.legal.find(item => item.key === key).value;
    }

    function confirmPage() {
      const state = cart.snapshot();
      if (!state.count) return `<main id="main"><section class="section"><h1>${escape(copy.meta.s4)}</h1>${ui("empty", "p")}<a class="primary" href="${href("s2")}">${escape(copy.ui.priceView)}</a></section></main>`;
      const desired = state.lines.map(line => `${line.dose} · ${line.pens}${copy.ui.pens}`).join(" / ");
      const facts = [
        [copy.ui.desired, escape(desired)], [copy.ui.amount, `${number(state.total)}${unit}`],
        [copy.ui.payment, `${legalValue("paymentTiming")}／${legalValue("paymentMethod")}`],
        [copy.ui.deliveryTiming, legalValue("deliveryTiming")], [copy.ui.cancel, legalValue("cancel")],
        [copy.ui.notPrescribed, legalValue("notPrescribed")]
      ];
      return `<main id="main"><section class="section"><h1>${escape(copy.meta.s4)}</h1><h2>${escape(copy.ui.summary)}</h2>${summaryLines(state)}<p><a href="${href("s3")}">${escape(copy.ui.edit)}</a></p>${ui("handoff", "p", ' class="subtle"')}</section>
        <section class="section soft"><h2>${escape(copy.ui.finalTitle)}</h2><dl class="fact-list" data-final-facts>${facts.map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${value}</dd></div>`).join("")}</dl></section>
        <section class="section">${requiredNotices()}${medical()}<h2>${escape(copy.ui.agreementTitle)}</h2><div class="agreements">${[1,2,3,4].map(index => `<label class="check"${attr(`ui.agreement${index}`)}><input type="checkbox" required data-agreement><span>${escape(copy.ui[`agreement${index}`])}</span></label>`).join("")}</div><button class="primary" id="line-button" type="button" data-event="line-reservation"${attr(config.LINE_ADD_URL ? "ui.lineButton" : "ui.ready")} disabled>${escape(config.LINE_ADD_URL ? copy.ui.lineButton : copy.ui.ready)}</button><div class="contact-card" id="line-panel"><p>${escape(copy.ui.readyHelp)}</p><a class="email" href="mailto:${escape(copy.reviewed.email)}">${escape(copy.reviewed.email)}</a><p><a href="${href("s5")}">${escape(copy.ui.lineGuideTitle)}</a></p></div></section></main>`;
    }

    function guide() {
      return `<main id="main"><section class="section"><div class="eyebrow">${escape(copy.ui.guideIntro)}</div><h1>${escape(copy.reviewed.flowTitle)}</h1><ol class="flow-list">${copy.reviewed.flow.map(item => `<li>${escape(item)}</li>`).join("")}</ol></section><section class="section soft"><h2>${escape(copy.ui.scheduleTitle)}</h2>${ui("scheduleBody", "p")}</section><section class="section"><h2>${escape(copy.ui.lineGuideTitle)}</h2><ol class="line-list">${copy.ui.lineSteps.map(item => `<li${attr("ui.lineSteps")}>${escape(item)}</li>`).join("")}</ol></section><section class="section"><h2>${escape(copy.ui.languageTitle)}</h2>${ui("languageBody", "p")}</section></main>`;
    }

    function notice() {
      return `<main id="main"><section class="section"><h1>${escape(copy.reviewed.medicalTitle)}</h1>${copy.reviewed.medical.map(item => `<section class="medical-item"><h2>${escape(item.title)}</h2><p>${escape(item.body)}</p></section>`).join("")}</section></main>`;
    }

    function legal() {
      return `<main id="main"><section class="section"><h1>${escape(copy.reviewed.legalTitle)}</h1><dl class="law" lang="ja">${copy.reviewed.legal.map(item => `<div${attr(`reviewed.legal.${item.key}`)}><dt>${escape(item.label)}</dt><dd>${item.value}</dd></div>`).join("")}</dl></section></main>`;
    }

    function placeholder(kind) {
      const intro = kind === "privacy" ? "privacyIntro" : "termsIntro";
      const title = kind === "privacy" ? copy.meta.s8 : copy.meta.s9;
      return `<main id="main"><section class="section"><h1>${escape(title)}</h1><div class="placeholder" data-review="pending"><div>${ui("placeholder", "h2")}${ui(intro, "p")}</div></div></section></main>`;
    }

    function notFound() {
      return `<main id="main"><section class="section"><h1>${escape(copy.meta.s404)}</h1><p>${escape(copy.ui.notFound)}</p><a class="primary" href="${href("s1")}">${escape(copy.ui.backHome)}</a></section></main>`;
    }

    const renderers = { s1: home, s2: product, s3: cartPage, s4: confirmPage, s5: guide, s6: notice, s7: legal, s8: () => placeholder("privacy"), s9: () => placeholder("terms"), s404: notFound };
    const render = () => {
      root.innerHTML = `<div class="shell">${header()}${renderers[page]()}${footer()}</div>`;
      root.dataset.ready = "true";
      root.setAttribute("aria-busy", "false");
      bind();
    };

    function buildLineURL(state) {
      const url = new URL(config.LINE_ADD_URL);
      const code = state.lines.map(line => `M${line.dose.replace("mg", "").replace(".", "").padStart(3, "0")}-${line.pens}`).join(",");
      url.searchParams.set("request", code);
      return url.toString();
    }

    function bind() {
      if (page === "s2") {
        let dose = new URLSearchParams(location.search).get("dose");
        if (!prices.some(row => row[0] === dose)) dose = null;
        let pens = null;
        const add = document.querySelector("#add-button");
        const update = () => {
          document.querySelectorAll("[data-dose]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.dose === dose)));
          document.querySelectorAll("[data-pens]").forEach((button, index) => {
            button.setAttribute("aria-pressed", String(Number(button.dataset.pens) === pens));
            const fee = dose ? cart.lookup(dose, COUNTS[index]) : null;
            button.querySelector("[data-count-price]").textContent = fee === null ? "—" : `${number(fee)}${unit}`;
          });
          add.disabled = !(dose && pens);
          const reason = document.querySelector("#disabled-reason");
          const key = !dose ? "ui.selectBoth" : !pens ? "ui.selectCount" : "";
          reason.textContent = key ? copy.ui[key.slice(3)] : "";
          if (key && pending.has(key)) { reason.dataset.review = "pending"; reason.dataset.copyKey = key; }
          else { delete reason.dataset.review; delete reason.dataset.copyKey; }
        };
        root.querySelectorAll("[data-dose]").forEach(button => button.addEventListener("click", () => { dose = button.dataset.dose; pens = null; update(); }));
        root.querySelectorAll("[data-pens]").forEach(button => button.addEventListener("click", () => { if (!dose) return; pens = Number(button.dataset.pens); update(); }));
        add.addEventListener("click", () => {
          const result = cart.add(dose, pens);
          if (!result.ok) return;
          document.querySelector("#added-summary").innerHTML = summaryLines(result.state);
          document.querySelector("[data-cart-badge]").textContent = result.state.count;
          document.querySelector("#added-sheet").showModal();
        });
        root.querySelector("[data-close-sheet]").addEventListener("click", () => document.querySelector("#added-sheet").close());
        update();
      }
      if (page === "s3") root.querySelectorAll("[data-remove]").forEach(button => button.addEventListener("click", () => { cart.remove(button.dataset.remove); render(); }));
      if (page === "s4") {
        const checks = [...root.querySelectorAll("[data-agreement]")];
        const lineButton = root.querySelector("#line-button");
        if (!lineButton) return;
        const update = () => { lineButton.disabled = !checks.every(input => input.checked); };
        checks.forEach(input => input.addEventListener("change", update));
        lineButton.addEventListener("click", () => {
          if (config.LINE_ADD_URL) location.href = buildLineURL(cart.snapshot());
          else { const target = root.querySelector("#line-panel .email"); target.scrollIntoView({ block: "center" }); target.focus(); }
        });
      }
    }

    window.addEventListener("storage", event => {
      if (event.key !== storageKey && event.key !== null) return;
      cart.sync(event.newValue);
      render();
    });
    render();
  } catch (error) {
    root.innerHTML = '<div class="shell"><main class="section"><a class="email" href="mailto:yamanashi-zaitaku@zoen-tech.co.jp">yamanashi-zaitaku@zoen-tech.co.jp</a></main></div>';
    root.dataset.ready = "error";
    root.setAttribute("aria-busy", "false");
    console.error(error);
  }
})();
