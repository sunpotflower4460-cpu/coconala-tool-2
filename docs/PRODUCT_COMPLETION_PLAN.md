# PRODUCT_COMPLETION_PLAN.md — ココナラ販売「商品完成」プラン

このプランはオーナーと合意した内容を、そのままリポジトリに残したものです。進捗は各ステップのコミットと `CHANGELOG.md` を正とします。

## Context(なぜやるか)

コード面の機能(見積→発行→請求/納品/領収書、CSV取り込み、バックアップ、診断、任意AI)は Phase 0〜6 と PR-1〜#17 でほぼ揃っている。
しかし「ココナラでファイルとして納品できる完成品」には次が足りない。

- 配布物: 署名・公証済み **dmg** と Windows **インストーラー(.exe)** を、ココナラのトークルームへ添付できる形(1ファイル200MB以下・クラウドストレージのリンクは禁止)で作る仕組みがない。アイコンは Tauri 既定の絵、製品名は `mitsumori-desk`、`Cargo.toml` は `A Tauri App` / `you` のまま。
- 不正コピー対策: ライセンスは常に `unlicensed` を返すスタブだけ。
- 購入者の運用: サポートと更新はココナラのメッセージ経由しか使えない(外部の連絡先交換は禁止)。この前提が文書・ヘルプ・画面文言に反映されていない。
- 実機で問題になりそうなコードの穴:
  - 帳票の合計欄が、値引きありや税込みの書類で計算ミスに見える(表示の問題。計算自体は正しい)。
  - 適格請求書に必要な「税率ごとの対象額」が表示されていない。
  - AI呼び出しに `anthropic-dangerous-direct-browser-access` ヘッダーがない。実アプリでは CORS で失敗する可能性が高い。
  - ロゴ登録UIがない。
  - CSV書き出しがない。
  - 帳票番号・端数設定を後から変える画面がない。
  - 未保存の下書きを守る仕組みがない。
  - アプリの二重起動を防いでいない。
- 対応OS: 方針が「macOSのみ」になっている。オーナーの決定で **macOS+Windows の両方** に変える。

### オーナー決定事項(このセッションで確認済み)

1. **納品物**: ココナラで渡せるファイル一式にする。macOS は **Developer ID 署名+公証済み dmg**。既存の Apple Developer Program 登録を使い、App Store には出さない。証明書と Secrets の登録は人間作業として**最後**に回す。Windows は**署名なし NSIS インストーラー**に、SmartScreen を通す手順書を付ける。
2. **不正コピー対策**: **オフラインのライセンスキー**(Ed25519署名)。ライセンスが未認証でもデータは必ず開ける(ADR 0008 の原則を守る)。
3. **更新**: ココナラのトークルーム/DMで手動配布する。自動更新は入れない。
4. **範囲**: コードでできることは全部 Claude が実装する。人間作業は `docs/MANUAL_STEPS.md` と `docs/HUMAN_RELEASE_CHECKLIST.md` に整理して最後に回す。

すべての作業ブランチ: `claude/coconala-product-plan-5psw3u`。各ステップは1コミット(または小PR)単位で、CLAUDE.md の必須チェックを通してから push する。

---

## ステップ一覧(実装順)

### S0. プランの文書化

- `docs/PRODUCT_COMPLETION_PLAN.md` を新規作成し、このプランを日本語で保存する。
- `docs/02_DEVELOPMENT_PHASES.md` に「Phase 7: ココナラ納品物の完成」を追記する。

### S1. 実機で壊れる不具合の先回り修正(小さく、効果大)

