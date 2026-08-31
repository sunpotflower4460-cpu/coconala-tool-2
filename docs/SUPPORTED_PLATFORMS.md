# 対応OS(販売上の公式対応)

このファイルは、購入者へ「どのOSを正式に販売するか」を揃えるための正本です。
機械可読な値は [`supported-platforms.json`](supported-platforms.json) にあります。
`pnpm check:release` は、購入者向け文書がこの方針と矛盾していないかを検査します。

**人間の実機確認・署名・公証が終わるまで、この文書や販売文に「動作確認済み」「正式対応済み」と書かない。**
CIでビルドが成功することと、正式対応は別です。

## 初回販売の対象

- **macOS**(実機でのインストーラー確認・Developer ID署名・Apple公証・Gatekeeper確認が完了したあと、正式対応とする)

対応バージョンの下限は `src-tauri/tauri.conf.json` の `bundle.macOS.minimumSystemVersion`(現在は暫定値 `10.13`)を、実機確認後に人間が確定する。

## ビルドは存在するが、初回販売の対象外

- **Windows**: CIでビルドは実行する。実機確認・コード署名・SmartScreen確認が完了するまで、販売ページ・README・マニュアル・ヘルプで正式対応と案内しない。
- **Linux**: 開発・CI・E2E用。購入者へ配布しない。

## 購入者向け文書で使ってよい表現 / 使ってはいけない表現

使ってよい:

- 「初回販売の対象OSは macOS です」
- 「Windows版は実機確認が完了するまで正式対応としません」
- 「CI上のWindowsビルド成功は、正式対応を意味しません」

使ってはいけない(実機確認前):

- 「macOS / Windows向け買い切り」(両OSを同等の正式対応として読めるため)
- 「Windows正式対応」「Windows対応済み」
- 「macOS動作確認済み」「Windows確認済み」(実機確認を行っていないのに完了扱いするため)

## 関連

- [`docs/RELEASE_GATES.md`](RELEASE_GATES.md) — Windows正式版は P2(初回販売後でもよい)
- [`docs/RELEASE_EVIDENCE.md`](RELEASE_EVIDENCE.md) — 実機確認の証跡欄(人間記入)
- [`docs/MANUAL_STEPS.md`](MANUAL_STEPS.md) — 実機・署名・公証の手順
