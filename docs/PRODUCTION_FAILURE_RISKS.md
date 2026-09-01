# 本番運用故障リスクカタログ

ローカルファーストの買い切りデスクトップアプリとして、本番(購入者のPC)で起きうる故障を、
API・認証・通信・同時実行・データ不整合・ユーザー操作・外部サービス障害・セキュリティの8観点で洗い出した。

各項目は **再現手順** と **期待結果**(安全側に倒れること)を対にする。
自動テストがあるものはテストIDとファイルを示す。OSや実ネットワークに依存するものは
`docs/MANUAL_STEPS.md` の「本番故障の実機確認」を正とする。

対象の「API」はクラウドの自社バックエンドではなく、次の2系統である。

1. フロントエンド → Tauri IPC(`execute_transaction` / `secret_*` / バックアップ / 診断)
2. フロントエンド → Anthropic Messages API(`https://api.anthropic.com/v1/messages`)

認証も利用者アカウントではなく、任意機能のAI APIキー(OS資格情報ストア)を指す。
ライセンス確認は表示専用で、失敗しても帳票データは開ける(ADR 0008)。

---

## 判定の読み方

| 記号 | 意味                                                                   |
| ---- | ---------------------------------------------------------------------- |
| 自動 | Vitest / Rust テストで再現と期待結果を固定している                     |
| 実機 | コードでは再現しきれず、人間確認が必要                                 |
| 残差 | 仕様上残る制限。販売停止条件には当たらないが、操作案内や将来修正の対象 |

販売停止条件(`docs/04_ACCEPTANCE_CHECKLIST.md`)との対応:

- 金額の重大な誤り
- データ消失・復元不能
- APIキー・顧客情報の漏えい
- 発行済み書類の事後変化
- 更新による起動不能
- 主要OSでの継続的クラッシュ

---

## 1. API

| ID     | シナリオ                                        | 再現                                                | 期待結果                                                                                                                        | テスト                                                                                                              |
| ------ | ----------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| API-01 | 許可していないホストへ接続しようとする          | `AnthropicProvider` の `fetch` 先を記録する         | 呼び出し先は `https://api.anthropic.com/v1/messages` のみ。CSPでも他ホストは遮断                                                | `tests/unit/production-risks/api-auth-comms.test.ts` / `tests/unit/production-risks/security-and-user-ops.test.tsx` |
| API-02 | 400/401/403/404/408/429/5xx                     | ステータスをスタブした `fetch`                      | 日本語の `invalid_api_key` / `forbidden` / `rate_limited` / `server_error` / `unknown`。APIキー・スタックをメッセージに出さない | 同上および `tests/unit/ai/anthropic-provider.test.ts`                                                               |
| API-03 | HTMLや壊れたJSON、空ボディ                      | `text/html` や `{not-json` を返す                   | `invalid_response`。クラッシュしない。抽出結果はDBへ書かない                                                                    | 同上 / `tests/integration/database/run-inquiry-extraction.test.ts`                                                  |
| API-04 | AIが金額・無限大数量・幻覚IDを返す              | tool_use に `unit_price_yen` や `Infinity` を混ぜる | 金額フィールドは捨てる。非整数数量は `null`(要確認)。存在しないIDは破棄。不正JSONは保存しない                                   | `api-auth-comms.test.ts` / `tests/unit/inquiries/reconcile.test.ts`                                                 |
| API-05 | tool_use が無い・スキーマ不一致                 | テキストだけの応答                                  | `invalid_response`。手動見積へ切り替えられる                                                                                    | `anthropic-provider.test.ts`                                                                                        |
| API-06 | 巨大な応答(5000明細)                            | 大きな tool_use                                     | クラッシュせずパースできる。金額は依然として価格表側                                                                            | `anthropic-provider.test.ts`                                                                                        |
| API-07 | Tauri `execute_transaction` に配列や不正 `$ref` | Rust単体                                            | 配列パラメータ拒否。範囲外 `$ref` 拒否。文字列はSQLへ埋め込まずバインドする                                                     | `src-tauri/src/commands/transaction.rs`                                                                             |
| API-08 | 存在しない書類IDの発行・変換                    | `issueDocument(db, 999)`                            | `not_found`。他データは無変更                                                                                                   | 既存 `issue-document` / `convert-document`                                                                          |

### API-02 再現(自動)