- **【最優先】帳票の合計欄が計算ミスに見える問題**
  - 現状: `DocumentPrintLayout.tsx` の「小計」は、`calculate-document-totals.ts` が返す**値引き後**の `subtotalYen` になっている。その下にさらに「値引き -X」を表示している。
  - 例: 明細10万円・値引き1万円 → 小計90,000 / 値引き-10,000 / 消費税9,000 / 合計99,000。読み手は 90,000−10,000+9,000=89,000 と受け取るので、合計が合わないように見える。
  - 税込み(`tax_inclusive`)の書類でも「小計+消費税≠合計」に見える。
  - 修正(表示だけ。計算とスナップショットは変えない):
    - 「明細合計(値引き前)= subtotalYen + discountYen」→「値引き」→「小計(値引き後)」の順にする。
    - 税込みのときは税額の見出しを「(うち消費税 10%)」にする。
  - 画面側のプレビューや詳細画面の合計表示にも同じ問題がないか確認する。
  - fixture A〜M に値引きあり・税込みの組み合わせを足し、「表示された数字を上から足し引きすると合計になる」ことをテストで固定する。
- `src/infrastructure/ai/providers/anthropic-provider.ts`: `anthropic-dangerous-direct-browser-access: true` ヘッダーを追加する。`tests/unit/ai/anthropic-provider.test.ts` に「ヘッダーが付く」「キーがエラー文に出ない」を追加する。
- 二重起動を防ぐ: `tauri-plugin-single-instance` を導入する(Rust の `lib.rs` に登録。2つ目は既存ウィンドウを前面に出して終了)。これで CONC-08 を「実機」から「自動+実機」にする。
- 印刷: `DocumentPrintPage.tsx` の `window.print()` をやめ、Rust コマンド `print_current_window`(Tauri 2 の `WebviewWindow::print()`)経由にする。Tauri 外(vitest/dev)では `window.print()` にフォールバックする。
- keyring v4 のストア初期化を確認する。Windows/macOS で `Entry::new` が既定ストア未設定で失敗しないかを確かめ、必要なら `lib.rs` で native store を設定する。CI の macOS/Windows ジョブで失敗しないことをテストで確認する。

### S1 に追加する不具合(設計レビューで判明)

- **発行時に未保存の編集が捨てられる**: `EstimateEditorPage.tsx` の発行は保存済みの版を発行する。編集後すぐ「発行」すると古い内容が発行される → 発行前に必ず保存してから発行する。
- **編集画面が保存のたびに `dueDate: null` を書く**: 請求書の支払期限が消える → 支払期限欄を追加し、既定値(会社設定の日数)を適用する。
- **下書きプレビューと発行で端数処理がずれることがある**: プレビューは設定値、発行は書類保存時の値 → プレビューも書類の値を使う。
- **明細の金額が全体値引きの配分後の額で印刷される**: 明細行は明細値引き後の額、全体値引きは合計欄だけで表す。
- **種別をまたいで書類番号が衝突しうる**: 採番は同じ種別だけを見ているが、番号の一意制約は全種別にかかる → 採番を全種別で行い、プレフィックスの重複を設定画面で禁止する(S4)。
- **macOS で印刷が無反応になる可能性**: Tauri 2 の print 許可が capability にない → Rust の印刷コマンドにし、失敗時はエラーを表示する。PDFの既定ファイル名になる `document.title` を書類番号にする。

### S2. 製品の顔(名前・アイコン・メタデータ)

- `tauri.conf.json`:
  - `productName` を ASCII の `MitsumoriDesk` に変える(インストーラー名が文字化けしないようにするため)。
  - **`identifier` は変えない**(データ保存先が変わるため。発売後も固定と ADR に明記する)。
  - macOS の表示名は `src-tauri/Info.plist` のマージで `CFBundleDisplayName=見積・請求書デスク` にする。
  - `minimumSystemVersion` を Tauri 2 の下限 `10.15` にする(最終値は実機で確定)。
- `Cargo.toml` の `description` と `authors` を直す。
- オリジナルのアプリアイコン: リポジトリ内の SVG 原画(`src-tauri/icons/source/app-icon.svg`)を作り、`pnpm tauri icon` で全サイズを生成する。`public/tauri.svg` と `public/vite.svg` を削除する。
- `tests/e2e-tauri/run.sh` のバイナリパスを確認する。バイナリ名は Cargo パッケージ名なので、変わる場合だけ直す。

