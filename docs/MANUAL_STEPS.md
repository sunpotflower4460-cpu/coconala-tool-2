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
  - 会社ロゴの表示(`PDF_VISUAL_TEST_CHECKLIST.md` の N・O)

## Phase 3 (AI連携)

- [ ] Linux版を配布する場合、対象環境にD-Busセッションバス+Secret Service準拠のキーリング(GNOME Keyring/KWalletなど)が起動していることを起動時に確認するか、案内文をREADMEへ追加する(macOS/WindowsはOS標準の資格情報ストアを使うため対象外。開発コンテナ内ではD-Bus不在のためAPIキー保存が失敗することを`gnome-keyring`導入とD-Bus手動起動で検証済み)
- [ ] 実際のAnthropic APIキーを用いた「接続を確認」ボタンの動作を、契約者本人の環境で最終確認する(本開発では自動テストとモック応答のみで検証)

## Phase 4 (商品化)

- [ ] 初心者5人への操作テストを手配し、観察記録を取る(手順は`docs/02_DEVELOPMENT_PHASES.md`のPhase4「ユーザビリティ試験」を参照)
- [ ] `docs/DEMO_VIDEO_SCRIPT.md`の台本をもとに、5分操作紹介動画を実際に収録する
- [ ] macOS・Windows実機で、バックアップ作成→復元(アプリ再起動を含む)が正しく動作することを確認する(本開発ではLinux上のサンドボックス環境でのunit testのみ確認。実機・実際の書き込み負荷下での検証は未実施。バックアップ方式はVACUUM INTOベースへ変更済み、`docs/01_REPOSITORY_STRUCTURE.md`8節・ADR参照)
- [ ] 実機で「作成→アプリ終了→データ変更→復元→再起動→元の状態」を最低10回連続で行い、失敗・欠損がないことを確認する(正式販売化 実装指示書PR-2の受け入れ条件)
- [ ] 1000顧客・5000価格項目・10000書類相当の大量データでバックアップ作成・復元の所要時間と成功を確認する。開発用に `pnpm seed:stress`(full) / `pnpm seed:stress:ci` がある（本番アプリからは実行できない。launcher が開発用フラグを付ける。本番データパスへの書き込みと既存ファイル上書きは拒否）。ci プロファイルの生成・SQLx migration 互換・一覧・検索・見積作成は自動テスト済み。full プロファイルの実アプリ操作とバックアップ所要時間は人間確認。結果は「高速」などの宣伝には使わない
- [ ] 容量不足・書き込み権限なしのフォルダでのバックアップ作成が、クラッシュせず分かりやすいエラーになることを実機で確認する。自動テスト済み: 空バックアップ、外部importの巨大ファイルを開く前に拒否、自分で作ったbackupはサイズだけでは拒否しない、未来スキーマ、保存先ディレクトリ不在、書き込み権限なし（unix）、壊れた SQLite、`ErrorKind` / SQLite error code / raw OS code による分類（英語OSメッセージ文字列には依存しない）
- [ ] **ディスク容量不足（実OS）**: 空き容量をほぼゼロにしたボリュームへバックアップし、「ディスクの空き容量が不足しています。」になること。`SQLITE_FULL` や英語の OS メッセージが画面に出ないこと
- [ ] SQLx互換の stress DB を実TauriアプリのDBとして開く確認。checksum照合とテーブル形状は自動テスト済み。実アプリ起動そのものは人間確認
- [ ] **保存先消失（実OS）**: バックアップまたは外部書き出しの途中で外付けディスクを抜く。アプリがクラッシュせず、再操作できること

## Phase 5 (配布・署名) — Phase 7 で方針を更新

自動更新は行わない(新しい版はココナラのメッセージで配布する。ADR 0008 改訂)。そのため Tauri Updater の鍵・`latest.json` の配置先は不要になった。
Windows は署名なしで配布する(オーナー決定。SmartScreen の手順を `docs/INSTALL_GUIDE_WINDOWS.md` で案内)。