1. `fetch` を 401 でスタブする。
2. `testConnection("sk-ant-…")` を呼ぶ。

期待結果: `ok === false`、`code === "invalid_api_key"`、エラーJSONにキー文字列が無い。

---

## 2. 認証

| ID      | シナリオ                                             | 再現                                         | 期待結果                                                | テスト                                                                                                       |
| ------- | ---------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| AUTH-01 | APIキー未設定・空文字・削除後                        | キーなしで抽出 / 空白保存 / 削除後に接続確認 | `no_api_key` または `invalid_api_key`。SQLiteは触らない | `api-auth-comms.test.ts`                                                                                     |
| AUTH-02 | OS資格情報ストアが使えない                           | `SecretStore.set` が例外                     | 日本語の保存失敗。例外は画面へ出さない。帳票DBは無傷    | 同上                                                                                                         |
| AUTH-03 | APIキーが通常DB・診断・migrationに混入               | 抽出成功後にSQLiteバイト列と診断JSONを検索   | `sk-ant-` が無い。migrationに secret 列名が無い         | `run-inquiry-extraction.test.ts` / `no-secret-columns-in-migrations.test.ts`                                 |
| AUTH-04 | ライセンス未設定・ライセンスサーバー障害             | `noLicenseCheck.check()`                     | 常に `unlicensed`。書類の読み書きはライセンスを見ない   | `tests/unit/license/no-license-check.test.ts` / `tests/unit/production-risks/security-and-user-ops.test.tsx` |
| AUTH-05 | 実機でKeychain/Credential Manager/Secret Service不在 | Linuxコンテナや権限拒否                      | キー保存失敗の案内。見積・発行はAIなしで継続            | 実機(`MANUAL_STEPS.md`)                                                                                      |

---

## 3. 通信

| ID       | シナリオ                         | 再現                                   | 期待結果                                                                                   | テスト                                  |
| -------- | -------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------- |
| COMMS-01 | AIオフ                           | `aiEnabled=false` で抽出               | `NoAiProvider`。外部 `fetch` なし。手動見積へ誘導                                          | `api-auth-comms.test.ts`                |
| COMMS-02 | DNS/オフライン/`Failed to fetch` | `fetch` を `TypeError` で拒否          | `network`。「インターネット接続を確認」                                                    | `anthropic-provider.test.ts`            |
| COMMS-03 | 30秒応答なし                     | Fake timer で abort                    | `timeout`                                                                                  | 同上                                    |
| COMMS-04 | 利用者がキャンセル               | `AbortSignal` を abort                 | `cancelled`。途中結果をDBへ書かない                                                        | 同上 / `run-inquiry-extraction.test.ts` |
| COMMS-05 | 送信前確認をキャンセル           | 問い合わせ画面でダイアログをキャンセル | リクエストを送らない(画面実装)                                                             | 実機 / E2E候補                          |
| COMMS-06 | TLS改ざん・プロキシ証明書エラー  | 実ネットワーク                         | `network`。平文フォールバックをしない(ブラウザ `fetch`)                                    | 実機                                    |
| COMMS-07 | 同一問い合わせの再実行           | 失敗後にもう一度抽出                   | 失敗分は `ai_extractions` に残らない。成功時は確認前の記録が増えるだけ(書類はまだ作らない) | `api-auth-comms.test.ts`                |

---

## 4. 同時実行

SQLiteはプロセス内でも、JSの `await` 境界で発行・保存・変換がインターリーブしうる。
`tauri-plugin-sql` のコネクションプールでは `BEGIN` が別接続に載るため、複数文は
`executeTransaction`(1本の rusqlite 接続)に統一している(ADR 0007)。

