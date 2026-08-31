# tests/e2e-tauri — 実Tauriアプリに対するE2Eテスト

ブラウザ環境のE2E(`tests/e2e/`, Playwright)はTauriのIPC/SQLiteに接続できないため、
「デスクトップアプリとして起動してください」という案内画面までしか検証できない
(`tests/e2e/home.spec.ts`のコメント参照)。ここでは、実際にビルドしたTauriバイナリを
[`tauri-driver`](https://github.com/tauri-apps/tauri-driver)経由でWebDriver操作し、
実際の画面遷移・SQLite書き込み・アプリ再起動後の永続化を検証する。

Linux専用(WebKitWebDriverを使うため)。CIでは`ci.yml`の`e2e-tauri`ジョブ(Ubuntu)で実行する。

## 前提ツール

- ビルド済みのアプリバイナリ(`pnpm tauri build --no-bundle`で作成される`src-tauri/target/release/mitsumori-desk`)
- `webkit2gtk-driver`(`sudo apt-get install -y webkit2gtk-driver`)
- `tauri-driver`(`cargo install tauri-driver --locked`)
- 画面表示環境(実デスクトップの`DISPLAY`、または`xvfb-run`)

## 実行方法

```bash
pnpm tauri build --no-bundle
xvfb-run --auto-servernum pnpm test:e2e-tauri
```

`tests/e2e-tauri/run.sh`が、テスト前にアプリの設定フォルダ(`~/.config/com.mitsumoridesk.desktop`)を
リセットし、`tauri-driver`を起動してから`tests/e2e-tauri/scenarios/*.test.mjs`を
Node標準の`node --test --test-concurrency=1`ランナーで**直列**実行する。
複数シナリオが同じSQLiteを共有するため、並列実行すると壊れる。

## 現在自動化しているシナリオ

番号順に実行する。

1. `01-onboarding-and-persistence.test.mjs`
   - 初回設定(会社情報・税設定・顧客登録・価格表登録・練習見積作成)と金額計算
   - アプリ再起動後に顧客・価格表・見積・会社情報・AI設定の未設定状態が残ること
2. `02-document-flow.test.mjs`
   - 見積発行、発行済み表示、会社名変更後も発行時スナップショットが変わらないこと
   - 納品書変換、請求書変換、領収書変換、変換後も元見積のスナップショットが残ること
3. `03-backup-restore.test.mjs`
   - データ作成済みの状態でバックアップ、顧客追加、復元、再起動、追加分が消えて元データが残ること
   - OSの保存ダイアログを使う外部書き出し/取り込みは自動化していない
4. `04-csv-import.test.mjs`
   - UTF-8の顧客CSVを `<input type="file">` から取り込み、一覧に反映されること
   - 列順違い・不足列・5000件などは `tests/unit/csv` と `tests/integration/database/csv-import.test.ts`

## 未実施(このリポジトリでは自動化していない、または実機のみ確認可能)

- OS標準印刷ダイアログそのもの・PDF保存ファイルの目視・複数ページ・日本語フォント・ロゴ・Keychain・DMGインストール・
  公証確認・上書き更新は、実機での目視・手動確認が前提であり自動化していない(`docs/MANUAL_STEPS.md`参照)
