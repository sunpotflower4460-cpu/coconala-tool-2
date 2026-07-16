# 0007 — 複数SQL文にまたがる書き込みは専用コネクションで原子性を保証する

## ステータス

採用(Phase 4)

## コンテキスト

Phase 1〜3では、複数のSQL文にまたがる書き込み(書類+明細の作成、発行時のステータス更新+履歴記録など)を、`tauri-plugin-sql`経由でJSから個別に`db.execute("BEGIN")` → `db.execute(INSERT...)` を複数回 → `db.execute("COMMIT")` と送る実装にしていた。

Phase 4で練習モードのデータ作成・削除を実装した際、実機(Xvfb)確認で以下のエラーが実際に発生することを確認した。

```
error returned from database: (code: 1) cannot commit - no transaction is active
```

原因を`tauri-plugin-sql`(v2.4.0)のソースを確認して特定した。同プラグインは`sqlx::Pool<Sqlite>`(既定で最大10コネクションのプール)を保持し、JSからの`execute`/`select`呼び出しごとに`pool.execute(...)`/`pool.fetch_all(...)`を呼ぶ。これはsqlxの`Executor`トレイトの挙動であり、呼び出しのたびにプールから空いているコネクションを1本取得し、実行後に返却する。**同じJSの`execute`呼び出し列でも、どのコネクションが割り当てられるかは保証されない。**

SQLiteの`BEGIN`/`COMMIT`はコネクションローカルな状態であるため、`BEGIN`を実行したコネクションと異なるコネクションで`COMMIT`が実行されると、上記のエラーになる。逆に、`BEGIN`は成功したがそのコネクションで二度と`COMMIT`が呼ばれない場合、そのコネクションはプールへ返却されても未コミットのトランザクションを抱えたままになり、後続の無関係な操作がそのトランザクション内に巻き込まれる可能性がある。

低頻度・逐次実行のテスト環境(better-sqlite3を使う単体/結合テスト)ではコネクションが1本しかないためこの問題は再現せず、実機の複数コネクションプールでのみ顕在化した。これはテストだけでは検出できないクラスの不具合であり、実機確認が必須である理由の実例になった。

## 決定

複数文にまたがる真のトランザクションが必要な書き込みは、JSから個別に`BEGIN`/`COMMIT`を送る方式をやめ、**専用のRustコマンド`execute_transaction`(`src-tauri/src/commands/transaction.rs`)を新設し、1回のTauri IPC呼び出しの中で`rusqlite`の単一コネクションを開いてトランザクションを完結させる**方式に統一した。

- `DatabasePort`に`executeTransaction(statements: TransactionStatement[])`を追加。
- 直前の文のINSERTで採番されたIDを後続の文のパラメータとして使いたい場合は、`{"$ref": <直前までの結果のインデックス>}`という参照値を使う(例: 新規作成した書類のidを明細INSERTのdocument_idとして使う)。
- 影響を受けた既存コマンド(`save-estimate-draft`, `issue-document`, `convert-document`, `duplicate-document`, `update-document-status`, `delete-practice-data`)をすべて`executeTransaction`ベースへ書き換えた。
- 新しいRustコネクションは`tauri-plugin-sql`のコネクションと同じファイルを開くため、ロック競合に備えて`busy_timeout`を設定し、`PRAGMA foreign_keys = ON`を明示的に有効化している。
- テスト用の`createTestDatabase`(better-sqlite3)にも同じ`executeTransaction`/`$ref`セマンティクスを実装し、`db.transaction()`による実際のロールバック検証を単体テストで行えるようにした(`tests/integration/database/execute-transaction.test.ts`)。

会話の記録・変換先IDのようにトランザクション完了後でなければ値が確定しない付随的な記録(例: 変換元の書類に残す「変換先の書類ID」イベント)は、原子性が必須ではないため、`executeTransaction`完了後の単発`execute`として追記している。

## 影響

- `db.execute("BEGIN"/"COMMIT"/"ROLLBACK")`をアプリケーションコードから送ることは禁止とする。複数文の原子性が必要な場合は必ず`executeTransaction`を使う。
- `execute_transaction`はRust側で`rusqlite`(`bundled`機能、システムのsqlite3に依存しない)を新たに依存に追加した。バックアップ機能(`commands/backup.rs`)の内容検証にも同じ依存を利用している。
- 今後、複数文の書き込みを新設する場合は、単発の`db.execute`を連ねるのではなく、最初から`executeTransaction`を使うこと。