### S3. オフライン・ライセンスキー

- **形式**: `MD1-XXXX-...`。payload は `{v:1, lid:<ランダムID>, ed:"standard", iat:"YYYY-MM-DD"}`。これに Ed25519 署名を付けて base32(Crockford)で表す。**個人情報は入れない**(購入者との対応表は販売者が手元で管理する)。
- **検証**: Rust コマンド `license_verify(key)`(`ed25519-dalek`)。公開鍵は `src-tauri/src/license/public_key.rs` に埋め込む。開発用の鍵を置いておき、strict gate で本番鍵への差し替えを強制する。
- **保存**: migration `0005_license_and_assets.sql` で `app_settings.license_key TEXT` を追加する。秘密情報ではないので DB でよく、バックアップにも含まれる(PC移行で再入力が要らない)。
  - あわせて `schema-version.ts`、`lib.rs`、`check-migrations` を更新する。
- **アプリ側の差し替え**:
  - `src/infrastructure/license/offline-license-check.ts` を追加する。
  - 現状 `VersionInfoPage.tsx` は `noLicenseCheck` を直接 import している。`src/app/providers.tsx` に LicensePort の Context を足して注入に切り替え、ホームの案内帯・印刷画面・バージョン画面から同じ状態を読めるようにする。テストでは fake を注入する。
  - `LicensePort` の状態は `valid | invalid | unlicensed` をそのまま使う。
- **未認証時の動作(ADR 0009 として新設し、0008 の方針を引き継ぐ)**:
  - データの閲覧・編集・発行・バックアップ・書き出しは**すべて可能**。
  - ホームと上部に「ライセンス未登録」の案内帯を出す。
  - 印刷レイアウトに「未認証版」の透かしを入れる。表示層だけで処理し、スナップショットは変えない。
  - 書類コマンド(`application/commands`)はライセンスを参照しない(SEC-04 のテストを維持する)。
- **UI**:
  - `version-info/labels.ts` の `unlicensed` 表示「買い切り版(ライセンス認証不要)」を「ライセンス未登録」に変える。関連テストと RELEASE_GATES の記述も直す。
  - バージョン情報画面に「ライセンスキーを入力/確認/削除」を置く。
  - 初回設定ウィザードの最初に任意ステップ「ライセンスキー(後でも可)」を置く。
- **販売者ツール**:
  - `scripts/license/generate-keypair.mjs`: 秘密鍵をリポジトリの外(既定 `~/.mitsumori-desk-license/`)にだけ書き出す。リポジトリ内のパスは拒否する。
  - `scripts/license/issue-license.mjs`: キーを発行し、手元の台帳CSV(リポジトリ外)に追記する。
  - `.gitignore` と `security.yml` に `PRIVATE KEY` と `*.pem` の検出を追加する。
- **テスト**:
  - Rust: 正しい鍵、改ざん、別鍵、形式不正。
  - TS: 状態表示、透かし、SEC-04 の維持。
  - release-checks: 開発鍵のままなら strict で失敗し、秘密鍵のコミットも検出する。

### S4. 帳票の完成度

- **ロゴ**:
  - 会社設定と初回設定に画像選択を付ける。PNG/JPEG を canvas で最大 512px・200KB 以下に縮めてから保存する。
  - 保存先は migration 0005 の `app_assets(sha256 PK, mime, data_base64 TEXT)` とする。BLOB は plugin-sql 経由の扱いが不安定なので、base64 の TEXT にする。
  - `companies.logo_asset_sha256` から参照する。未使用の `companies.logo_path` は残しても互換性に問題はないが、使わない。
  - 発行時の `company_snapshot_json` には sha256 だけを入れる。参照中の asset は削除しない。これで**発行済み書類のロゴも不変**になり、バックアップにも自動で含まれる。
  - `DocumentPrintLayout.tsx` でロゴを表示する(ロゴあり/なしの fixture を追加する)。
