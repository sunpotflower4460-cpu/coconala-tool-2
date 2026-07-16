# CONTRIBUTING

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
