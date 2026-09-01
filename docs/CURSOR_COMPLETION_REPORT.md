# Cursor作業完了報告

対象: `sunpotflower4460-cpu/coconala-tool-2`
コードバージョン: **0.1.0**(RC / 1.0.0 へは上げていない)
記録日: 2026-09-01
この報告は人間確認を完了扱いにしない。

最新: 販売前ハードニング [`#15`](https://github.com/sunpotflower4460-cpu/coconala-tool-2/pull/15) (`cursor/pre-sale-hardening-33c8`、base は `main`)

以前の作業(いずれも merge 済み):

| 作業                         | ブランチ                         | PR                                                              |
| ---------------------------- | -------------------------------- | --------------------------------------------------------------- |
| PR-7 リリースゲート          | `cursor/release-gate-fb96`       | https://github.com/sunpotflower4460-cpu/coconala-tool-2/pull/8  |
| PR-8 Tauri E2E拡張           | `cursor/tauri-e2e-fb96`          | https://github.com/sunpotflower4460-cpu/coconala-tool-2/pull/9  |
| PR-9 バックアップ/大量データ | `cursor/backup-stress-fb96`      | https://github.com/sunpotflower4460-cpu/coconala-tool-2/pull/10 |
| PR-10 PDF fixture            | `cursor/pdf-visual-fb96`         | https://github.com/sunpotflower4460-cpu/coconala-tool-2/pull/11 |
| PR-11 AI販売品質             | `cursor/ai-hardening-fb96`       | https://github.com/sunpotflower4460-cpu/coconala-tool-2/pull/12 |
| PR-12 ヘルプ/エラー          | `cursor/help-self-support-fb96`  | https://github.com/sunpotflower4460-cpu/coconala-tool-2/pull/13 |
| PR-13 販売パッケージ         | `cursor/coconala-packaging-fb96` | https://github.com/sunpotflower4460-cpu/coconala-tool-2/pull/14 |

独立レビュー: 同一エージェントによる実装後の再読。マージ前に別視点の Critical / Major 確認を残す。

---

## 完了(Cursorで実施済み)

- 正式タグ用 `check:release --strict` / RC用 `--rc`、release workflow のゲート、`RELEASE_EVIDENCE.md`、販売OS方針の文書揃え
- Tauri E2Eの帳票・バックアップ・CSV(Linuxで実行済み。macOS/Windows実機は未実施)
- `pnpm seed:stress`(本番パス拒否)、ci プロファイルでの一覧/検索/見積、バックアップ障害系とエンジンコードの日本語化
- PDF目視用 fixture A〜M とチェックリスト(目視そのものは未実施)
- AI 401/403/429/500/503/timeout/network/空応答/JSON破損/巨大応答/schema不一致、キー混入検査、AI任意のUI文言
- ヘルプの自己解決項目、診断情報コピー、開発用エラーの非表示
- ココナラ出品文下書き、人間専用チェックリスト
- 販売前ハードニング: SQLx互換stress DB、schema version同期、内部backupの512MiB誤拒否解消、I/O分類、stress commandのクロスプラットフォーム化

対象外とした機能追加(指示どおり未着手): 自動更新本実装、ライセンスサーバー、会計連携、新AIモデル、複数帳票デザイン、複数屋号、ダークモード、新しい分析。

---

## 自動テスト済み(この環境でコマンドを実行して成功したもの)

- `pnpm lint`
- `pnpm format:check`
- `pnpm typecheck`
- `pnpm check:migrations`(番号・lib.rs・schema version・SQLx互換テーブル)
- `pnpm check:release`(basic。strict はプレースホルダー残のため失敗するのが正しい)
- `pnpm test`(261件)
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
- `cargo test --manifest-path src-tauri/Cargo.toml`(32件)
- `pnpm build`
- `pnpm tauri build --no-bundle`
- `pnpm test:e2e-tauri`(5件。バックアップ復元を含む)
- `pnpm seed:stress:ci`(顧客100・商品200・帳票50、`_sqlx_migrations` checksum 48bytes)
- `pnpm seed:stress`(full: 顧客1000・商品5000・帳票10000。DB生成成功。実アプリでの操作は人間確認)

未実行:

- 実機での `pnpm tauri build` 署名付き成果物
- stress DBを実アプリの本番データパスとして開く確認(コマンドからは本番パスへ書けない)

---

## 未確認(実環境が必要)

- macOS / Windows 実機のUI、インストーラー、上書き更新時のDB保持
- 日本語PDFの印刷エンジン上の見た目
- バックアップ復元10回、ディスク満杯、外付け切断
- 実Anthropic API
- 大量データ full プロファイル(1000/5000/10000)の実アプリ操作(DB生成自体は自動実行済み)
- Gatekeeper / SmartScreen
- 署名・公証

---

## HUMAN REQUIRED

[`docs/HUMAN_RELEASE_CHECKLIST.md`](HUMAN_RELEASE_CHECKLIST.md) に集約。要点:

- 実MacでのDMG、署名、公証、Gatekeeper
- PDF A〜M の目視
- バックアップ10回、上書きインストール
- 実APIキー
- LICENSE / 規約 / 免責 / 特商法 / publisher / copyright / 窓口 / 価格
- 初心者β 5〜10名
- ココナラ公開、商品画像、操作動画
- Windows を初回対象にするかどうかの最終判断(現状の方針は対象外)

---

## RELEASE BLOCKERS(正式販売を止めている項目)

P0として残っているもの(コードでは埋められない):

1. macOS正式インストーラー + 署名 + 公証
2. 日本語PDF実機確認
3. バックアップ・復元実機確認
4. 実Anthropic API確認
5. LICENSE / 規約 / 免責の確定
6. サポート窓口の確定
7. 初心者ベータテスト

`pnpm check:release -- --strict` は、5と6が残っているあいだ失敗する。

---

## 推奨次ステップ(上から実施)

1. `#15` をレビューし、Critical / Major がなければ `main` へ入れる
2. CI(特に `e2e-tauri` と macOS/Windows build ジョブ)の結果を `RELEASE_EVIDENCE.md` の自動欄へ記録する
3. 権利者名・窓口・規約下書きの中身を人間が埋める(strict 通過の前提)
4. 実Macで署名・公証付きビルドを1本作り、インストール〜PDF A〜M〜バックアップ10回を実施する
5. 実APIキーで接続確認(キーはリポジトリに置かない)
6. 初心者β。販売停止条件に触れなければ RC タグを人間が切る
7. ココナラ文面・画像・動画・特商法を公開する
8. 問題がなければ `1.0.0`(人間の判断)

Windows正式対応は、初回販売後でもよい(P2)。
