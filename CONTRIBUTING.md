# CONTRIBUTING

開発者向けのセットアップ・ブランチ運用・PR前チェックをまとめます。購入者向けの製品情報は
[README.md](README.md) を参照してください。

## 必要なもの

- Node.js 22系
- pnpm
- Rust (stable)
- Tauri 2の[各OS向け前提パッケージ](https://tauri.app/start/prerequisites/)

## セットアップ

```bash
pnpm install
```

## 開発サーバー起動

```bash
pnpm tauri dev
```

## 主要スクリプト

| コマンド                    | 内容                                                                             |
| --------------------------- | -------------------------------------------------------------------------------- |
| `pnpm dev`                  | Viteの開発サーバーのみ起動                                                       |
| `pnpm tauri dev`            | デスクトップアプリとして起動                                                     |
| `pnpm lint`                 | ESLint                                                                           |
| `pnpm format:check`         | Prettierチェック                                                                 |
| `pnpm typecheck`            | TypeScript型チェック                                                             |
| `pnpm test`                 | フロントエンドのunit/integration test (Vitest)                                   |
| `pnpm test:e2e`             | E2Eテスト (Playwright、ブラウザのみ)                                             |
| `pnpm test:e2e-tauri`       | 実Tauriアプリに対するE2Eテスト(Linux専用、`tests/e2e-tauri/README.md`参照)       |
| `pnpm check:migrations`     | migration適用・番号・lib.rs登録・schema version同期の検証                        |
| `pnpm seed:stress`          | 開発専用の大量データ生成(既定は full。本番アプリからは実行不可。Windowsでも動作) |
| `pnpm seed:stress:ci`       | 同上の小さいプロファイル(CI/自動テスト向け)                                      |
| `pnpm check:release`        | リリース前チェック(basic。プレースホルダーは警告)                                |
| `pnpm check:release:rc`     | RCタグ用チェック(秘密情報・OS表記・更新未実装の明記を必須)                       |
| `pnpm check:release:strict` | 正式タグ用の厳格判定(プレースホルダー・DRAFT・窓口未確定でも失敗)                |
| `pnpm rust:fmt:check`       | Rust fmtチェック                                                                 |
| `pnpm rust:clippy`          | Rust clippy (警告をエラー扱い)                                                   |
| `pnpm rust:test`            | Rustのテスト                                                                     |
| `pnpm tauri build`          | 本番ビルド                                                                       |

## ドキュメント

- [`CLAUDE.md`](CLAUDE.md) — 開発AIへの絶対ルール
- [`docs/00_PRODUCT_SPEC.md`](docs/00_PRODUCT_SPEC.md) — 商品仕様
- [`docs/01_REPOSITORY_STRUCTURE.md`](docs/01_REPOSITORY_STRUCTURE.md) — リポジトリ構成
- [`docs/02_DEVELOPMENT_PHASES.md`](docs/02_DEVELOPMENT_PHASES.md) — 開発段階
- [`docs/04_ACCEPTANCE_CHECKLIST.md`](docs/04_ACCEPTANCE_CHECKLIST.md) — 販売可能判定チェックリスト
- [`docs/RELEASE_GATES.md`](docs/RELEASE_GATES.md) — 正式販売化の優先度・リリースゲート
- [`docs/RELEASE_PROCESS.md`](docs/RELEASE_PROCESS.md) — リリース手順
- [`docs/RELEASE_EVIDENCE.md`](docs/RELEASE_EVIDENCE.md) — 自動確認と人間確認の証跡欄
- [`docs/SUPPORTED_PLATFORMS.md`](docs/SUPPORTED_PLATFORMS.md) — 販売上の公式対応OS
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — DBスキーマと金額計算仕様
- [`docs/SECURITY.md`](docs/SECURITY.md) — セキュリティ方針
- [`docs/MANUAL_STEPS.md`](docs/MANUAL_STEPS.md) — 人間だけが行う作業一覧
- [`docs/HUMAN_RELEASE_CHECKLIST.md`](docs/HUMAN_RELEASE_CHECKLIST.md) — 発売直前に人間が上から実施する順
- [`docs/COCONALA_LISTING.md`](docs/COCONALA_LISTING.md) — ココナラ出品文の下書き
- [`docs/CURSOR_COMPLETION_REPORT.md`](docs/CURSOR_COMPLETION_REPORT.md) — Cursor作業範囲と残作業
- [`docs/ADR/`](docs/ADR/) — 技術判断の記録

## ブランチ運用

- `main`: 常にリリース可能
- `feat/<name>` / `fix/<name>` / `chore/<name>`: 短命ブランチから`main`へPR

## コミットメッセージ

```text
feat(catalog): add CSV column mapping
fix(tax): preserve per-line rounding rule
test(backup): verify restore rollback
docs(manual): add Windows install steps
```

## PRを出す前に

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

DBスキーマを変更する場合は、必ず`src-tauri/migrations/`へ新しい番号付きSQLファイルを追加してください。既存のmigrationファイルは変更しないでください。

## アーキテクチャの原則

`CLAUDE.md`と`docs/01_REPOSITORY_STRUCTURE.md`のレイヤー分離ルールに従ってください。

- `domain`はReact / Tauri / SQLite / AI SDKに依存しない
- UIコンポーネントに税計算やSQLを書かない
- AIの応答は必ずスキーマ検証してから使う
