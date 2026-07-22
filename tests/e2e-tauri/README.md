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
Node標準の`node --test`ランナーで実行する。テストは`webdriverio`(`tests/e2e-tauri/helpers/app-session.mjs`)で
実際のウィンドウを操作する。

## 現在自動化しているシナリオ

`scenarios/onboarding-and-persistence.test.mjs`:

1. 初回設定(会社情報・税設定・顧客登録・価格表登録・練習見積作成)を最初から最後まで実施し、
   練習見積の編集画面に選択した顧客・商品・税計算結果(小計/消費税/合計)が正しく表示されることを確認する
2. アプリを終了して再起動し(新しいWebDriverセッション=新しいアプリプロセス)、
   初回設定完了状態と、作成した見積が見積書一覧に残っていることを確認する

これは「正式販売化 実装指示書」PR-3の自動E2Eシナリオ一覧のうち、1(初回設定)・2(顧客作成)・
3(価格項目作成)・4(見積下書き)・5(再起動後再表示)に相当する。

## 未実施(このリポジトリでは自動化していない、または実機のみ確認可能)

- 見積発行・請求書/納品書/領収書への変換・状態遷移・発行済み見積の不変性検証(6〜12)
- CSV取り込み、練習データ作成・削除、診断ファイル出力、バックアップ・復元(13〜16)
  — これらは`tests/unit`・`tests/integration`のRust/Vitestテストでロジックとしては検証済みだが、
  実際の画面操作を通したE2Eとしては未実施
- OS標準印刷ダイアログ・PDF保存・複数ページ・日本語フォント・ロゴ・Keychain・DMGインストール・
  公証確認・上書き更新は、実機での目視・手動確認が前提であり自動化していない(`docs/MANUAL_STEPS.md`参照)

このファイルの範囲を広げる際は、`docs/MANUAL_STEPS.md`・`docs/RELEASE_GATES.md`の記載も
実施状況に合わせて更新すること。
