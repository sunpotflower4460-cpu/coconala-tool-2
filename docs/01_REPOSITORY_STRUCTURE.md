# 01 — GitHubリポジトリ構成・技術設計

## 1. 推奨構成

```text
mitsumori-desk/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.yml
│   │   └── feature_request.yml
│   ├── pull_request_template.md
│   └── workflows/
│       ├── ci.yml
│       ├── release.yml
│       └── security.yml
│
├── docs/
│   ├── 00_PRODUCT_SPEC.md
│   ├── 01_REPOSITORY_STRUCTURE.md
│   ├── 02_DEVELOPMENT_PHASES.md
│   ├── 03_CLAUDE_CODE_KICKOFF.md
│   ├── 04_ACCEPTANCE_CHECKLIST.md
│   ├── ADR/
│   │   ├── 0001-tauri-desktop.md
│   │   ├── 0002-local-first-sqlite.md
│   │   ├── 0003-ai-is-optional.md
│   │   └── 0004-document-snapshots.md
│   ├── DATA_MODEL.md
│   ├── SECURITY.md
│   ├── MANUAL_STEPS.md
│   ├── SUPPORT_PLAYBOOK.md
│   └── RELEASE_PROCESS.md
│
├── public/
│   ├── sample/
│   │   ├── catalog-template.csv
│   │   └── inquiry-example.txt
│   └── help/
│       └── images/
│
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   ├── providers.tsx
│   │   └── error-boundary.tsx
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── forms/
│   │   ├── feedback/
│   │   └── documents/
│   │
│   ├── features/
│   │   ├── onboarding/
│   │   ├── companies/
│   │   ├── clients/
│   │   ├── catalog/
│   │   ├── csv-import/
│   │   ├── inquiries/
│   │   ├── estimates/
│   │   ├── invoices/
│   │   ├── deliveries/
│   │   ├── receipts/
│   │   ├── document-preview/
│   │   ├── backup/
│   │   ├── diagnostics/
│   │   ├── ai-settings/
│   │   └── app-settings/
│   │
│   ├── domain/
│   │   ├── money/
│   │   ├── tax/
│   │   ├── documents/
│   │   ├── catalog/
│   │   ├── clients/
│   │   └── shared/
│   │
│   ├── application/
│   │   ├── commands/
│   │   ├── queries/
│   │   ├── services/
│   │   └── ports/
│   │       ├── database.ts
│   │       ├── ai-provider.ts
│   │       ├── document-exporter.ts
│   │       ├── secret-store.ts
│   │       └── diagnostic-writer.ts
│   │
│   ├── infrastructure/
│   │   ├── database/
│   │   ├── ai/
│   │   │   ├── providers/
│   │   │   ├── schemas/
│   │   │   └── prompts/
│   │   ├── export/
│   │   ├── secrets/
│   │   ├── logging/
│   │   └── tauri/
│   │
│   ├── lib/
│   │   ├── validation/
│   │   ├── dates/
│   │   ├── formatting/
│   │   ├── result/
│   │   └── test-utils/
│   │
│   ├── styles/
│   ├── assets/
│   └── main.tsx
│
├── src-tauri/
│   ├── capabilities/
│   │   ├── default.json
│   │   ├── updater.json
│   │   └── diagnostics.json
│   ├── migrations/
│   │   ├── 0001_initial.sql
│   │   ├── 0002_document_snapshots.sql
│   │   └── README.md
│   ├── src/
│   │   ├── commands/
│   │   │   ├── backup.rs
│   │   │   ├── diagnostics.rs
│   │   │   ├── documents.rs
│   │   │   └── mod.rs
│   │   ├── services/
│   │   ├── security/
│   │   ├── error.rs
│   │   ├── lib.rs
│   │   └── main.rs
│   ├── icons/
│   ├── Cargo.toml
│   ├── build.rs
│   └── tauri.conf.json
│
├── tests/
│   ├── unit/
│   │   ├── money/
│   │   ├── tax/
│   │   └── documents/
│   ├── integration/
│   │   ├── database/
│   │   ├── backup/
│   │   └── ai-contract/
│   ├── e2e/
│   │   ├── onboarding.spec.ts
│   │   ├── manual-estimate.spec.ts
│   │   ├── inquiry-to-estimate.spec.ts
│   │   └── backup-restore.spec.ts
│   ├── fixtures/
│   │   ├── catalogs/
│   │   ├── inquiries/
│   │   └── expected-documents/
│   └── accessibility/
│
├── scripts/
│   ├── verify-release.mjs
│   ├── generate-sample-data.mjs
│   ├── redact-diagnostic-fixture.mjs
│   └── check-migrations.mjs
│
├── CLAUDE.md
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
└── .gitignore
```

---

## 2. なぜこの分け方にするのか

### `domain/`

金額計算、税、書類状態など、画面やデータベースに依存しない中心ルールを置く。

ここが独立していると、画面を作り直しても計算ロジックを守れます。

### `application/`

「見積を作る」「請求書へ変換する」など、利用者が行う一連の処理を置く。

### `infrastructure/`

