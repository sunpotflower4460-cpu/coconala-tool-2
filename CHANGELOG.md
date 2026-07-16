# Changelog

このプロジェクトは[Keep a Changelog](https://keepachangelog.com/ja/1.1.0/)の形式に従います。

## [Unreleased]

### Added

- Phase 0: Tauri 2 + React + TypeScript + Viteのプロジェクト土台
- Phase 0: Lint / Format / 型チェック / Rust fmt・clippy・test / Vitest / Playwright最小構成
- Phase 0: GitHub Actions CI (frontend / rust / build)
- Phase 0: ADR 0001〜0004
- Phase 1: SQLite migration(companies/clients/catalog_items/catalog_aliases/documents/document_lines/document_events/app_settings)、外部キー制約
- Phase 1: Money・税計算(税抜税込・複数税率・値引き按分・端数処理)・書類状態・書類番号のdomain層
- Phase 1: 初回設定ウィザード、顧客CRUD、価格表CRUD、見積編集(明細追加・自動計算・下書き保存)、見積一覧
- Phase 1: unit/integration test 56件(実SQLiteエンジンによる検証を含む)
- Phase 2: 書類発行(書類番号採番、会社・顧客・計算結果のスナップショット保存、発行後の再計算禁止)
- Phase 2: 見積書→請求書/納品書、請求書→領収書への変換、書類複製、状態遷移(承認・却下・入金・取消)と履歴
- Phase 2: A4印刷専用プレビュー(OS標準印刷ダイアログでPDF保存、ADR 0005)
- Phase 2: unit/integration test 19件追加(発行後スナップショット不変性の検証を含む、計75件)
- Phase 3: 問い合わせ文からの見積明細抽出(AI照合状態の安全な再判定、実在する価格表IDのみ採用、金額はAIに一切生成させない)
- Phase 3: AI Providerの抽象化(interface, zodスキーマ検証, Anthropicアダプタ、AIなしのnull object実装)
- Phase 3: APIキーをOS資格情報ストア(macOSキーチェーン/Windows資格情報マネージャー/Linux Secret Service)へ保存するRust keyring連携、通常のDB・ログ・診断には一切含めない設計
- Phase 3: AI設定画面(有効化トグル・モデルID・APIキー登録/削除・接続確認)、問い合わせ読み取り確認画面(送信前確認ダイアログ、一致度バッジ、明細の採否選択、見積下書きへの反映)
- Phase 3: CSPで外部通信先を`https://api.anthropic.com`のみへ限定(ADR 0006)
- Phase 3: unit/integration test 24件追加(計99件)
- Phase 4: 初回案内ウィザードの仕上げ(進捗表示・各ステップの戻る・中断後の再開・税設定ステップ・練習見積作成)
- Phase 4: CSV取り込み(顧客・価格表、見本CSV、UTF-8/Shift_JIS自動判定、列マッピング、プレビュー、エラー行表示、重複時のスキップ/上書き選択、取り込み前の自動バックアップ)
- Phase 4: 練習モード(サンプル会社・顧客・価格表・見積の自動作成、練習データのみを安全に一括削除)
- Phase 4: バックアップ/復元(作成・一覧・内容検証・復元前の自動退避・復元失敗時のロールバック・スキーマバージョン表示)
- Phase 4: 診断ファイル出力(個人情報・秘密情報を含まない集計情報のみ、保存前の秘密情報検査)
- Phase 4: ヘルプ画面(画面説明・FAQ・インストール案内・サポート範囲)、5分操作動画の台本(`docs/DEMO_VIDEO_SCRIPT.md`)
- Phase 4: 複数SQL文にまたがる書き込みを真に原子的に実行する`executeTransaction`基盤(ADR 0007)
- Phase 4: unit/integration test 38件追加(計137件)
- Phase 5: バージョン情報画面(アプリバージョン・DBスキーマバージョン・動作環境・ライセンス状態・更新確認)
- Phase 5: ライセンス確認・更新確認の抽象境界(`LicensePort`/`UpdateCheckPort`)。初期販売はライセンスなし・更新確認は未設定として安全に動作し、チェック失敗が既存データの閲覧を妨げない設計(ADR 0008)
- Phase 5: JSON列によるFeature Flag基盤(`app_settings.feature_flags_json`、スキーマ変更なしでフラグを追加可能)
- Phase 5: リリース前のバージョン整合性チェック(`pnpm check:release`)、`docs/RELEASE_PROCESS.md`の具体化
- Phase 5: unit test 12件追加(計144件)

### Fixed

- `sql:default`権限にAPI実行(`execute`)が含まれておらず会社情報保存が失敗する不具合を`sql:allow-execute`権限追加で修正
- 請求書が発行後に直接入金済みへ遷移できない不具合(状態遷移表に`issued→paid`を追加)を修正
- 複数SQL文にまたがる書き込み(見積保存・発行・変換・複製・状態変更・練習データ削除)で、`tauri-plugin-sql`のコネクションプールにより手動の`BEGIN`/`COMMIT`が別コネクションに振り分けられ`cannot commit - no transaction is active`が発生し保存が失敗する不具合を、専用コネクションによる原子的なトランザクション実行(`executeTransaction`)へ置き換えて修正(ADR 0007、実機確認で発見)
