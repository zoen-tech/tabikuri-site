/* No patient data or stored prices. Prices are always resolved from /prices.js. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DraftCart = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const COUNTS = [4, 12, 24, 48];
  const TTL = 7 * 24 * 60 * 60 * 1000;

  function create({ prices, storage, key, allowMultiLines = false, now = Date.now }) {
    let state = { lines: [], expiresAt: 0, longStayConfirmed: false };
    let memoryOnly = !storage;
    const price = (dose, pens) => {
      const row = prices.find(item => item[0] === dose);
      const column = COUNTS.indexOf(pens);
      return row && column !== -1 ? row[column + 1] : null;
    };
    const penCount = lines => lines.reduce((sum, line) => sum + line.pens, 0);
    const empty = () => ({ lines: [], expiresAt: 0, longStayConfirmed: false });
    function decode(raw) {
      try {
        const value = JSON.parse(raw);
        if (!value || !Array.isArray(value.lines) || !Number.isFinite(value.expiresAt) || value.expiresAt <= now()) return empty();
        if (value.expiresAt > now() + TTL || value.lines.length > prices.length) return empty();
        if (!value.lines.every(line => line && price(line.dose, line.pens) !== null)) return empty();
        if (new Set(value.lines.map(line => line.dose)).size !== value.lines.length) return empty();
        const lines = (allowMultiLines ? value.lines : value.lines.slice(-1)).map(({ dose, pens }) => ({ dose, pens }));
        if (penCount(lines) > 12 && value.longStayConfirmed !== true) return empty();
        return { lines, expiresAt: value.expiresAt, longStayConfirmed: value.longStayConfirmed === true };
      } catch { return empty(); }
    }
    function persist() {
      if (memoryOnly) return;
      try { storage.setItem(key, JSON.stringify(state)); }
      catch { memoryOnly = true; }
    }
    if (!memoryOnly) {
      try {
        const raw = storage.getItem(key);
        state = decode(raw);
        if (raw && !state.lines.length) storage.removeItem(key);
      } catch { memoryOnly = true; }
    }
    function snapshot() {
      if (state.expiresAt && state.expiresAt <= now()) { state = empty(); persist(); }
      const lines = state.lines.map(line => ({ ...line, price: price(line.dose, line.pens) }));
      return { ...state, lines, count: lines.length, pens: penCount(lines), total: lines.reduce((sum, line) => sum + line.price, 0), memoryOnly };
    }
    function preview(dose, pens) {
      snapshot();
      if (price(dose, pens) === null) return null;
      const lines = allowMultiLines ? state.lines.filter(line => line.dose !== dose) : [];
      lines.push({ dose, pens });
      return { lines, pens: penCount(lines), total: lines.reduce((sum, line) => sum + price(line.dose, line.pens), 0) };
    }
    function add(dose, pens, longStayConfirmed) {
      const next = preview(dose, pens);
      if (!next) return { ok: false, reason: "selection" };
      if (next.pens > 12 && longStayConfirmed !== true) return { ok: false, reason: "longStay" };
      state = { lines: next.lines, expiresAt: now() + TTL, longStayConfirmed: next.pens > 12 && longStayConfirmed === true };
      persist();
      return { ok: true, state: snapshot() };
    }
    function sync(raw) { if (!memoryOnly) state = decode(raw); return snapshot(); }
    return { price, preview, add, snapshot, sync };
  }
  return { create, COUNTS, TTL };
});
