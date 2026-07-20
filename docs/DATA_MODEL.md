# DATA_MODEL.md

Phase 1〜2時点のSQLiteスキーマ。実体は`src-tauri/migrations/0001_initial.sql`(テーブル定義はPhase 1のまま変更なし。Phase 2は既存の`documents`列を使って発行・変換・複製を実装した)。AI関連テーブル(`ai_extractions`)はPhase 3のmigrationで追加する。

すべてのテーブルは`PRAGMA foreign_keys = ON`のもとで運用する。金額は常に円の整数(INTEGER)で保持する。

## companies

利用者の会社・屋号の現在設定。Phase 1のStandard版では常に`id = 1`の1行のみを使う。

| column                      | type          | note                     |
| --------------------------- | ------------- | ------------------------ |
| id                          | INTEGER PK    | 常に1                    |
| display_name                | TEXT NOT NULL |                          |
| representative_name         | TEXT          |                          |
| postal_code                 | TEXT          |                          |
| address                     | TEXT          |                          |
| phone                       | TEXT          |                          |
| email                       | TEXT          |                          |
| invoice_registration_number | TEXT          | 適格請求書発行事業者番号 |
| bank_name                   | TEXT          |                          |
| bank_branch_name            | TEXT          |                          |
| bank_account_type           | TEXT          |                          |
| bank_account_number         | TEXT          |                          |
| bank_account_holder         | TEXT          |                          |
| logo_path                   | TEXT          | アプリデータ内の相対パス |
| estimate_valid_days         | INTEGER       | 見積書の有効期限(日数)   |
| payment_due_days            | INTEGER       | 支払期限(日数)           |
| default_note                | TEXT          | 備考欄の定型文           |
| created_at                  | TEXT NOT NULL | ISO8601                  |
| updated_at                  | TEXT NOT NULL | ISO8601                  |

## clients

顧客マスター。

| column       | type          | note |
| ------------ | ------------- | ---- |
| id           | INTEGER PK    |      |
| name         | TEXT NOT NULL |      |
| contact_name | TEXT          |      |
| postal_code  | TEXT          |      |
| address      | TEXT          |      |
| phone        | TEXT          |      |
| email        | TEXT          |      |
| note         | TEXT          |      |
| created_at   | TEXT NOT NULL |      |
| updated_at   | TEXT NOT NULL |      |

## catalog_items

商品・サービス価格表。

| column         | type                       | note                                        |
| -------------- | -------------------------- | ------------------------------------------- |
| id             | INTEGER PK                 |                                             |
| name           | TEXT NOT NULL              |                                             |
| description    | TEXT                       |                                             |
| unit           | TEXT                       | 例: 本, 分, 件                              |
| unit_price_yen | INTEGER NOT NULL           |                                             |
| cost_price_yen | INTEGER                    | Pro版の利益表示用、任意                     |
| tax_category   | TEXT NOT NULL              | `taxable_10` \| `taxable_8` \| `tax_exempt` |
| min_quantity   | INTEGER                    | 最低数量、任意                              |
| is_active      | INTEGER NOT NULL DEFAULT 1 | 0/1                                         |
| created_at     | TEXT NOT NULL              |                                             |
| updated_at     | TEXT NOT NULL              |                                             |

## catalog_aliases

問い合わせ文と価格表を結ぶ別名(Phase 3のAI照合で使用。Phase 1では手動登録欄として先に用意する)。

| column          | type                                                            | note |
| --------------- | --------------------------------------------------------------- | ---- |
| id              | INTEGER PK                                                      |      |
| catalog_item_id | INTEGER NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE |      |
| alias           | TEXT NOT NULL                                                   |      |

## documents

見積・請求・納品・領収書の共通ヘッダー。

