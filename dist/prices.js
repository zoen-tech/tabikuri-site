const PRICES = [
  ["2.5mg", 13980, 33980, 61880, 117200],
  ["5mg", 24480, 64880, 121760, 237200],
  ["7.5mg", 33980, 91880, 160380, 315800],
  ["10mg", 44280, 107980, 200800, 395800],
  ["12.5mg", 51780, 126580, 247800, 491800],
  ["15mg", 57580, 153800, 295800, 587800]
];
(function () {
  const tbody = document.querySelector("#price-table tbody");
  if (!tbody) return;
  PRICES.forEach(([dose, ...prices]) => {
    const tr = document.createElement("tr");
    [dose].concat(prices.map(p => "¥" + p.toLocaleString("ja-JP"))).forEach(v => {
      const td = document.createElement("td");
      td.textContent = v;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
})();
