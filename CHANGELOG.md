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
