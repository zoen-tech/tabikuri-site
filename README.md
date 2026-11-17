# たびクリ（타비 클리닉）サイト

訪日韓国人向けオンライン診療「たびクリ」の最低限のペライチ。診療・販売は山梨在宅リハビリクリニック、予約・決済システムはZOEN-TECH。

- 公開: GitHub Pages（main ブランチ直下）。noindex
- 目的: Square（クリニック名義）の審査で、表示名とサイトの販売事業者を一致させるため（2026-11-17作成）
- 価格の正: `zoen-tech/kabukuri` の `docs/decisions/2026-11-17-tabikuri-price-and-free-certificate.md`（カブクリ現行価格+2,000円）。全言語共通の `prices.js` だけを直す
- 事業の決定: `zoen-tech/kabukuri` の `docs/decisions/2026-11-13-korea-inbound-tabikuri.md`
- 言語: 韓国語（`index.html`、日本語併記）／日本語（`ja/index.html`）。言語を足すときは `<言語>/index.html` を作り、各ページのヘッダーの言語切替とhreflangに1つ足す
- LINE受付は「準備中」表記（メール案内）。たびクリのLINEができたら全言語のページで差し替える