| ID              | シナリオ                               | 再現                                  | 期待結果                                                                                                          | テスト                                                        |
| --------------- | -------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| CONC-01         | 同一下書きを同時発行(二重クリック相当) | `Promise.all(issue, issue)`           | 成功は1件。`issue` イベントも1件。番号は1つ。失敗側は `not_issuable`(SQLITE_ を出さない)                          | `tests/integration/database/production-failure-risks.test.ts` |
| CONC-02         | 別下書きを同時発行                     | 2件の `issueDocument` を並列          | 書類番号は UNIQUE。少なくとも1件成功。失敗してもエンジン生メッセージを出さない。再試行で次番号                    | 同上                                                          |
| CONC-03         | 発行中に下書き保存                     | 発行済みへ `saveEstimateDraft` / 並列 | `not_editable`。発行済み明細・スナップショットは消えない                                                          | 同上                                                          |
| CONC-04         | 確認ダイアログ連打                     | 発行確認を処理中にもう一度押す        | `onConfirm` は1回。ボタンは disabled                                                                              | `tests/unit/production-risks/security-and-user-ops.test.tsx`  |
| CONC-05         | 複数SQLの途中失敗                      | INSERTのあと NOT NULL 違反            | トランザクション全体がロールバック                                                                                | `execute-transaction.test.ts`                                 |
| CONC-06         | 抽出中に「見積を作る」を連打           | 画面の `creating` フラグ              | フラグ中は二重作成しない実装。コマンド層は毎回新規下書きを作る                                                    | 残差(画面) / コマンドは `saveEstimateDraft(id: null)`         |
| CONC-CONVERT-01 | 同じ見積から請求変換を2回              | `convertDocument` を連続              | **残差**: 請求下書きが2件できる。未承認なら元見積は `issued` のまま。スナップショットは不変。確定は発行確認がある | `production-failure-risks.test.ts`                            |
| CONC-07         | バックアップ中の書き込み               | VACUUM INTO + 同時保存                | busy_timeout 5秒で待つ。失敗しても生きているDBを壊さない                                                          | Rust backup / 実機                                            |
| CONC-08         | アプリ二重起動                         | 実OSで2プロセス                       | SQLiteロック。後発は開けないか待つ。データファイルは1つ                                                           | 実機                                                          |

---

## 5. データ不整合

| ID      | シナリオ                                 | 再現                                                 | 期待結果                                                                     | テスト                                                                   |
| ------- | ---------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| DATA-01 | 発行後に価格表・顧客・会社を変更         | 発行 → マスター更新 → 再読込                         | 明細名・単価・合計・スナップショットは発行時のまま                           | `production-failure-risks.test.ts` / `issue-document.test.ts`            |
| DATA-02 | 孤立明細・番号重複                       | 存在しない `document_id` へINSERT / 同一番号UPDATE   | FK/UNIQUE が拒否。壊れた行が残らない                                         | `production-failure-risks.test.ts`                                       |
| DATA-03 | 発行済み参照中の顧客・商品削除           | `deleteClient` / `deleteCatalogItem`                 | `ON DELETE SET NULL`。スナップショットと明細テキストは残る                   | 同上                                                                     |
| DATA-04 | 禁止された状態遷移                       | 入金済み → 下書き                                    | `invalid_transition`。状態は変わらない                                       | 同上 / `status.test.ts`                                                  |
| DATA-05 | 値引き超過・負の単価・非整数数量         | `calculateDocumentTotals` / 下書き保存               | DomainError。書類行は増えない                                                | `calculate-document-totals.test.ts` / `production-failure-risks.test.ts` |
| DATA-06 | プレフィックスに `EST(` など正規表現文字 | `nextDocumentSequence`                               | クラッシュしない。メタ文字はリテラル                                         | `document-number.test.ts`                                                |
| DATA-07 | CSVが行の途中で壊れる                    | 正常・不正・正常の3行                                | 正常行のみ登録(行単位。ファイル全体の原子性は残差)                           | `production-failure-risks.test.ts`                                       |
| DATA-08 | 練習データ削除                           | 実データと混在                                       | `is_practice_data=1` のみ削除                                                | `practice-data.test.ts`                                                  |
| DATA-09 | 変換の付随イベントがトランザクション外   | 変換成功直後にプロセスキル                           | **残差**: 変換先書類は残るが「変換先ID」イベントが欠ける可能性。正本は書類行 | ADR 0007                                                                 |
| DATA-10 | 未来スキーマのバックアップを復元         | 新しい `schema_version`                              | 復元を拒否し、現行DBを維持                                                   | Rust backup tests                                                        |
| DATA-11 | 発行計算と保存済み合計の再計算           | 発行コマンドが domain で再計算してスナップショット化 | 画面の税計算は表示用。正本は発行時スナップショット                           | `issue-document.test.ts`                                                 |

---

## 6. ユーザー操作

