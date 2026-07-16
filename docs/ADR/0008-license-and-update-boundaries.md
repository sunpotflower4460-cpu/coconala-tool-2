# 0008 — ライセンス確認・更新確認は差し替え可能な境界だけを先に作る

## ステータス

採用(Phase 5)

## コンテキスト

`docs/02_DEVELOPMENT_PHASES.md` Phase5は「ライセンス境界の抽象化」「更新確認UI」「署名付きアップデート設定」をコードで先に行う項目として挙げている。一方、ライセンス方針は以下を明記している。

1. 販売テスト中は複雑な常時オンライン認証を避ける(ライセンスなし、または簡易な署名済みライセンスファイル)
2. 売上と不正利用リスクが確認できてから正式ライセンスサーバーを検討
3. **ライセンス障害で帳票データが開けなくなる設計は禁止**

また、署名付き自動更新(`tauri-plugin-updater`)を実際に有効化するには、人間が`tauri signer generate`で鍵ペアを生成し、更新マニフェスト(`latest.json`)を配信するホスティング先を用意する必要がある(`docs/MANUAL_STEPS.md`のPhase5項目)。これらの秘密情報・インフラをこのセッションで生成・用意することはできない。

`tauri.conf.json`に実在しないダミーの鍵・エンドポイントを書き込むと、スキーマ検証や実際のプラグイン初期化でビルドが壊れるリスクがあるため、人間が本物の値を用意するまでは`tauri-plugin-updater`本体を組み込まないことにした。

## 決定

- `LicensePort`(`src/application/ports/license.ts`)と`UpdateCheckPort`(`src/application/ports/update-check.ts`)という2つの抽象境界を新設した。
- 現時点の実装は常に安全側に倒れるnull object。
  - `noLicenseCheck`: 常に`{ state: "unlicensed" }`を返す。例外を投げない。
  - `notConfiguredUpdateCheck`: 常に`{ status: "not_configured" }`を返す。例外を投げない。
- これらのポートは**表示専用**とし、`application/commands`・`application/queries`など書類の読み書きを行う層からは一切参照しない。バージョン情報画面(`src/features/version-info/VersionInfoPage.tsx`)でのみ状態表示に使う。
- 更新確認の有効/無効はFeature Flag(`app_settings.feature_flags_json`の`updateCheckEnabled`)で切り替えられるようにしたが、既定値はOFF。人間が署名鍵・配信先を用意するまでは意味のある動作をしない。
- `tauri-plugin-updater`の実際の組み込みは、人間が鍵とエンドポイントを用意した後の別作業とする(`docs/MANUAL_STEPS.md`に記録)。その際は`TauriUpdateCheck`のような実装を追加し、`notConfiguredUpdateCheck`をDIで差し替えるだけで済むようにこの境界を設計してある。

## 影響

- 現バージョンでは、バージョン情報画面の「更新確認」は常に「未設定」を表示する。機能としては未完成だが、既存データには一切影響しない。
- ライセンスチェックも同様に常に「ライセンス管理なし」を表示する。将来ライセンスサーバーを導入する場合も、このポートの実装を差し替えるだけで済み、かつ`check()`が失敗しても書類の読み書きには影響しない設計を維持すること。
