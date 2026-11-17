# レビュー待ちの韓国語文言

出典: `shared/i18n/ko.json` の `ui`。以下の新規文言は表示要素に `data-review="pending"` と `data-copy-key` を付与。仕様書に示された仮訳も未確定として扱う。

| キー | 仮文言 |
|---|---|
| `home` | 홈 |
| `back` | 뒤로 |
| `close` | 닫기 |
| `cart` | 신청 내역 |
| `add` | 담기 |
| `fee` | 처방 시 요금 |
| `book` | 진료 예약하기 |
| `returnPrices` | 요금표로 돌아가기 |
| `added` | 신청 내역에 담았어요 |
| `empty` | 아직 담은 내용이 없어요 |
| `emptyHelp` | 용량과 수량을 선택해 주세요. |
| `selected` | 선택한 내용 |
| `chooseDose` | 용량 선택 |
| `chooseCount` | 수량 선택 |
| `choose` | 선택하기 |
| `doseFirst` | 용량 선택 후 표시 |
| `selectBoth` | 용량과 수량을 선택하면 담을 수 있어요. |
| `selectCount` | 수량을 선택하면 담을 수 있어요. |
| `confirmStay` | 중장기 체류 여부를 확인해 주세요. |
| `longStay` | 일본에 중장기 체류하고 있습니다(유학·주재 등). |
| `physician` | 의사가 진료 후 처방 여부를 판단합니다. |
| `physicianChoice` | 용량과 수량은 의사가 진료 시 결정하며, 희망하신 내용과 다를 수 있습니다. |
| `beginner` | 마운자로를 처음 사용하는 경우 일반적으로 2.5mg부터 시작합니다. 용량은 의사가 진료 시 결정합니다. |
| `totalCaption` | 표시된 금액이 총액입니다(세금·진찰료·배송비 포함). |
| `noticeSummary` | 비급여 진료 · 승인 범위 외 사용입니다. |
| `noticeLink` | 중요 안내 읽기 |
| `allPrices` | 전체 요금표 |
| `cancelTitle` | 취소·환불 안내 |
| `importTitle` | 한국 반입 안내 |
| `currentOnly` | 새로 담으면 기존 신청 내역이 변경됩니다. |
| `memoryOnly` | 이 브라우저에서는 신청 내역이 현재 화면에서만 유지됩니다. |
| `catalogTitle` | 진료 항목 |
| `doseRange` | 6가지 용량 |
| `linePending` | 진료 예약하기 · 준비 중 |
| `pageProduct` | 용량·수량 선택 |
| `loadError` | 화면을 불러오지 못했습니다. 새로고침해 주세요. |
| `skip` | 본문으로 이동 |
| `countLabel` | 선택한 수량 |
| `doseCategory` | 용량·요금 |
| `draft` | 디자인 시안 |
| `reviewLabel` | 문구 검토 예정 |

初期化失敗時の案内（辞書自体が読めない場合）と4ページの noscript 案内も、HTML側で `data-review="pending"` を付与。

- noscript: 화면을 보려면 JavaScript를 활성화해 주세요.
- 起動失敗: 화면을 불러오지 못했습니다. 새로고침해 주세요.

医師の確認が必要な文は `physician`・`physicianChoice`・`beginner`。中長期滞在の仮訳は `longStay`。
既存ヒーローの「日本滞在中」と入国前診療の整合は要件12-5の未決事項を維持し、文は変更していない。

## そのまま移した文の出典

- `hero`: `index.html:79-83`
- `services`: `index.html:92-96`
- `priceNote`: `index.html:119-119`
- `importNotice`: `index.html:120-120`
- `medical`: `index.html:125-151`
- `flow`: `index.html:157-162`
- `contact`: `index.html:166-173`
- `legal`: `index.html:175-197`
- `footer`: `index.html:199-205`

重要事項は7項目を同じ順番で収録。韓国語文・特商法の日本語正文・フッターを再翻訳していない。料金の注記は全文を保持。
