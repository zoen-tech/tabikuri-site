(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TabikuriCart = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const COUNTS = [4, 12, 24, 48];
  const TTL = 7 * 24 * 60 * 60 * 1000;

  function create({ prices, storage, key, allowMultiLines = true, now = Date.now, initialCode = "" }) {
    let state = { lines: [], expiresAt: 0 };
    let volatile = !storage;

    const empty = () => ({ lines: [], expiresAt: 0 });
    const lookup = (dose, pens) => {
      const row = prices.find(item => item[0] === dose);
      const column = COUNTS.indexOf(pens);
      return row && column >= 0 ? row[column + 1] : null;
    };
    const validLine = line => line && typeof line.dose === "string" && Number.isInteger(line.pens) && lookup(line.dose, line.pens) !== null;
    const lineCode = line => `M${String(Math.round(parseFloat(line.dose) * 10)).padStart(3, "0")}-${line.pens}`;

    function decodeCode(code) {
      if (typeof code !== "string" || !code) return [];
      const lines = code.split(",").map(part => {
        const match = /^M(\d{3})-(\d+)$/.exec(part);
        if (!match) return null;
        const amount = Number(match[1]) / 10;
        return { dose: `${amount}mg`, pens: Number(match[2]) };
      });
      if (!lines.length || lines.some(line => !validLine(line)) || new Set(lines.map(line => line.dose)).size !== lines.length) return [];
      return (allowMultiLines ? lines : lines.slice(-1)).map(({ dose, pens }) => ({ dose, pens }));
    }

    function decode(raw) {
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.lines) || !Number.isFinite(parsed.expiresAt)) return empty();
        if (parsed.expiresAt <= now() || parsed.expiresAt > now() + TTL || parsed.lines.length > prices.length) return empty();
        if (!parsed.lines.every(validLine) || new Set(parsed.lines.map(line => line.dose)).size !== parsed.lines.length) return empty();
        const lines = (allowMultiLines ? parsed.lines : parsed.lines.slice(-1)).map(({ dose, pens }) => ({ dose, pens }));
        return { lines, expiresAt: parsed.expiresAt };
      } catch { return empty(); }
    }

    function persist() {
      if (volatile) return;
      try { storage.setItem(key, JSON.stringify(state)); }
      catch { volatile = true; }
    }

    if (!volatile) {
      try {
        const raw = storage.getItem(key);
        state = decode(raw);
        if (raw && !state.lines.length) storage.removeItem(key);
      } catch { volatile = true; }
    }
    if (volatile) {
      const lines = decodeCode(initialCode);
      if (lines.length) state = { lines, expiresAt: now() + TTL };
    }

    function snapshot() {
      if (state.expiresAt && state.expiresAt <= now()) {
        state = empty();
        persist();
      }
      const lines = state.lines.map(line => ({ ...line, price: lookup(line.dose, line.pens) }));
      return {
        lines,
        count: lines.length,
        pens: lines.reduce((sum, line) => sum + line.pens, 0),
        total: lines.reduce((sum, line) => sum + line.price, 0),
        expiresAt: state.expiresAt,
        volatile
      };
    }

    function preview(dose, pens) {
      snapshot();
      if (lookup(dose, pens) === null) return null;
      const lines = allowMultiLines ? state.lines.filter(line => line.dose !== dose) : [];
      lines.push({ dose, pens });
      return {
        lines,
        total: lines.reduce((sum, line) => sum + lookup(line.dose, line.pens), 0)
      };
    }

    function add(dose, pens) {
      const current = state.lines.find(line => line.dose === dose);
      const next = preview(dose, pens);
      if (!next) return { ok: false, reason: "selection" };
      state = { lines: next.lines, expiresAt: now() + TTL };
      persist();
      return { ok: true, replaced: Boolean(current && current.pens !== pens), state: snapshot() };
    }

    function remove(dose) {
      snapshot();
      state.lines = state.lines.filter(line => line.dose !== dose);
      state.expiresAt = state.lines.length ? now() + TTL : 0;
      persist();
      return snapshot();
    }

    function sync(raw) {
      if (!volatile) state = decode(raw);
      return snapshot();
    }

    function requestCode() {
      return snapshot().lines.map(lineCode).join(",");
    }

    return { add, lookup, preview, remove, requestCode, snapshot, sync };
  }

  return { create, COUNTS, TTL };
});