| column                    | type                                                | note                                                                                   |
| ------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| id                        | INTEGER PK                                          |                                                                                        |
| document_type             | TEXT NOT NULL                                       | `estimate` \| `invoice` \| `delivery_note` \| `receipt`                                |
| document_number           | TEXT                                                | 発行時に採番。下書きはNULL                                                             |
| status                    | TEXT NOT NULL DEFAULT 'draft'                       | `draft` \| `issued` \| `approved` \| `rejected` \| `invoiced` \| `paid` \| `cancelled` |
| client_id                 | INTEGER REFERENCES clients(id) ON DELETE SET NULL   |                                                                                        |
| issue_date                | TEXT                                                |                                                                                        |
| due_date                  | TEXT                                                |                                                                                        |
| valid_until               | TEXT                                                |                                                                                        |
| currency                  | TEXT NOT NULL DEFAULT 'JPY'                         |                                                                                        |
| pricing_type              | TEXT NOT NULL DEFAULT 'tax_exclusive'               | `tax_exclusive` \| `tax_inclusive`                                                     |
| rounding_mode             | TEXT NOT NULL DEFAULT 'floor'                       | `floor` \| `round` \| `ceil`                                                           |
| discount_yen              | INTEGER NOT NULL DEFAULT 0                          | 全体値引き                                                                             |
| subtotal_yen              | INTEGER NOT NULL DEFAULT 0                          | 値引き後・税抜相当の小計                                                               |
| tax_yen                   | INTEGER NOT NULL DEFAULT 0                          |                                                                                        |
| total_yen                 | INTEGER NOT NULL DEFAULT 0                          |                                                                                        |
| note                      | TEXT                                                |                                                                                        |
| company_snapshot_json     | TEXT                                                | 発行時のみ設定                                                                         |
| client_snapshot_json      | TEXT                                                | 発行時のみ設定                                                                         |
| calculation_snapshot_json | TEXT                                                | 発行時のみ設定                                                                         |
| source_document_id        | INTEGER REFERENCES documents(id) ON DELETE SET NULL | 変換元書類(Phase 2)                                                                    |
| created_at                | TEXT NOT NULL                                       |                                                                                        |
| updated_at                | TEXT NOT NULL                                       |                                                                                        |
| issued_at                 | TEXT                                                |                                                                                        |

## document_lines

書類明細。商品マスターIDだけでなく、追加・編集時点の商品名・単価・税区分を保持する。

| column            | type                                                        | note                                     |
| ----------------- | ----------------------------------------------------------- | ---------------------------------------- |
| id                | INTEGER PK                                                  |                                          |
| document_id       | INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE |                                          |
| sort_order        | INTEGER NOT NULL                                            |                                          |
| catalog_item_id   | INTEGER REFERENCES catalog_items(id) ON DELETE SET NULL     | 価格表削除後も明細は残す                 |
| name              | TEXT NOT NULL                                               |                                          |
| description       | TEXT                                                        |                                          |
| unit              | TEXT                                                        |                                          |
| quantity          | INTEGER NOT NULL                                            |                                          |
| unit_price_yen    | INTEGER NOT NULL                                            |                                          |
| tax_category      | TEXT NOT NULL                                               |                                          |
| line_discount_yen | INTEGER NOT NULL DEFAULT 0                                  | 明細値引き                               |
| amount_yen        | INTEGER NOT NULL DEFAULT 0                                  | 値引き後の明細金額(計算結果のキャッシュ) |

## document_events

発行・承認・請求変換・入金・取消などの履歴(Phase 2以降で本格利用)。

| column      | type                                                        | note |
| ----------- | ----------------------------------------------------------- | ---- |
| id          | INTEGER PK                                                  |      |
| document_id | INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE |      |
| event_type  | TEXT NOT NULL                                               |      |
| from_status | TEXT                                                        |      |
| to_status   | TEXT                                                        |      |
| note        | TEXT                                                        |      |
| created_at  | TEXT NOT NULL                                               |      |

## app_settings

端数処理、番号形式、テーマ、AI使用有無など。常に`id = 1`の1行。

| column                          | type                           | note             |
| ------------------------------- | ------------------------------ | ---------------- |
| id                              | INTEGER PK                     | 常に1            |
| rounding_mode                   | TEXT NOT NULL DEFAULT 'floor'  | 新規書類の既定値 |
| document_number_prefix_estimate | TEXT NOT NULL DEFAULT 'EST'    |                  |
| document_number_prefix_invoice  | TEXT NOT NULL DEFAULT 'INV'    |                  |
| document_number_prefix_delivery | TEXT NOT NULL DEFAULT 'DLV'    |                  |
| document_number_prefix_receipt  | TEXT NOT NULL DEFAULT 'RCT'    |                  |
| theme                           | TEXT NOT NULL DEFAULT 'system' |                  |
| ai_enabled                      | INTEGER NOT NULL DEFAULT 0     |                  |
| onboarding_completed            | INTEGER NOT NULL DEFAULT 0     |                  |
| created_at                      | TEXT NOT NULL                  |                  |
| updated_at                      | TEXT NOT NULL                  |                  |

## 金額計算の順序(仕様として固定)

`src/domain/tax/`が実装し、`tests/unit/tax`で検証する。

