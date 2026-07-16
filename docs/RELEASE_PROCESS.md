# RELEASE_PROCESS.md (skeleton)

Phase 5で肉付けする。現時点では手順の骨格のみを記す。

## バージョニング

- `package.json` / `src-tauri/Cargo.toml` / `src-tauri/tauri.conf.json`のバージョンを一致させる。
- [Semantic Versioning](https://semver.org/)に従う(`MAJOR.MINOR.PATCH`)。

## リリース手順(将来像)

1. `main`ブランチが緑(CI全通過)であることを確認する
2. バージョン番号を更新し、`CHANGELOG.md`を更新する
3. `vX.Y.Z`タグを作成しプッシュする
4. `.github/workflows/release.yml`がmacOS/Windows向けビルドを実行し、GitHub Releaseをdraftとして作成する
5. 署名・公証が正しく行われたか実機で確認する(`docs/MANUAL_STEPS.md`)
6. `scripts/verify-release.mjs`(Phase 5で実装)で成果物ハッシュ・署名を検証する
7. 問題がなければ人間がGitHub Releaseを本番公開する
8. 自動更新用`latest.json`が正しいバージョン・署名を指しているか確認する

## ロールバック方針

- 更新に失敗した場合、旧バージョンが起動できることを確認してから公開する。
- 重大な不具合が判明した場合、`latest.json`を1つ前の安定版へ戻し、新しいdraftで再修正版を準備する。

## 未確定事項

- コード署名・公証の具体的な自動化範囲はPhase 5で確定する。
- 自動更新サーバー(配布先)はPhase 5で決定し、`docs/MANUAL_STEPS.md`へ追記する。