- [ ] Apple Developer Program(登録済み)で **Developer ID Application** 証明書を作る(App Store 用の証明書とは別)。手順の目安:
  1. Mac の「キーチェーンアクセス」→「証明書アシスタント」→「認証局に証明書を要求」で CSR を作る
  2. developer.apple.com → Certificates → 「+」→ **Developer ID Application** を選び、CSR をアップロードしてダウンロード・ダブルクリックで登録
  3. キーチェーンアクセスで証明書(と秘密鍵)を選び、`.p12` 形式で書き出す(パスワードを付ける)
  4. `base64 -i 証明書.p12 | pbcopy` で base64 文字列にする
- [ ] appleid.apple.com で **App 用パスワード** を作る(公証に使う)。Team ID は developer.apple.com の Membership で確認する
- [ ] GitHub の Settings → Secrets and variables → Actions に次を登録する(`installers.yml` / `release.yml` が参照する)
  - `APPLE_CERTIFICATE`(手順4の base64) / `APPLE_CERTIFICATE_PASSWORD`(.p12 のパスワード)
  - `APPLE_SIGNING_IDENTITY`(例: `Developer ID Application: 氏名または屋号 (TEAMID)`)
  - `APPLE_ID`(Apple ID のメール) / `APPLE_PASSWORD`(App 用パスワード) / `APPLE_TEAM_ID`
- [ ] Actions で「Installers (ココナラ納品物)」を実行し、Mac の zip 名に `-unsigned` が付かないこと、ジョブの「署名・公証の確認」が成功することを確かめる
- [ ] (任意・将来)Windows のコード署名証明書を買う場合は、`tauri.windows.conf.json` に署名設定を足す(今は不要)
- [ ] GitHub Releaseのdraftを確認し、内容に問題なければ本番公開する(公開はCIでは自動化しない)

## Phase 6 (販売)

- [ ] `LICENSE`の権利者名と正式なライセンス文言を確定する(現状は暫定の全著作権留保表記)
- [ ] 販売者情報・特定商取引法に基づく表示を確定する(ココナラ上の表示が必要かどうかも含めて確認)。確定したら`src-tauri/tauri.conf.json`の`bundle.publisher`・`bundle.copyright`(値は空文字)にも反映する
- [ ] `docs/TERMS_OF_SERVICE_DRAFT.md`・`docs/DISCLAIMER_DRAFT.md`(いずれも下書き)を弁護士等の専門家によるレビューを経て確定し、`[ ]`のプレースホルダーを埋める(利用台数・返金条件・対応OS・準拠法・管轄)。確定後はファイル名から`_DRAFT`を外す(納品PDFの「下書き」表示も自動で消える)
- [ ] 上記が揃ったら`pnpm check:release -- --strict`を実行し、未確定情報の検出がゼロになることを確認する(`docs/RELEASE_GATES.md`参照)
- [ ] `src-tauri/tauri.conf.json`の`bundle.macOS.minimumSystemVersion`(現在は印刷機能の要件から`11.0`を暫定設定)を、実機確認結果を踏まえて必要なら調整する
- [x] お問い合わせ窓口を確定する → ココナラのトークルーム/ダイレクトメッセージ(ココナラの規約上、外部の連絡先は使わない)。README・マニュアル・ヘルプを `support-contact: CONFIRMED` に更新済み
- [ ] 納品 zip の中の PDF(はじめにお読みください・クイックスタート・マニュアル)を開き、画面の実際の文言と差がないか最終確認する
- [ ] `docs/BETA_TEST_OBSERVATION_SHEET.md`を使ってベータ利用者(5〜10人)を募集し、観察記録を取る
- [ ] 観察結果を`docs/02_DEVELOPMENT_PHASES.md`のリリース判断基準(重大な計算誤り・データ消失・復元不能・秘密情報漏えい・発行済み書類の変化が1件でもあれば正式販売しない)に照らして、正式販売の可否を判断する
- [ ] 販売価格と返金条件を決める
- [ ] 商品画像を作る(`tests/e2e-tauri` のスクリーンショットではなく、Mac/Windows 実機の画面で)。5分操作動画を収録する(`docs/DEMO_VIDEO_SCRIPT.md`)
- [ ] ココナラの最新の規約(外部連絡先・クラウドストレージ・添付サイズ)を確認し、`docs/COCONALA_LISTING.md` をもとに商品ページを作成・公開する
- [ ] 有料AIサービスとの契約(購入者自身が行う運用のため、販売者としての契約は不要だが、動作確認用に一時契約する場合はここに記録する)

