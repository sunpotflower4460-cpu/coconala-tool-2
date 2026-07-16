# CLAUDE.md

## Project Mission

購入者自身が初回設定し、AIなしでも見積・請求・納品・領収書を作れるmacOS / Windows向け買い切りデスクトップツールを作る。

## Read First

1. `README.md`
2. `docs/00_PRODUCT_SPEC.md`
3. `docs/01_REPOSITORY_STRUCTURE.md`
4. `docs/02_DEVELOPMENT_PHASES.md`
5. `docs/04_ACCEPTANCE_CHECKLIST.md`

## Non-negotiable Rules

- Local-first.
- AI is optional.
- AI never finalizes price or sends documents.
- Money is stored as integer yen.
- Issued documents are immutable snapshots.
- No API keys in normal DB, localStorage, logs, diagnostics, fixtures, or commits.
- Keep Tauri capabilities minimal.
- No arbitrary shell execution.
- No schema change without a migration.
- No phase is complete until tests and docs are updated.
- Put human-only tasks in `docs/MANUAL_STEPS.md`; do code-automatable work first.
- Explain work to the owner in plain Japanese.

## Architecture Boundaries

- `domain` has no React, Tauri, SQLite, or AI SDK dependency.
- `application` orchestrates use cases through ports.
- `infrastructure` implements database, AI, export, logging, secrets.
- UI does not contain tax or total calculation rules.
- AI responses are untrusted input and must be schema-validated.

## Development Order

Follow `docs/02_DEVELOPMENT_PHASES.md`.
Do not start AI, licensing, updater, or elaborate visual design before the Phase 1 manual-estimate vertical slice works.

## Required Checks

Before reporting completion:

```bash
pnpm lint
pnpm typecheck
pnpm test
cargo fmt --check
cargo clippy -- -D warnings
cargo test
pnpm tauri build
```

Adapt command paths if required, but expose stable root scripts.

## Reporting

Report in Japanese:

1. できるようになったこと
2. 主な変更ファイル
3. テスト結果
4. 画面確認手順
5. 未完了・既知の問題
6. 次に行うこと
7. `docs/MANUAL_STEPS.md`へ追加した人間作業
