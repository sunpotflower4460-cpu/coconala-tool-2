# migrations

DBスキーマ変更は、この番号付きSQLファイルへの追加でのみ行う。既存ファイルの内容は変更しない。

- ファイル名は `NNNN_short_description.sql` の形式にする
- `src-tauri/src/lib.rs` の `Migration` 一覧へ同じ順序・同じ description で追加する
- `src/domain/shared/schema-version.ts` の `CURRENT_SCHEMA_VERSION` を最新番号へ更新する(CIの `pnpm check:migrations` が不一致を落とす)
- Rust側のバックアップ用 schema ceiling は registered migrations から自動導出する
- 既存ファイルの内容は変更しない
- `PRAGMA foreign_keys = ON`はsqlx(SQLite接続ライブラリ)が既定で有効化するため、各migrationで個別に設定する必要はない
- 破壊的な変更(列削除・型変更)を行う場合は、既存データを保持する移行SQLを併記する
