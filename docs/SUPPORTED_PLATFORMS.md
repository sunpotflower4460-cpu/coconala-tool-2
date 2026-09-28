# 対応OS(販売上の公式対応)

このファイルは、購入者へ「どのOSを正式に販売するか」を揃えるための正本です。
機械可読な値は [`supported-platforms.json`](supported-platforms.json) にあります。
`pnpm check:release` は、購入者向け文書がこの方針と矛盾していないかを検査します。

**人間の実機確認・署名・公証が終わるまで、この文書や販売文に「動作確認済み」「正式対応済み」と書かない。**
CIでビルドが成功することと、正式対応は別です。

## 販売予定のOS

販売者の方針は **macOS と Windows の両方**です(`plannedSale`)。配布物はココナラのトークルームへ添付する zip です。

| OS                        | 配布形式                                    | 署名                               | 手順書                                                 |
| ------------------------- | ------------------------------------------- | ---------------------------------- | ------------------------------------------------------ |
| macOS 11 以降             | dmg(Apple シリコン / Intel 共通)            | Developer ID 署名 + Apple 公証     | [`INSTALL_GUIDE_MAC.md`](INSTALL_GUIDE_MAC.md)         |
| Windows 10 / 11(64ビット) | NSIS インストーラー(日本語・管理者権限不要) | 署名なし(SmartScreen の手順を案内) | [`INSTALL_GUIDE_WINDOWS.md`](INSTALL_GUIDE_WINDOWS.md) |

## 正式対応と案内してよい時期

- **macOS**: 実機でのインストール確認・署名・公証・Gatekeeper 確認が完了したあと(`firstSale` に含まれている)。
  対応バージョンの下限は `src-tauri/tauri.conf.json` の `bundle.macOS.minimumSystemVersion`(現在は暫定値 `11.0`。WKWebView の印刷機能と Apple シリコン対応の下限)を、実機確認後に人間が確定する。
- **Windows**: 実機でのインストール・SmartScreen・PDF・バックアップ・上書き更新を販売者が確認したあと、
  `docs/supported-platforms.json` の `firstSale` に `"windows"` を追加し、`pendingDeviceVerification` から外す。
  その時点で下の「使ってはいけない表現」の Windows 分は使ってよくなる。`pnpm check:release -- --rc` は、
  `firstSale` に入れた OS の手順書とインストーラー設定が揃っているかを検査する。
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