- **帳票設定画面** `/settings/documents`: 今は変えられない番号プレフィックス(`app_settings.document_number_prefix_*`)と端数処理(初回設定でしか選べない)を設定できるようにする。`update-app-settings.command.ts` を再利用する。有効期限と支払期限の日数は、既存どおり会社設定(`companies.estimate_valid_days` / `payment_due_days`)に置く。
- **インボイス(適格請求書)記載事項の点検**: 登録番号、取引年月日、取引内容、軽減税率対象の「※」表示、税率ごとの対価の額と税額、交付先名称。足りないものはレイアウトに追加し、テストで固定する。
  - 確認済みの不足: `DocumentPrintLayout.tsx` の合計欄は「消費税(区分)」の税額しか出しておらず、**税率ごとの対象額(例「10%対象 ¥50,000」)がない**。対象額は `src/domain/tax/calculate-document-totals.ts` の `taxBreakdown[].taxableAmountYen` としてすでに計算され、スナップショットにも入っている。そのため**表示だけの修正**で済む(計算やスナップショットの形は変えない)。全体値引きがある場合に、区分ごとの対象額が値引き後の額になっているかをテストで確認する。ヘルプに「電子(PDF)の領収書に収入印紙は不要。紙で渡す5万円以上は要確認」の注意を足す。
- **PDF保存の案内**: 印刷画面に、OS別の「PDFとして保存」の手順を常に表示する(macOS: 左下の「PDF」→「PDFとして保存」、Windows: プリンターで「Microsoft Print to PDF」を選ぶ)。

### S5. データの出し入れと安全性の仕上げ

- **CSV書き出し**: 価格表、顧客、書類一覧(番号・種別・日付・顧客・税率別金額・状態)。UTF-8 BOM 付きで Excel でも文字化けしないようにする。`=` `+` `-` `@` とタブで始まるセルの先頭に `'` を付け、Excel の式として実行されないようにする(取り込み側 USER-CSV-01 と同じ考え方。テストで固定する)。診断保存で使っている保存ダイアログと `write_text_file` の経路を再利用し、domain にシリアライザを作ってテストする。
- **未保存の下書きを守る(USER-10)**: `EstimateEditorPage.tsx` に、変更があるまま画面を離れるときの確認と、一定間隔の自動下書き保存を入れる(発行済みには作用させない)。
- **二重変換の警告(CONC-CONVERT-01)**: 変換済みの書類がある場合、`DocumentDetailPage.tsx` で「すでに作成済みの請求書があります。もう1件作りますか?」と確認する。
- **アンインストールとPC移行**: Windows NSIS のアンインストーラーでは「データも削除」チェックを既定OFFにする。移行手順(バックアップ書き出し→新PCで取り込み)をヘルプに書く。

### S6. Windows を正式対象にする準備

- `tauri.conf.json`: `bundle.targets` を `["dmg","app","nsis"]` にする(MSI は作らない)。`windows.nsis.languages: ["Japanese"]`、`installMode: "currentUser"`(管理者権限不要)、`webviewInstallMode: embedBootstrapper` にする。
- 購入者向け文書に Windows のインストール手順と SmartScreen を通す手順(「詳細情報」→「実行」)を足す。
- `docs/supported-platforms.json` と `SUPPORTED_PLATFORMS.md` の方針を「macOS+Windows を販売対象(Windows は署名なし)」に書き換える。
  - ただし `firstSale` への `windows` 追加は **実機確認後に人間が1行変える**(自動ゲートは維持する)。
  - それまで Windows は `pendingDeviceVerification` のまま。
- `release-checks.mjs` の禁止表現を新方針に合わせて見直し、テストを更新する。

### S7. ココナラ納品パッケージの自動生成

- **購入者向けPDF**: `scripts/build-delivery-docs.mjs` を作る。Markdown を HTML にし、Playwright/Chromium の `page.pdf()` で出力する。日本語フォントは CI で `fonts-noto-cjk` を入れる。生成するもの:
  - `はじめにお読みください.pdf`: インストール(Mac/Win)、ライセンスキー入力、更新とサポートはココナラのメッセージで行うこと。
  - `クイックスタートガイド.pdf`
  - `ユーザーマニュアル.pdf`
  - `利用規約.pdf`、`免責事項.pdf`(DRAFT の間は「下書き」の透かしを入れる)