SQLite、AI、ファイル保存、秘密情報保存など、外部技術への接続を置く。

AI会社を変えても、中心ロジックまで作り直さないための境界です。

### `features/`

画面ごとの機能をまとめます。関連するUI、フォーム、状態、テストを近くに置き、巨大な共通フォルダを作らないようにします。

### `src-tauri/`

OSに近い処理をRust側に置きます。バックアップ、診断、ファイル出力、安全な秘密保存などを担当します。

---

## 3. レイヤー間のルール

```text
UI / features
    ↓
application
    ↓
domain

infrastructure → applicationのportを実装
Tauri/Rust → OS機能と安全なファイル処理を提供
```

禁止事項:

- `domain`からReact、Tauri、SQLite、AI SDKを直接呼ばない
- UIコンポーネント内で税計算をしない
- AIの返答を直接DBへ保存しない
- SQL文を画面コンポーネントに書かない
- APIキーをReact state、localStorage、ログへ残さない

---

## 4. 主要データモデル

### `companies`

利用者の会社・屋号の現在設定。

主な項目:

- `id`
- `display_name`
- `representative_name`
- `postal_code`
- `address`
- `phone`
- `email`
- `invoice_registration_number`
- `bank_details_encrypted_or_local`
- `logo_path`
- `created_at`
- `updated_at`

### `clients`

顧客マスター。

### `catalog_items`

商品・サービス価格表。

主な項目:

- `name`
- `description`
- `unit`
- `unit_price_yen`
- `cost_price_yen`
- `tax_category`
- `is_active`

### `catalog_aliases`

「動画編集」「編集作業」「YouTube編集」など、問い合わせ文と価格表を結ぶ別名。

### `documents`

見積・請求・納品・領収書の共通ヘッダー。

- `document_type`
- `document_number`
- `status`
- `issue_date`
- `due_date`
- `valid_until`
- `currency`
- `subtotal_yen`
- `discount_yen`
- `tax_yen`
- `total_yen`
- `company_snapshot_json`
- `client_snapshot_json`
- `calculation_snapshot_json`
- `source_document_id`
- `created_at`
- `issued_at`

### `document_lines`

書類明細。商品マスターIDだけでなく、発行時の商品名・単価・税区分も保存する。

### `document_events`

発行、承認、請求変換、入金、取消などの履歴。

### `ai_extractions`

元文章、使用モデル、構造化結果、確認状態を保存する。ただしAPIキーは保存しない。

### `app_settings`

端数処理、番号形式、テーマ、AI使用有無など。

---

## 5. データ設計の重要点

### 金額は整数

`19800円`は`19800`として保持します。`19800.0`のような小数では持ちません。

### 発行済み書類はスナップショット

価格表の単価を変更しても、先月の見積書の金額は変わってはいけません。発行時の会社情報、顧客情報、明細、計算結果を保存します。

### 外部キーを有効化

SQLite接続ごとに外部キー制約を有効にし、孤立データを防ぎます。

### マイグレーション

DB構造の変更は番号付きSQLで管理します。アプリ起動時に未適用分を順番に適用し、バックアップ後に実行します。

---

## 6. AI設計

### Adapter方式

```ts
interface AiProvider {
  testConnection(): Promise<Result<ConnectionStatus, AiError>>;
  extractInquiry(input: InquiryExtractionInput): Promise<Result<InquiryExtraction, AiError>>;
}
```

最初は1社に対応しても、画面・DB・ドメインは特定会社へ直接依存させません。

### AI処理の順序

1. 利用者が問い合わせ文を入力
2. 送信内容を確認
3. AIへ構造化JSONを要求
4. スキーマ検証
5. 価格表IDの存在確認
6. 数量・日付・信頼度の範囲確認
7. 候補画面へ表示
8. 利用者が承認・修正
9. 見積下書きを作成

### AI失敗時

- 元文章を失わない
- 手動見積へ切り替えられる
- エラーを専門用語で表示しない
- 再試行時に二重書類を作らない
- 不正なJSONをDBへ保存しない

---

## 7. 帳票設計

### 正本データ

帳票の正本はDB内の発行済みスナップショットです。PDFファイルそのものだけを正本にしません。

### 初期実装

1. Reactで印刷専用HTMLテンプレートを描画
2. 画面プレビュー
3. OSの印刷ダイアログから印刷・PDF保存
4. 用紙サイズ、余白、改ページを固定

### 販売前の強化

- ワンクリックPDFファイル出力を実装・検証
- 日本語フォント、長い住所、長い商品名をテスト
- 2ページ以上の明細でヘッダー・合計が崩れないことを確認
- PDFのファイル名を安全に生成

PDF生成方式はPhase 2で小さな技術検証を行い、macOS・Windows双方で最も安定する方式をADRへ記録します。

---

## 8. バックアップ設計

現在の実装(`src-tauri/src/commands/backup.rs`)は、`.mdeskbackup`のような単一コンテナ
形式ではなく、SQLiteファイル1つ+メタデータJSON1つのペアで構成する。会社ロゴ等の
アプリ管理下アセットファイルへの参照(`companies.logo_path`)はスキーマ上存在するが、
実際にファイルを取り込むUIが未実装のため、現時点ではDB本体の一貫したバックアップの
確保を優先している。アセットファイルの取り込みUIを実装する際は、本設計もアセットの
バンドルを含む形へ拡張すること。