| ID             | シナリオ                                  | 再現                          | 期待結果                                          | テスト                                                       |
| -------------- | ----------------------------------------- | ----------------------------- | ------------------------------------------------- | ------------------------------------------------------------ |
| USER-01        | 顧客名に `'; DROP TABLE`                  | `createClient`                | 名前として保存。テーブルは残る(バインド)          | `production-failure-risks.test.ts`                           |
| USER-02        | 発行前の顧客未選択・会社未登録            | `issueDocument`               | `client_required` / `company_required`            | `issue-document.test.ts`                                     |
| USER-03        | 空の問い合わせ文                          | `runInquiryExtraction("", …)` | `empty_text`                                      | `run-inquiry-extraction.test.ts`                             |
| USER-04        | 全体値引きが小計超過                      | 下書き保存                    | 保存失敗。新規書類なし                            | `production-failure-risks.test.ts`                           |
| USER-CSV-01    | 単価が式・小数・負数                      | CSV検証                       | エラー行。正常行だけ候補                          | `tests/unit/production-risks/security-and-user-ops.test.tsx` |
| USER-CSV-02    | 商品名がSQL断片                           | CSV検証                       | 名前として通し、実行はパラメータ化                | 同上                                                         |
| USER-DIALOG-01 | 発行確認の連打                            | ConfirmDialog                 | 1回だけ実行                                       | 同上                                                         |
| USER-05        | バックアップ書き出し/取り込みのキャンセル | Fake store                    | `null` 成功。一覧は増えない                       | `backup-commands.test.ts`                                    |
| USER-06        | 存在しないバックアップ復元                | 欠番ファイル名                | 失敗。現行データを消さない                        | 同上                                                         |
| USER-07        | パス区切りを含むバックアップ名            | `../etc/passwd`               | 拒否                                              | Rust `reject_unsafe_file_name`                               |
| USER-08        | 0円見積の発行                             | 明細0や単価0                  | 仕様上許可(0円)。誤入力は利用者が確認画面で止める | `calculate-document-totals.test.ts`                          |
| USER-09        | 日本語IME中のショートカット               | 実機                          | 誤発行しない                                      | 実機 / 仕様 11章                                             |
| USER-10        | 未保存のまま終了                          | クラッシュ                    | 可能な範囲で下書き復旧(未実装なら残差)            | 残差                                                         |

---

## 7. 外部サービス障害

| ID     | シナリオ                           | 再現                                  | 期待結果                                                         | テスト                                                     |
| ------ | ---------------------------------- | ------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| EXT-01 | 診断に個人情報が混ざる経路         | 顧客・振込先入りDBで診断生成          | 件数のみ。氏名・メール・口座・本文なし。秘密パターンなら保存中止 | `production-failure-risks.test.ts` / `secret-scan.test.ts` |
| EXT-02 | Anthropic 障害・レート制限         | 429/5xx                               | 手動見積へ。元文章は画面に残る。二重書類を自動作成しない         | `anthropic-provider.test.ts`                               |
| EXT-03 | 更新エンドポイント未設定           | `notConfiguredUpdateCheck`            | `not_configured`。旧版のまま起動可                               | `not-configured-update-check.test.ts`                      |
| EXT-04 | ディスク満杯・権限なし             | バックアップ作成                      | 日本語の容量/権限エラー。不完全ファイルを残さない                | Rust backup / `MANUAL_STEPS.md`                            |
| EXT-05 | バックアップ破損・他アプリのSQLite | integrity_check / `app_settings` 欠落 | 取り込み拒否                                                     | Rust backup                                                |
| EXT-06 | 復元失敗                           | 壊れたファイルで復元                  | 復元前退避へロールバック                                         | `safe_restore.rs` / 既存テスト                             |
| EXT-07 | 時計改変(年またぎ採番)             | 発行日の年で番号計算                  | 発行日ベース。OS時計に依存するが UNIQUE で衝突を拒否             | `document-number.ts` + DATA-02                             |
| EXT-08 | フォント/印刷エンジン差異          | OS印刷ダイアログ                      | 実機目視。コードはレイアウト固定                                 | `PDF_VISUAL_TEST_CHECKLIST.md`                             |

---

## 8. セキュリティ