1. 明細ごとに `lineAmount = floor0(unitPriceYen * quantity - lineDiscountYen)`
2. `rawSubtotal = Σ lineAmount`
3. 全体値引き`discountYen`を、各明細の`lineAmount / rawSubtotal`比率で按分し、最大剰余法で端数を配分して合計が`discountYen`と一致するようにする
4. `lineNetAmount = lineAmount - 按分値引き`
5. `subtotalYen = Σ lineNetAmount`(`= rawSubtotal - discountYen`)
6. `lineNetAmount`を`tax_category`ごとにグループ化する
   - `tax_exempt`: 税額0
   - `taxable_10` / `taxable_8`: `pricing_type`が`tax_exclusive`なら税額を上乗せ計算、`tax_inclusive`なら内税として逆算する。いずれも`rounding_mode`(`floor`/`round`/`ceil`)でグループ単位の端数処理をする
7. `taxYen = Σ グループ税額`
8. `totalYen`: `tax_exclusive`なら`subtotalYen + taxYen`、`tax_inclusive`なら`subtotalYen`

0円・1円・大きな金額・複数税率混在・値引きあり/なしの組み合わせを単体テストで網羅する。

## 発行(Phase 2)

`src/application/commands/issue-document.command.ts`が`draft`→`issued`の遷移時に以下を行う。

1. `src/domain/documents/document-number.ts`で書類番号を採番する(`{プレフィックス}-{発行年}-{4桁連番}`。プレフィックスは`app_settings`の種類別設定を使う)
2. `documents.company_snapshot_json` / `client_snapshot_json`に、その時点の`companies` / `clients`の内容をJSONでそのまま複製する
3. `documents.calculation_snapshot_json`に、以下の形(`CalculationSnapshot`, `src/domain/documents/snapshot.ts`)で計算結果を複製する

```json
{
  "pricingType": "tax_exclusive",
  "roundingMode": "floor",
  "discountYen": 0,
  "subtotalYen": 90000,
  "taxYen": 9000,
  "totalYen": 99000,
  "taxBreakdown": [{ "taxCategory": "taxable_10", "taxableAmountYen": 90000, "taxYen": 9000 }]
}
```

発行後、`companies` / `clients` / `catalog_items`の内容を変更しても、発行済み書類のこれらのスナップショット列は変化しない(ADR 0004)。`tests/integration/database/issue-document.test.ts`で検証する。

## 変換・複製(Phase 2)

`src/domain/documents/conversion.ts`が変換可否を定義する。

- `estimate` → `invoice` / `delivery_note`
- `invoice` → `receipt`

変換元は`issued`以降の状態のみ許可する(`draft`は変換不可)。変換すると明細を複製した新しい`draft`書類(`source_document_id`に変換元IDを保持)を作る。加えて、見積→請求書の変換は変換元の見積を`invoiced`へ、請求書→領収書の変換は変換元の請求書を`paid`へ、それぞれ可能な場合のみ自動的に進める(`src/application/commands/convert-document.command.ts`)。

複製(`duplicate-document.command.ts`)は状態を問わず、番号やスナップショットを持たない新しい`draft`を同じ種類で作る。

## 練習モード・初回案内の再開(Phase 4)

`companies` / `clients` / `catalog_items` / `documents`には`is_practice_data`列(0/1)がある。練習モード(`seed-practice-data.command.ts`)が作成した行のみ1になり、「練習データを一括削除」(`delete-practice-data.command.ts`)は`is_practice_data = 1`の行だけを削除する。実際に登録したデータには一切触れない。会社情報は既に登録済みの場合は上書きしない(companiesは`id = 1`の単一行のため)。

`app_settings.onboarding_step`は初回案内ウィザードの現在のステップを保持し、アプリを閉じて再度開いても続きから再開できるようにする。

## バックアップ(Phase 4)

`<アプリの設定フォルダ>/backups/`配下に、DBファイルのコピー(および存在する場合は`-wal`/`-shm`/`-journal`)をタイムスタンプ付きファイル名で保存する。復元前には必ず現在のDBを同じ場所へ自動退避し、復元に失敗した場合はその退避データへロールバックする(`src-tauri/src/commands/backup.rs`)。バックアップの内容検証は`PRAGMA integrity_check`と`app_settings`テーブルの存在確認で行う。詳細はADR 0007を参照。

## 複数SQL文の原子的な書き込み(Phase 4)

見積の保存、発行、変換、複製、状態変更、練習データ削除など、複数のSQL文をまたぐ書き込みは`DatabasePort.executeTransaction`を使う。`tauri-plugin-sql`のコネクションプールでは個別の`execute`呼び出しをまたぐ`BEGIN`/`COMMIT`が原子性を保証できないため、専用のRustコマンド(`execute_transaction`)が1本のSQLite接続でトランザクションを完結させる。詳細な経緯はADR 0007を参照。