## Phase 7 (ココナラ納品物)

- [ ] **本番のライセンス鍵を作る**: `pnpm license:keygen` を実行し、表示された公開鍵で `src-tauri/license/public_key.b64` を置き換えてコミットする。秘密鍵(`~/.mitsumori-desk-license/private.pem`)は USB メモリ等にもバックアップする(失くすとキーを発行できない)。開発用の鍵のままだと `--strict` が失敗する
- [ ] 本番鍵で `pnpm license:issue --id TEST-0001` を発行し、Mac / Windows の実機アプリで登録できること、改ざんしたキー(1文字変える)が拒否されることを確かめる
- [ ] 実機で、ライセンス未登録のときに印刷・PDFへ「未認証版」が入り、登録後に消えることを確認する(`PDF_VISUAL_TEST_CHECKLIST.md` の P)
- [ ] 納品 zip をトークルームに実際に添付できること(サイズ・拡張子)を、テスト用の取引またはココナラのヘルプで確認する
- [ ] Windows の実機確認が終わったら、`docs/supported-platforms.json` の `firstSale` に `"windows"` を追加し、`pendingDeviceVerification` から外す。README・マニュアル・出品文の「Windows版は実機確認が完了するまで正式対応としません」を外し、`pnpm check:release -- --rc` が通ることを確認する
- [ ] macOS / Windows のビルドは GitHub Actions でしか確認できない。このブランチの変更を main へ入れる前に、CI(`ci.yml` の build ジョブ)と `installers.yml` を一度実行し、成功を確認する(開発セッションからはワークフローを起動する権限がなかった)

## 本番故障の実機確認

自動テストでは再現しきれない、購入者PC上の故障モード。詳細な期待結果は
[`docs/PRODUCTION_FAILURE_RISKS.md`](PRODUCTION_FAILURE_RISKS.md) を正とする。

- [ ] **AUTH-05**: 資格情報ストアが使えない環境(Linuxで Secret Service 未起動、または Keychain 権限拒否)で APIキー保存が失敗し、見積・発行はAIなしで続けられる
- [ ] **COMMS-05 / COMMS-06**: 飛行機モードおよび不正なプロキシ証明書で、問い合わせ抽出が「通信に失敗」になり、手動見積へ進める。送信前確認をキャンセルするとリクエストが飛ばない
- [ ] **CONC-08**: アプリをもう一度起動すると、既に開いているウィンドウが前面に出るだけで、2つ目は起動しない(macOS / Windows。単一インスタンス化済み)
- [ ] **CONC-07**: 見積保存の最中にバックアップ作成。成功するか、分かりやすい失敗かのいずれか。現行DBが壊れない
- [ ] **USER-09**: 日本語IME変換確定前に Cmd/Ctrl+Enter 相当を押しても、意図しない発行が走らない
- [ ] **EXT-04 / EXT-08**: ディスク満杯・外付け切断・印刷エンジンは既存の Phase 4 / Phase 2 項目と重複。本カタログの期待結果(日本語エラー、不完全ファイルを残さない、帳票目視)を満たすこと

## 破壊的操作

- [ ] 既存データの削除を伴う操作(本番DBやリリース済みタグの削除等)は、必ず人間が確認したうえで実行する
