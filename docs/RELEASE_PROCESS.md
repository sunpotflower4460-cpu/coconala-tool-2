# RELEASE_PROCESS.md

正式販売化の優先度・タグ種別ごとの必須条件は [`docs/RELEASE_GATES.md`](RELEASE_GATES.md) を参照。

## バージョニング

- `package.json` / `src-tauri/Cargo.toml` / `src-tauri/tauri.conf.json`のバージョンを一致させる。
- [Semantic Versioning](https://semver.org/)に従う(`MAJOR.MINOR.PATCH`)。
- `pnpm check:release`(`scripts/verify-release.mjs`)で3箇所のバージョン一致と`CHANGELOG.md`への記載を機械的に確認できる(通常CIで実行)。
- `pnpm check:release -- --strict`(または`RELEASE_STRICT=1`)を付けると、LICENSE・利用規約・免責事項のプレースホルダー、`bundle.publisher`/`bundle.copyright`の未設定も検出してエラー終了する。正式タグ(`vX.Y.Z`、`-rc`を含まない)のリリースではこのstrictモードを通過させること。

## リリース手順

1. `main`ブランチが緑(CI全通過)であることを確認する
2. バージョン番号を3箇所(`package.json` / `src-tauri/Cargo.toml` / `src-tauri/tauri.conf.json`)で更新し、`CHANGELOG.md`の`[Unreleased]`を`[X.Y.Z] - YYYY-MM-DD`へ変更して新しい`[Unreleased]`を追加する
3. `pnpm check:release`でバージョン整合性を確認する
4. `vX.Y.Z`タグを作成しプッシュする
5. `.github/workflows/release.yml`がmacOS/Windows向けビルドを実行し、GitHub Releaseをdraftとして作成する(コード署名の秘密情報が`docs/MANUAL_STEPS.md`のPhase5項目に従ってGitHub Secretsへ登録されている前提。未登録の間は署名なしビルドになる)
6. 署名・公証が正しく行われたか実機で確認する(`docs/MANUAL_STEPS.md`)
7. 自動更新(`tauri-plugin-updater`)を有効化している場合、`latest.json`が正しいバージョン・署名を指しているか確認する(ADR 0008、未導入の間はこの手順は不要)
8. 問題がなければ人間がGitHub Releaseを本番公開する

## ロールバック方針

- 更新に失敗した場合、旧バージョンが起動できることを確認してから公開する。
- 重大な不具合が判明した場合、`latest.json`を1つ前の安定版へ戻し、新しいdraftで再修正版を準備する。
- 署名鍵・更新配信先が未整備の間(ADR 0008)は自動更新自体が無効なため、この方針は署名付き更新を有効化した後にのみ適用される。

## 未確定事項

- 自動更新(`tauri-plugin-updater`)の実際の組み込みは、署名鍵生成・配信先決定後に行う(`docs/MANUAL_STEPS.md`のPhase5項目、ADR 0008)。