バックアップファイル例:

```text
mitsumori-desk-backup-20260716-153000.db
mitsumori-desk-backup-20260716-153000.db.manifest.json
```

生きているDB(アプリが読み書きしている可能性があるDB)からバックアップを作成する際は、
`fs::copy`による素朴なファイルコピーではなく、SQLiteの`VACUUM INTO`を使う。
ジャーナルモード(WAL/ロールバックジャーナル)や書き込み中かどうかに関わらず、
その時点で一貫した単一ファイルのスナップショットが得られる。バックアップ完了後は
`PRAGMA integrity_check`を行い、失敗した場合はそのバックアップを破棄してエラーを返す。

`<file>.manifest.json`には次を含める。

- `backup_format_version`
- `app_version`
- `schema_version`
- `created_at_unix`
- `os`

バックアップは外部フォルダへの書き出し(`export_backup_to`)・外部ファイルからの
取り込み(`import_backup_from`)にも対応する。取り込み時は`PRAGMA integrity_check`と
このアプリのテーブル構造(`app_settings`の存在)を検証し、他アプリのSQLiteファイルや
破損ファイルは取り込まない。

復元前に現在データを自動退避(こちらもVACUUM INTOで一貫したスナップショットを取り、
整合性検証まで行う)し、退避または検証に失敗した場合は復元自体を開始しない。
復元処理自体が失敗した場合は退避データへロールバックする。

---

## 9. 診断設計

診断ファイルに含める:

- アプリバージョン
- OSとCPU種別
- DBスキーマバージョン
- 直近エラーの種類と時刻
- 機能フラグ
- 個人情報を除いた処理ステップ

含めない:

- APIキー
- 顧客名・住所・メール
- 問い合わせ本文
- 書類明細
- 振込先
- ローカルファイルの完全パス

診断作成後、アプリ自身で禁止文字列・秘密情報パターンを再検査します。

---

## 10. Tauri権限設計

Tauriの権限は最小限にする。

- 通常画面: DB、選択したファイル、必要なダイアログだけ
- 更新処理: updater権限を別Capabilityへ分離
- 診断処理: 許可した保存先だけ
- 任意のShell実行は原則禁止
- 任意URLへのHTTP通信は禁止し、AI Providerと更新先を限定

`capabilities/default.json`を「全部許可」にしない。

---

## 11. テスト構成

### Unit

- 税計算
- 端数処理
- 値引き順序
- 書類番号
- 状態遷移
- 見積から請求への変換

### Integration

- SQLite migration
- 外部キー
- 発行後スナップショット
- CSV mapping
- バックアップ・復元
- AI JSON validation

### UI / E2E

`tests/e2e/`(Playwright、ブラウザのみ)はTauri IPC/SQLiteに接続できないため、
デスクトップアプリとして起動してくださいという案内画面までしか検証できない。
`tests/e2e-tauri/`(`tauri-driver`+WebKitWebDriver、Linux専用、`ci.yml`の`e2e-tauri`ジョブ)が
実際にビルドしたアプリを操作する。

実施済み(`tests/e2e-tauri/scenarios/`):

- 初回設定(会社情報・税設定・顧客登録・価格表登録・練習見積作成)
- 練習見積での金額計算(小計・消費税・合計)の画面表示確認
- アプリ再起動後のデータ永続化(初回設定完了状態・見積一覧)

未実施(将来のE2E拡張候補、または実機のみ確認可能):

- 問い合わせ→確認→見積
- 見積→請求書等の変換、状態遷移、発行済み見積の不変性
- 印刷プレビュー、PDF保存(実機での目視が前提)
- バックアップ→初期化→復元

### Accessibility

- キーボード移動
- フォーカス表示
- 色だけに頼らない警告
- ラベルとエラー読み上げ

---

## 12. GitHub運用

### Branch

- `main`: 常にリリース可能
- `develop`: 必要になった場合のみ
- `feat/<name>`
- `fix/<name>`
- `chore/<name>`

小規模開発では、短命ブランチから`main`へのPRを基本とする。

### Commit例

```text
feat(catalog): add CSV column mapping
fix(tax): preserve per-line rounding rule
test(backup): verify restore rollback
docs(manual): add Windows install steps
```

### PR必須条件

- 型チェック
- Lint
- Unit test
- 変更箇所のIntegration test
- UI変更時のスクリーンショット
- DB変更時のmigrationと復元テスト
- 利用者向け変更時のREADMEまたはヘルプ更新

---

## 13. CI / Release

### Pull Request

- dependency install
- lint
- typecheck
- unit/integration tests
- Rust fmt/clippy/test
- production build

### タグ付きRelease

- macOS / Windows build
- 成果物ハッシュ
- 署名・公証
- updater用署名
- `latest.json`
- CHANGELOG
- インストール確認チェック

秘密鍵・証明書はGitHub Secrets等へ置き、リポジトリに保存しない。
