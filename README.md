# 見積・請求書デスク (mitsumori-desk)

購入者自身が初回設定し、AIなしでも見積書・請求書・納品書・領収書を作れる、macOS / Windows向け買い切りデスクトップツールです。

- データはお使いのパソコンに保存されます(ローカルファースト)
- AIを契約しなくても基本機能が使えます
- 問い合わせ文をAIで整理できます(任意)
- 金額は必ずご自身で確認してから発行します

詳しい商品仕様は [`docs/00_PRODUCT_SPEC.md`](docs/00_PRODUCT_SPEC.md) を参照してください。

## 開発者向け情報

### 必要なもの

- Node.js 22系
- pnpm
- Rust (stable)
- Tauri 2の[各OS向け前提パッケージ](https://tauri.app/start/prerequisites/)

### セットアップ

```bash
pnpm install
```

### 開発サーバー起動

```bash
pnpm tauri dev
```

### 主要スクリプト

| コマンド              | 内容                                           |
| --------------------- | ---------------------------------------------- |
| `pnpm dev`            | Viteの開発サーバーのみ起動                     |
| `pnpm tauri dev`      | デスクトップアプリとして起動                   |
| `pnpm lint`           | ESLint                                         |
| `pnpm format:check`   | Prettierチェック                               |
| `pnpm typecheck`      | TypeScript型チェック                           |
| `pnpm test`           | フロントエンドのunit/integration test (Vitest) |
| `pnpm test:e2e`       | E2Eテスト (Playwright)                         |
| `pnpm rust:fmt:check` | Rust fmtチェック                               |
| `pnpm rust:clippy`    | Rust clippy (警告をエラー扱い)                 |
| `pnpm rust:test`      | Rustのテスト                                   |
| `pnpm tauri build`    | 本番ビルド                                     |

### ドキュメント

- [`CLAUDE.md`](CLAUDE.md) — 開発AIへの絶対ルール
- [`docs/00_PRODUCT_SPEC.md`](docs/00_PRODUCT_SPEC.md) — 商品仕様
- [`docs/01_REPOSITORY_STRUCTURE.md`](docs/01_REPOSITORY_STRUCTURE.md) — リポジトリ構成
- [`docs/02_DEVELOPMENT_PHASES.md`](docs/02_DEVELOPMENT_PHASES.md) — 開発段階
- [`docs/04_ACCEPTANCE_CHECKLIST.md`](docs/04_ACCEPTANCE_CHECKLIST.md) — 販売可能判定チェックリスト
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — DBスキーマと金額計算仕様
- [`docs/SECURITY.md`](docs/SECURITY.md) — セキュリティ方針
- [`docs/MANUAL_STEPS.md`](docs/MANUAL_STEPS.md) — 人間だけが行う作業一覧
- [`docs/ADR/`](docs/ADR/) — 技術判断の記録

## ライセンス

[LICENSE](LICENSE)を参照してください。
