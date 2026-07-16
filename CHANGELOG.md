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
