# MANUAL_STEPS — 人間だけが行える作業

コードで自動化できない、または意図的に自動化しない作業をここに集約する。開発AIはこの一覧にある作業を勝手に実行しない。

発売直前に人間が上から実施する順は [`docs/HUMAN_RELEASE_CHECKLIST.md`](HUMAN_RELEASE_CHECKLIST.md) を正とする。

リリース判定の証跡は [`docs/RELEASE_EVIDENCE.md`](RELEASE_EVIDENCE.md) に、自動確認と人間確認を分けて記録する。販売上の対応OSは [`docs/SUPPORTED_PLATFORMS.md`](SUPPORTED_PLATFORMS.md) を正本とする。

## 進め方

- [ ] 未着手
- [x] 完了

各項目は関連するPhaseと合わせて記載する。

---

## Phase 0

- [ ] なし(現時点で人間専用の作業はない)

## Phase 2 (帳票・PDF)

- [ ] macOS・Windows実機で日本語フォントのPDF出力を目視確認する
- [ ] 実機で以下を目視確認する(正式販売化 実装指示書PR-4「必須確認」より、コードからは検証できない項目)
  - A4単ページおよび2〜10ページの明細で、table headerの繰り返し・行の途中分割なし・合計欄がページ内に収まることの確認。手順と結果欄は `docs/PDF_VISUAL_TEST_CHECKLIST.md`（ケースA〜M）
  - 長い会社名・住所・備考でのレイアウト崩れがないことの確認(CSS側に`overflow-wrap: break-word`・`break-inside: avoid`を追加済みだが実際の印刷エンジンでの見た目は未確認)
  - OS印刷倍率100%でのPDF保存後の文字欠けがないことの確認
  - 大きな金額・0円・割引・複数税率・日本語英数字記号混在は同チェックリストの I〜M
  - 会社ロゴの表示(現時点でロゴアップロードUI自体が未実装のため、印刷レイアウトにもロゴ表示は未実装。実装時はこの項目を要更新)

## Phase 3 (AI連携)

- [ ] Linux版を配布する場合、対象環境にD-Busセッションバス+Secret Service準拠のキーリング(GNOME Keyring/KWalletなど)が起動していることを起動時に確認するか、案内文をREADMEへ追加する(macOS/WindowsはOS標準の資格情報ストアを使うため対象外。開発コンテナ内ではD-Bus不在のためAPIキー保存が失敗することを`gnome-keyring`導入とD-Bus手動起動で検証済み)
- [ ] 実際のAnthropic APIキーを用いた「接続を確認」ボタンの動作を、契約者本人の環境で最終確認する(本開発では自動テストとモック応答のみで検証)

## Phase 4 (商品化)

- [ ] 初心者5人への操作テストを手配し、観察記録を取る(手順は`docs/02_DEVELOPMENT_PHASES.md`のPhase4「ユーザビリティ試験」を参照)
- [ ] `docs/DEMO_VIDEO_SCRIPT.md`の台本をもとに、5分操作紹介動画を実際に収録する
- [ ] macOS・Windows実機で、バックアップ作成→復元(アプリ再起動を含む)が正しく動作することを確認する(本開発ではLinux上のサンドボックス環境でのunit testのみ確認。実機・実際の書き込み負荷下での検証は未実施。バックアップ方式はVACUUM INTOベースへ変更済み、`docs/01_REPOSITORY_STRUCTURE.md`8節・ADR参照)
- [ ] 実機で「作成→アプリ終了→データ変更→復元→再起動→元の状態」を最低10回連続で行い、失敗・欠損がないことを確認する(正式販売化 実装指示書PR-2の受け入れ条件)
- [ ] 1000顧客・5000価格項目・10000書類相当の大量データでバックアップ作成・復元の所要時間と成功を確認する。開発用に `pnpm seed:stress` がある（本番アプリからは実行できない。`MITSUMORI_ALLOW_STRESS_SEED=1` が必要）。ci プロファイルでの起動・一覧・検索・見積作成は自動テスト済み。結果は「高速」などの宣伝には使わない
- [ ] 容量不足・書き込み権限なしのフォルダでのバックアップ作成が、クラッシュせず分かりやすいエラーになることを実機で確認する。自動テスト済み: 空バックアップ、巨大ファイルサイズ上限、未来スキーマ、保存先ディレクトリ不在、書き込み権限なし（unix）、壊れた SQLite、エンジンコード（`SQLITE_BUSY` 等）をユーザー向け文言へ置換すること
- [ ] **ディスク容量不足（実OS）**: 空き容量をほぼゼロにしたボリュームへバックアップし、「ディスクの空き容量を確認してください」系の日本語メッセージになること。`SQLITE_FULL` が画面に出ないこと
- [ ] **保存先消失（実OS）**: バックアップまたは外部書き出しの途中で外付けディスクを抜く。アプリがクラッシュせず、再操作できること

