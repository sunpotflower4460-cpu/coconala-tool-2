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

| コマンド                | 内容                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `pnpm dev`              | Viteの開発サーバーのみ起動                                                         |
| `pnpm tauri dev`        | デスクトップアプリとして起動                                                       |
| `pnpm lint`             | ESLint                                                                             |
| `pnpm format:check`     | Prettierチェック                                                                   |
| `pnpm typecheck`        | TypeScript型チェック                                                               |
| `pnpm test`             | フロントエンドのunit/integration test (Vitest)                                     |
| `pnpm test:e2e`         | E2Eテスト (Playwright)                                                             |
| `pnpm check:migrations` | migrationファイルの適用検証                                                        |
| `pnpm check:release`    | リリース前のバージョン整合性・未確定情報チェック(`--strict`で正式タグ用の厳格判定) |
| `pnpm rust:fmt:check`   | Rust fmtチェック                                                                   |
| `pnpm rust:clippy`      | Rust clippy (警告をエラー扱い)                                                     |
| `pnpm rust:test`        | Rustのテスト                                                                       |
| `pnpm tauri build`      | 本番ビルド                                                                         |

## ドキュメント

- [`CLAUDE.md`](CLAUDE.md) — 開発AIへの絶対ルール
- [`docs/00_PRODUCT_SPEC.md`](docs/00_PRODUCT_SPEC.md) — 商品仕様
- [`docs/01_REPOSITORY_STRUCTURE.md`](docs/01_REPOSITORY_STRUCTURE.md) — リポジトリ構成
- [`docs/02_DEVELOPMENT_PHASES.md`](docs/02_DEVELOPMENT_PHASES.md) — 開発段階
- [`docs/04_ACCEPTANCE_CHECKLIST.md`](docs/04_ACCEPTANCE_CHECKLIST.md) — 販売可能判定チェックリスト
- [`docs/RELEASE_GATES.md`](docs/RELEASE_GATES.md) — 正式販売化の優先度・リリースゲート
- [`docs/RELEASE_PROCESS.md`](docs/RELEASE_PROCESS.md) — リリース手順
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — DBスキーマと金額計算仕様
- [`docs/SECURITY.md`](docs/SECURITY.md) — セキュリティ方針
- [`docs/MANUAL_STEPS.md`](docs/MANUAL_STEPS.md) — 人間だけが行う作業一覧
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
