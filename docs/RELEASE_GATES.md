# RELEASE_GATES.md — 正式販売化の優先度とリリースゲート

このドキュメントは、コードが動く状態から購入者へ安全に販売できる状態へ進めるための
優先度と、タグ種別ごとの必須条件をまとめる。個々の機能仕様は
[`docs/00_PRODUCT_SPEC.md`](00_PRODUCT_SPEC.md)、開発段階は
[`docs/02_DEVELOPMENT_PHASES.md`](02_DEVELOPMENT_PHASES.md)、
販売可能判定の詳細チェック項目は [`docs/04_ACCEPTANCE_CHECKLIST.md`](04_ACCEPTANCE_CHECKLIST.md)
を参照すること。本ドキュメントはそれらの要約ではなく、「どの順番で・何が揃えばタグを切ってよいか」
という**リリースゲート**に焦点を当てる。

## 優先度

### P0 — これが終わるまで有料正式販売しない

- 実機で確認済みのインストーラー(macOS DMG。署名・公証済み)
- 日本語PDFの実機目視確認
- バックアップ・復元の実機確認
- 発行後スナップショット不変性(自動テストで担保済み、実機でも再確認)
- 金額計算(自動テストで担保済み)
- 実Anthropic APIキーでの保存・接続・削除確認
- 利用規約・免責事項・LICENSEの権利者名確定(プレースホルダー解消)
- 初心者向けベータテスト完了、販売停止条件に抵触する事象がないこと
- 問い合わせ窓口の確定

### P1 — 正式販売前に原則完了

- Tauri実アプリでのE2E確認
- UI/UXの仕上げ(ホーム導線、空状態、保存状態表示等)
- 上書きアップデートでの既存DB保持確認
- 大量データ(顧客1000件・価格項目5000件等)での動作確認
- 5分操作動画
- 診断・サポート手順の整備
- セキュリティ監査(依存関係・APIキー漏えい経路)

### P2 — 初回販売後でもよい

- 自動更新(`tauri-plugin-updater`の実導入。境界はADR 0008で先行実装済み)
- ライセンスサーバー
- Windows正式版
- 複数屋号・複数帳票デザイン・会計ソフト連携等の追加機能

## タグ種別ごとの必須条件

### RCタグ(`vX.Y.Z-rc.N`)

- 署名済みビルドが作れること(実機確認は未完了でもよい)
- β利用者限定で配布する
- GitHub Releaseはdraftで作成する
- テスト証跡(`docs/TEST_EVIDENCE_TEMPLATE.md`等、整備され次第)を添付する

### 正式タグ(`vX.Y.Z`、`-rc`を含まない)

以下がすべて揃うまで正式タグは作成しない。

- `pnpm check:release -- --strict` が通過する(プレースホルダーなし、publisher/copyright設定済み、バージョン3箇所一致、CHANGELOG記載あり)
- CIがgreen(lint / format / typecheck / migration check / unit / integration / Rust fmt・clippy・test / build)
- macOS署名・公証用のGitHub Secretsが設定済み(`docs/MANUAL_STEPS.md` Phase5)
- 利用規約・免責事項が専門家レビュー済みで`_DRAFT`が外れている
- サポート窓口が確定している
- テスト証跡・ベータサインオフが揃っている

`pnpm check:release -- --strict`(または`RELEASE_STRICT=1 pnpm check:release`)は、
現時点ではCIワークフローに自動配線していない。正式タグ用のリリースジョブを追加する際
(署名・公証・DMG作成を扱うPR、`.github/workflows/release.yml`の拡張)に、
正式タグのビルドでのみこのstrictモードを呼び出し、未確定情報が残っていればジョブを失敗させること。
`ci.yml`(通常のPR/main向けCI)では非strictモード(`pnpm check:release`)のみを実行し、
開発中に残っている下書きプレースホルダーでCI自体は落とさない。

## バージョン方針

- `package.json` / `src-tauri/Cargo.toml` / `src-tauri/tauri.conf.json` の3箇所を常に一致させる(`pnpm check:release`で機械確認)。
- 開発中は `0.x.y` を使う。
- P0項目が実機確認まで含めて揃った時点で `0.9.0-rc.1` を切り、ベータ利用者へ配布する。
- ベータの販売停止条件(`docs/02_DEVELOPMENT_PHASES.md` Phase6参照)に抵触する事象がなければ `1.0.0` として正式リリースする。
- 現時点(このドキュメント作成時点)ではまだ `0.1.0` のままであり、実機確認前に `rc` を名乗ることはしない。

## 購入者向け表示に関するルール

- バージョン情報画面のライセンス状態表示に、開発用語である `unlicensed` をそのまま出さない。買い切り商品であることが伝わる表現(例:「買い切り版(ライセンス認証不要)」)を使う。ライセンス確認自体の戻り値(`LicensePort`の`state: "unlicensed"`)は変更しない(ADR 0008)。
- 更新機能が未設定の間は、壊れているように見せず「更新は販売ページから手動で提供します」と明示する。

## 関連ドキュメント

- [`docs/MANUAL_STEPS.md`](MANUAL_STEPS.md) — 人間だけが行う作業(証明書取得・Secrets登録・法的文言確定等)
- [`docs/RELEASE_PROCESS.md`](RELEASE_PROCESS.md) — タグ作成からGitHub Release公開までの手順
- [`docs/04_ACCEPTANCE_CHECKLIST.md`](04_ACCEPTANCE_CHECKLIST.md) — 機能・データ安全性・セキュリティの詳細チェックリスト
- [`docs/ADR/0008-license-and-update-boundaries.md`](ADR/0008-license-and-update-boundaries.md) — ライセンス・更新確認の設計境界
