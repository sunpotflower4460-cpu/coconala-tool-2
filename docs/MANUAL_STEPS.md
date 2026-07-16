# MANUAL_STEPS — 人間だけが行える作業

コードで自動化できない、または意図的に自動化しない作業をここに集約する。開発AIはこの一覧にある作業を勝手に実行しない。

## 進め方

- [ ] 未着手
- [x] 完了

各項目は関連するPhaseと合わせて記載する。

---

## Phase 0

- [ ] なし(現時点で人間専用の作業はない)

## Phase 2 (帳票・PDF)

- [ ] macOS・Windows実機で日本語フォントのPDF出力を目視確認する

## Phase 3 (AI連携)

- [ ] Linux版を配布する場合、対象環境にD-Busセッションバス+Secret Service準拠のキーリング(GNOME Keyring/KWalletなど)が起動していることを起動時に確認するか、案内文をREADMEへ追加する(macOS/WindowsはOS標準の資格情報ストアを使うため対象外。開発コンテナ内ではD-Bus不在のためAPIキー保存が失敗することを`gnome-keyring`導入とD-Bus手動起動で検証済み)
- [ ] 実際のAnthropic APIキーを用いた「接続を確認」ボタンの動作を、契約者本人の環境で最終確認する(本開発では自動テストとモック応答のみで検証)

## Phase 4 (商品化)

- [ ] 初心者5人への操作テストを手配し、観察記録を取る(手順は`docs/02_DEVELOPMENT_PHASES.md`のPhase4「ユーザビリティ試験」を参照)
- [ ] `docs/DEMO_VIDEO_SCRIPT.md`の台本をもとに、5分操作紹介動画を実際に収録する
- [ ] macOS・Windows実機で、バックアップ作成→復元(アプリ再起動を含む)が正しく動作することを確認する(本開発ではLinux実機のみで確認)

## Phase 5 (配布・更新)

- [ ] Apple Developer Programへ登録し、Developer ID Application証明書を取得する
- [ ] macOSコード署名・公証用の秘密情報(証明書、App用パスワード、Team ID)を取得する
- [ ] Windowsコード署名証明書(EV推奨)を取得する
- [ ] 取得した証明書・秘密情報をGitHub Secretsへ登録する。登録先の値は`.github/workflows/release.yml`が参照する以下の名前を使う。
  - `APPLE_CERTIFICATE` / `APPLE_CERTIFICATE_PASSWORD` / `APPLE_SIGNING_IDENTITY`
  - `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID`
  - `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- [ ] Tauri Updater用の署名鍵ペアを生成し、秘密鍵をリポジトリに含めず安全に保管する
- [ ] 更新ファイルの配置先(ダウンロード提供先)を決定する
- [ ] GitHub Releaseのdraftを確認し、内容に問題なければ本番公開する(公開はCIでは自動化しない)

## Phase 6 (販売)

- [ ] `LICENSE`の権利者名と正式なライセンス文言を確定する(現状は暫定の全著作権留保表記)
- [ ] 販売者情報・特定商取引法に基づく表示を確定する
- [ ] 利用規約・免責事項の最終法的確認を行う
- [ ] ココナラの商品ページを作成・公開する
- [ ] ベータ利用者(5〜10人)を募集する
- [ ] 有料AIサービスとの契約(購入者自身が行う運用のため、販売者としての契約は不要だが、動作確認用に一時契約する場合はここに記録する)

## 破壊的操作

- [ ] 既存データの削除を伴う操作(本番DBやリリース済みタグの削除等)は、必ず人間が確認したうえで実行する
