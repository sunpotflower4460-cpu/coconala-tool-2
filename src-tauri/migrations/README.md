# migrations

DBスキーマ変更は、この番号付きSQLファイルへの追加でのみ行う。既存ファイルの内容は変更しない。

- ファイル名は `NNNN_short_description.sql` の形式にする
- `src-tauri/src/lib.rs` の `Migration` 一覧へ同じ順序で追加する
- `PRAGMA foreign_keys = ON`はsqlx(SQLite接続ライブラリ)が既定で有効化するため、各migrationで個別に設定する必要はない
- 破壊的な変更(列削除・型変更)を行う場合は、既存データを保持する移行SQLを併記する
