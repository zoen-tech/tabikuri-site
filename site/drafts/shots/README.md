# 撮影待ち

この環境ではHTTP待受とChrome起動が拒否されるため、PNGは未生成。

`../verify-browser.cjs` がブラウザ検証に成功したとき、以下を作成する。

- `a-s1.png` / `a-s2.png` / `b-s1.png` / `b-s2.png`: 幅390px・縦全体
- `compare.png`: A/S1、A/S2、B/S1、B/S2の4画面を横並び、A/Bラベル付き
- `verification.json`: 実行日時と成功した検証内容

生成されていない画像を検証済みとして扱わない。実行方法と制限の記録は `../README.md`。