- **同梱物**: 価格表と顧客のサンプルCSV(既存の fixture から生成)。
- **新ワークフロー** `.github/workflows/installers.yml`(手動実行+タグで起動):
  - macOS universal dmg と Windows setup.exe をビルドする。
  - OS ごとに `MitsumoriDesk_<ver>_mac.zip` と `MitsumoriDesk_<ver>_windows.zip` をまとめて artifact にする。
  - **200MB を超えたら失敗**させる。
  - 署名 Secrets があれば署名・公証し、なければ未署名で作る。そのときはファイル名に `-unsigned` を付け、誤って販売しないようにする。
- `release.yml`: 不要な `TAURI_SIGNING_PRIVATE_KEY` を外す(自動更新なし)。納品 zip も draft Release に添付する。
- `security.yml`: `pnpm audit` を high 以上でリリースゲートを失敗させる(通常 CI は現状維持)。

### S8. 購入者向け文言と文書の全面更新

- サポート窓口を「ご購入時のトークルーム/取引完了後はココナラのメッセージ」に決め、`support-contact: CONFIRMED` にする(`HelpPage.tsx`、`USER_MANUAL.md`、`README.md`)。外部の連絡先は書かない。
- 更新案内を「ココナラのメッセージで新しい版をお届けします」に統一する(`version-info/labels.ts`、`not-configured-update-check.ts` の文言、ADR 0008 の追記)。
- 次の文書を最新にする: `COCONALA_LISTING.md`(両OS、ライセンスキー、納品の流れ、禁止事項に沿った文面)、`QUICK_START_GUIDE.md`、`USER_MANUAL.md`、`DEMO_VIDEO_SCRIPT.md`。
- 新規文書:
  - `docs/SUPPORT_PLAYBOOK.md`: 販売者向け。問い合わせの定型返信、診断ファイルの受け取り方、キー再発行、更新版の配布手順。
  - `docs/SELLER_OPERATIONS.md`: 注文ごとのキー発行と納品メッセージのテンプレート。
- 文書の不整合を直す: `DATA_MODEL.md`(VACUUM INTO)、`01_REPOSITORY_STRUCTURE.md` §11、`SECURITY.md`、`TEST_EVIDENCE_TEMPLATE` への参照、CHANGELOG に #16 と今回分を追記する。
- 商品画像の素材: `tests/e2e-tauri` に練習データで主要画面をスクリーンショットするシナリオを追加する(Linux 描画の素材であり、最終画像は人間が作る)。

### S9. 最終ゲートと人間作業の整理(最後)

- `docs/MANUAL_STEPS.md` と `HUMAN_RELEASE_CHECKLIST.md` を、この順の「最後にやる人間作業」リストに作り直す。
  1. Developer ID Application 証明書を作り、app 用パスワードと Team ID を用意して GitHub Secrets に登録する。
  2. `generate-keypair` で本番のライセンス鍵を作り、公開鍵を差し替え、秘密鍵をバックアップする。
  3. 権利者名、publisher/copyright、特商法表記(ココナラの設定)、規約・免責の確定、価格と返金条件を決める。
  4. Mac/Windows の実機で次を確認する: インストール、PDF A〜M、バックアップ×10、上書き更新でDBが残ること、実APIキー、IME、小さい画面。
  5. `firstSale` に windows を追加し、`minimumSystemVersion` を確定する。
  6. β(5〜10名)とサインオフ。
  7. `0.9.0-rc.1` → `1.0.0`。`installers.yml` の署名済み zip をトークルームへ添付できる状態にし、出品ページを公開する。
- バージョンを上げる判断は人間が行う(Claude は上げない)。

---

## 主な再利用先

