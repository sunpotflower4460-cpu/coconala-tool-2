# RELEASE_EVIDENCE.md — リリース証跡

このファイルは、あるビルドを販売してよいかを判断するための証跡欄です。
**自動で確認できること**と**人間だけが確認できること**を混ぜない。

記入ルール:

- 自動確認欄には、実行したコマンド・日時・git SHA・結果(成功/失敗)だけを書く。
- 人間確認欄は、実機または実キーを使った担当者が自分でチェックする。
- 未実施の項目を「確認済み」と書かない。
- このファイルを埋めただけでは `pnpm check:release -- --strict` は通過しない。規約・権利者名・サポート窓口の確定は別作業である。

対象バージョン: (記入例 `0.9.0-rc.1`。現時点のコードバージョンは `package.json` を正とする)
対象コミット SHA: (記入)
記録日: (記入)
記録者: (記入)

---

## A. 自動確認(コマンド・CI)

GitHub Actionsやローカルコマンドの結果だけを書く。成功した事実と、人間の実機確認を混同しない。

| 項目                            | 確認方法                                                                             | 結果   | 記録                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------ |
| バージョン一致                  | `pnpm check:release`(package.json / Cargo.toml / tauri.conf.json)                    | 未記録 | SHA / 日時                                                               |
| リリースゲート(RC)              | `pnpm check:release -- --rc`                                                         | 未記録 |                                                                          |
| リリースゲート(正式)            | `pnpm check:release -- --strict`                                                     | 未記録 | 正式タグ前のみ。現時点でプレースホルダーが残っていれば失敗するのが正しい |
| Frontend lint                   | `pnpm lint`                                                                          | 未記録 |                                                                          |
| Frontend format                 | `pnpm format:check`                                                                  | 未記録 |                                                                          |
| Frontend typecheck              | `pnpm typecheck`                                                                     | 未記録 |                                                                          |
| Migration check                 | `pnpm check:migrations`                                                              | 未記録 |                                                                          |
| Frontend test                   | `pnpm test`                                                                          | 未記録 |                                                                          |
| Rust fmt                        | `cargo fmt --manifest-path src-tauri/Cargo.toml --check`                             | 未記録 |                                                                          |
| Rust clippy                     | `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`     | 未記録 |                                                                          |
| Rust test                       | `cargo test --manifest-path src-tauri/Cargo.toml`                                    | 未記録 |                                                                          |
| Frontend production build       | `pnpm build`                                                                         | 未記録 |                                                                          |
| Tauri no-bundle build           | `pnpm tauri build --no-bundle`                                                       | 未記録 | 実行したOSを併記                                                         |
| Tauri E2E                       | `pnpm test:e2e-tauri`                                                                | 未記録 | Linux上の自動E2E。macOS/Windows実機E2Eではない                           |
| Secret scan                     | `.github/workflows/security.yml` の secret-scan、および `pnpm check:release -- --rc` | 未記録 |                                                                          |
| Dependency audit                | `.github/workflows/security.yml` の `pnpm audit` / `cargo audit`                     | 未記録 | `continue-on-error` のため、失敗してもCI緑になりうる。結果本文を残す     |
| CI frontend job                 | `.github/workflows/ci.yml`                                                           | 未記録 | run URL                                                                  |
| CI rust job                     | `.github/workflows/ci.yml`                                                           | 未記録 | run URL                                                                  |
| CI build (ubuntu/macOS/windows) | `.github/workflows/ci.yml`                                                           | 未記録 | Windowsジョブ成功 ≠ Windows正式対応                                      |
| CI e2e-tauri                    | `.github/workflows/ci.yml`                                                           | 未記録 |                                                                          |

CIのURLを貼る場合は、対象SHAと一致していることを確認する。

---

## B. 人間確認(実機・実キー・目視・法務・β)

ここは GitHub Actions では絶対に「完了」と判定しない。
担当者が実機または実キーで確認した日付と環境を書く。未実施なら空欄のままにする。

| 項目                      | 確認内容                                                                | 実施日 | 環境                | 結果                   |
| ------------------------- | ----------------------------------------------------------------------- | ------ | ------------------- | ---------------------- |
| macOS実機インストール     | 対象macOSへDMGを入れて起動できる                                        |        | 機種 / OSバージョン | 未実施                 |
| macOS署名                 | Developer ID Applicationで署名されている                                |        |                     | 未実施                 |
| Apple公証                 | notarization が通っている                                               |        |                     | 未実施                 |
| Gatekeeper                | ダウンロードしたDMGを右クリックなしで開ける、または案内どおり許可できる |        |                     | 未実施                 |
| Windows実機インストール   | 初回販売対象にする場合のみ                                              |        |                     | 未実施(初回販売対象外) |
| Windows署名 / SmartScreen | 初回販売対象にする場合のみ                                              |        |                     | 未実施                 |
| 日本語PDF目視             | `docs/PDF_VISUAL_TEST_CHECKLIST.md` の全ケース                          |        |                     | 未実施                 |
| バックアップ復元          | 作成→変更→復元→再起動を10回                                             |        |                     | 未実施                 |
| 上書き更新時のDB保持      | 新バージョンを上書きインストールしても既存DBが残る                      |        |                     | 未実施                 |
| 実Anthropic API           | 本人のキーで保存・接続確認・削除                                        |        |                     | 未実施                 |
| 初心者βテスト             | 5〜10名。観察シートは `docs/BETA_TEST_OBSERVATION_SHEET.md`             |        |                     | 未実施                 |
| LICENSE権利者名           | プレースホルダー解消                                                    |        |                     | 未実施                 |
| 利用規約                  | `_DRAFT` を外し専門家レビュー済み                                       |        |                     | 未実施                 |
| 免責事項                  | `_DRAFT` を外し専門家レビュー済み                                       |        |                     | 未実施                 |
| publisher / copyright     | `tauri.conf.json` に確定値                                              |        |                     | 未実施                 |
| サポート窓口              | `support-contact: CONFIRMED` に更新                                     |        |                     | 未実施                 |

---

## C. このファイルで書いてはいけないこと

- 「macOS動作確認済み」(実機欄が空なのに本文へ書く)
- 「Windows確認済み」
- 「PDF崩れなし」(目視していない)
- 「実API接続確認済み」(実キーを使っていない)
- 「署名済み」「公証済み」
- 「初心者テスト完了」
- 自動テスト成功をもって上記を代替すること

---

## 関連

- [`docs/RELEASE_GATES.md`](RELEASE_GATES.md)
- [`docs/RELEASE_PROCESS.md`](RELEASE_PROCESS.md)
- [`docs/SUPPORTED_PLATFORMS.md`](SUPPORTED_PLATFORMS.md)
- [`docs/MANUAL_STEPS.md`](MANUAL_STEPS.md)
- [`docs/04_ACCEPTANCE_CHECKLIST.md`](04_ACCEPTANCE_CHECKLIST.md)