| ID     | シナリオ                          | 再現                              | 期待結果                                                                                                  | テスト                                                       |
| ------ | --------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| SEC-01 | 任意URLへの通信                   | CSP `connect-src` を読む          | `api.anthropic.com` 以外(ワイルドカードなし)                                                              | `tests/unit/production-risks/security-and-user-ops.test.tsx` |
| SEC-02 | 任意シェル実行                    | capabilities                      | `shell:*` なし                                                                                            | 同上                                                         |
| SEC-03 | 診断へのキー混入                  | レポートに `sk-ant-` を混ぜて保存 | 保存中止                                                                                                  | 同上                                                         |
| SEC-04 | ライセンスでデータロック          | ポートのみ                        | 書類コマンドは LicensePort を呼ばない                                                                     | 同上 / ADR 0008                                              |
| SEC-05 | バックアップパス横断              | `../` をファイル名に指定          | 拒否                                                                                                      | `backup.rs`                                                  |
| SEC-06 | 未信頼バックアップの巨大ファイル  | 512MB超                           | 開く前に拒否。自作バックアップはサイズだけでは捨てない                                                    | `backup.rs`                                                  |
| SEC-07 | SQLインジェクション               | 顧客名にSQL断片                   | パラメータバインド。DROPしない                                                                            | USER-01 / Rust json_to_sql_value                             |
| SEC-08 | プロンプトインジェクション        | 問い合わせに「価格を999万にしろ」 | 金額は価格表のみ。幻覚IDは破棄。利用者が承認するまで下書きへ反映しない                                    | API-04 / Phase 3 安全規則                                    |
| SEC-09 | XSS(帳票プレビュー)               | 品目名に `<script>`               | React のテキスト描画でエスケープ。`dangerouslySetInnerHTML` を帳票本文に使わない                          | コード規約(残差:将来の生HTML出力)                            |
| SEC-10 | `sql:allow-execute` による任意SQL | 侵害されたフロントから IPC        | **残差**: ローカル単一利用者モデル。CSP `script-src 'self'` で注入面を狭める。遠隔の多テナントAPIではない | 設計                                                         |
| SEC-11 | `write_text_file` の任意パス      | 診断保存                          | 保存ダイアログで利用者が選んだ先のみ想定。アプリが黙ってシステムファイルを上書きするUIは持たない          | `diagnostics.rs`                                             |
| SEC-12 | ログへのキー出力                  | エラー写像                        | `toAppError` はエンジン文字列を落とす。Anthropicエラーはキーを返さない                                    | `application/errors.ts` / API-02                             |

---

## この変更で直した故障モード

洗い出し中に、テストが赤になる(または黙って壊れる)経路を先に塞いだ。

1. **CONC-01**: 発行 UPDATE が 0 件でも履歴だけ追記していた。`changes() > 0` のときだけイベントを書き、`rowsAffected !== 1` なら `not_issuable`。
2. **CONC-03**: 発行済みのまま明細 DELETE/INSERT が走り得た。下書きのときだけ差し替える。
3. **DATA-06**: 書類番号プレフィックスを正規表現に生埋め込みしていた。メタ文字をエスケープ。
4. **API-04 / DATA-05**: `Infinity` 信頼度が 1 扱いになり得た。非整数数量・負の単価を拒否または要確認へ倒す。
5. **CONC-04**: 確認ダイアログが処理中も再クリックできた。実行中は disabled。

---

## 残差(仕様として残すもの)

- **CONC-CONVERT-01**: 見積→請求は発行済み以降何度でもできる。連打すると請求下書きが複数できる。未承認の見積は `issued` のまま(承認後の変換でのみ `invoiced`)。金額確定は各下書きの発行確認が必要。
- **DATA-07**: CSV取り込みは行単位。ファイル全体の単一トランザクションではない。
- **DATA-09**: 変換先IDのイベントはトランザクション外。
- **SEC-10**: デスクトップ単一利用者の SQL 実行権限。
- **USER-10**: クラッシュ時の未保存下書き自動復旧は未完成。
- **CONC-02**: 同時発行の片方は UNIQUE で失敗しうる。再試行が必要。データ破損は起きない。

---

## テストの置き場

- ユニット: `tests/unit/production-risks/`
- 結合(実SQLite): `tests/integration/database/production-failure-risks.test.ts`
- 既存の回帰: `tests/unit/ai/` `tests/unit/tax/` `tests/unit/backup/` `tests/integration/database/`
- Rust: `src-tauri/src/commands/transaction.rs` `backup.rs`

実機のみの項目は `docs/MANUAL_STEPS.md` 「本番故障の実機確認」。