## Phase 5 (配布・更新)

- [ ] Apple Developer Programへ登録し、Developer ID Application証明書を取得する
- [ ] macOSコード署名・公証用の秘密情報(証明書、App用パスワード、Team ID)を取得する
- [ ] Windowsコード署名証明書(EV推奨)を取得する
- [ ] 取得した証明書・秘密情報をGitHub Secretsへ登録する。登録先の値は`.github/workflows/release.yml`が参照する以下の名前を使う。
  - `APPLE_CERTIFICATE` / `APPLE_CERTIFICATE_PASSWORD` / `APPLE_SIGNING_IDENTITY`
  - `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID`
  - `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- [ ] Tauri Updater用の署名鍵ペアを`pnpm tauri signer generate -w ~/.tauri/mitsumori-desk.key`等で生成し、秘密鍵をリポジトリに含めず安全に保管する(公開鍵は`tauri.conf.json`の`plugins.updater.pubkey`へ設定する)
- [ ] 更新ファイル(`latest.json`)の配置先(ダウンロード提供先)を決定し、`tauri.conf.json`の`plugins.updater.endpoints`へ設定する
- [ ] 上記が揃ったら`tauri-plugin-updater`をCargo依存へ追加し、`src/infrastructure/updates/`に実装(例: `TauriUpdateCheck`)を追加して`notConfiguredUpdateCheck`を差し替える(境界はADR 0008を参照。設計上、置き換えは小さな変更で済むはず)
- [ ] GitHub Releaseのdraftを確認し、内容に問題なければ本番公開する(公開はCIでは自動化しない)

## Phase 6 (販売)

- [ ] `LICENSE`の権利者名と正式なライセンス文言を確定する(現状は暫定の全著作権留保表記)
- [ ] 販売者情報・特定商取引法に基づく表示を確定する。確定したら`src-tauri/tauri.conf.json`の`bundle.publisher`・`bundle.copyright`(キー自体は用意済み、値は空文字)にも反映する
- [ ] `docs/TERMS_OF_SERVICE_DRAFT.md`・`docs/DISCLAIMER_DRAFT.md`(いずれも下書き)を弁護士等の専門家によるレビューを経て確定し、`[ ]`のプレースホルダーを埋める。確定後はファイル名から`_DRAFT`を外し、購入者へ提示する
- [ ] 上記3項目が揃ったら`pnpm check:release -- --strict`を実行し、未確定情報の検出がゼロになることを確認する(`docs/RELEASE_GATES.md`参照)
- [ ] `src-tauri/tauri.conf.json`の`bundle.macOS.minimumSystemVersion`(現在はTauriの一般的な既定値である`10.13`を暫定設定)を、実機確認結果を踏まえて必要なら調整する
- [ ] お問い合わせ窓口(連絡方法)を確定し、`docs/USER_MANUAL.md`「5. お困りの際は」および`src/features/help/HelpPage.tsx`・`README.md`の `support-contact: PENDING` を `CONFIRMED` へ更新して連絡方法を書く
- [ ] `docs/QUICK_START_GUIDE.md`・`docs/USER_MANUAL.md`を実際の同梱物(PDF化等)として整え、画面の実文言と差異がないか最終確認する
- [ ] `docs/BETA_TEST_OBSERVATION_SHEET.md`を使ってベータ利用者(5〜10人)を募集し、観察記録を取る
- [ ] 観察結果を`docs/02_DEVELOPMENT_PHASES.md`のリリース判断基準(重大な計算誤り・データ消失・復元不能・秘密情報漏えい・発行済み書類の変化が1件でもあれば正式販売しない)に照らして、正式販売の可否を判断する
- [ ] ココナラの商品ページを作成・公開する
- [ ] 有料AIサービスとの契約(購入者自身が行う運用のため、販売者としての契約は不要だが、動作確認用に一時契約する場合はここに記録する)

## 破壊的操作

- [ ] 既存データの削除を伴う操作(本番DBやリリース済みタグの削除等)は、必ず人間が確認したうえで実行する