- 保存ダイアログと書き出し: 診断保存(`DataManagementPage.tsx` → Rust `write_text_file`、`src-tauri/src/commands/diagnostics.rs`)
- 設定の更新: `src/application/commands/update-app-settings.command.ts`
- 複数の文を1つのトランザクションで: `executeTransaction`(`src-tauri/src/commands/transaction.rs`)
- 秘密情報の検査: `src/domain/diagnostics/secret-scan.ts`、`scripts/release-checks.mjs`
- 帳票の fixture: `tests/fixtures/pdf-visual/cases.ts`
- migration 検査: `scripts/check-migrations.mjs`、`sqlx-migrations.mjs`

## 検証(各ステップ共通)

- `pnpm lint && pnpm typecheck && pnpm test && pnpm check:migrations && pnpm check:release`
- `pnpm rust:fmt:check && pnpm rust:clippy && pnpm rust:test`
- `pnpm tauri build`(Linux。コンテナで可能な範囲)。可能なら `xvfb-run pnpm test:e2e-tauri` も実行する。
- macOS/Windows のビルドは GitHub Actions(`ci.yml` の build matrix と新しい `installers.yml`)で確認する。
- S3: 開発鍵で発行したキーが通り、改ざんしたキーが `invalid` になることを Rust テストと E2E で確認する。
- S7: `installers.yml` を手動実行し、zip の中身・サイズ・ファイル名(`-unsigned`)を確認する。
- 実機でしか確認できない項目は、完了扱いにせず `RELEASE_EVIDENCE.md` の人間欄に残す。

## 実装時に確かめる前提(リスク)

- Tauri 2 の `WebviewWindow::print()` が macOS と Windows で印刷ダイアログを出すか。コンテナでは確認できないので、CI のビルドと人間の実機確認で担保する。
- keyring v4 の既定ストアが macOS と Windows で自動設定されるか。
- `productName` の変更でバイナリ名や E2E のパスが変わるか。データフォルダは `identifier` から決まるので変わらない想定。
- ライセンスキー方式の限界: 同じキーを共有されることは防げない。規約(台数)と台帳で抑止する。オンライン認証はしない方針。
- ココナラの規約(外部連絡先の交換禁止、クラウドストレージでの受け渡し禁止、添付は200MBまで)は変わることがあるので、出品前に人間が最新の規約を確認する。

## オーナーへの報告

各ステップの完了時に、CLAUDE.md の7項目(できるようになったこと/変更ファイル/テスト結果/画面確認手順/未完了/次/MANUAL_STEPS 追加分)を日本語で報告する。

---

## 進捗(2026-09-28 時点)

| ステップ                  | 状態                     | 主なコミット                                          |
| ------------------------- | ------------------------ | ----------------------------------------------------- |
| S0 プラン文書化           | 完了                     | docs: ココナラ納品物完成プラン                        |
| S1 実機不具合の先回り修正 | 完了                     | 合計欄・発行前保存・AIヘッダー・印刷・二重起動        |
| S2 製品名・アイコン       | 完了                     | MitsumoriDesk / 独自アイコン / OS別インストーラー設定 |
| S3 ライセンスキー         | 完了                     | Ed25519・未認証版の透かし・販売者スクリプト           |
| S4 帳票の完成度           | 完了                     | ロゴ・帳票の設定・登録番号・日付の初期値・PDF案内     |
| S5 データの出し入れ       | 完了                     | CSV書き出し・未保存の保護と自動保存・二重変換の確認   |
| S6 Windows の準備         | 完了                     | 手順書・配布準備のゲート(firstSale への追加は人間)    |
| S7 納品zip                | 完了(CIでの実行は未確認) | installers.yml・PDF生成・zip化                        |
| S8 文言・文書             | 完了                     | サポート窓口確定・ヘルプ・出品文・販売者手順          |
| S9 人間作業の整理         | 完了                     | HUMAN_RELEASE_CHECKLIST を実施順に再構成              |

残りはすべて人間の作業です。順番は [`HUMAN_RELEASE_CHECKLIST.md`](HUMAN_RELEASE_CHECKLIST.md) を見てください。
