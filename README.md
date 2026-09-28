# 見積・請求書デスク (mitsumori-desk)

購入者自身が初回設定し、AIなしでも見積書・請求書・納品書・領収書を作れる買い切りデスクトップツールです。

<!-- support-contact: CONFIRMED -->

- データはお使いのパソコンに保存されます(ローカルファースト)
- AIを契約しなくても基本機能が使えます
- 問い合わせ文をAIで整理できます(任意)
- 金額は必ずご自身で確認してから発行します
- 買い切り(サブスクリプションなし)。オフラインのライセンスキーで認証します(未登録でもデータは使えます)
- 更新版はココナラのメッセージで配布します(自動更新はありません)

## 対応OS

販売予定のOSは **macOS(11以降)** と **Windows(10 / 11)** です。ココナラのトークルームへ、インストーラーと説明書PDFをまとめた zip を添付して納品します。

- macOS: Developer ID 署名・Apple 公証済みの dmg([`docs/INSTALL_GUIDE_MAC.md`](docs/INSTALL_GUIDE_MAC.md))
- Windows: 署名なしの日本語インストーラー。SmartScreen の手順を案内します([`docs/INSTALL_GUIDE_WINDOWS.md`](docs/INSTALL_GUIDE_WINDOWS.md))

実機でのインストール確認・署名・公証が完了するまでは、販売可能な完成品ではありません。Windows版は実機確認が完了するまで正式対応としません。
詳細は [`docs/SUPPORTED_PLATFORMS.md`](docs/SUPPORTED_PLATFORMS.md) を参照してください。

詳しい商品仕様は [`docs/00_PRODUCT_SPEC.md`](docs/00_PRODUCT_SPEC.md) を、
インストール・初回設定・操作方法は [`docs/QUICK_START_GUIDE.md`](docs/QUICK_START_GUIDE.md) と
[`docs/USER_MANUAL.md`](docs/USER_MANUAL.md) を参照してください。

## サポート・お問い合わせ

サポート範囲は [`docs/USER_MANUAL.md`](docs/USER_MANUAL.md) の「5. お困りの際は」および
[`docs/TERMS_OF_SERVICE_DRAFT.md`](docs/TERMS_OF_SERVICE_DRAFT.md) 第5条(サポート範囲)を参照してください。
お問い合わせは、ご購入時のココナラのトークルーム(取引完了後はココナラのダイレクトメッセージ)で受け付けます。
ココナラの規約により、メールなど外部の連絡先は使いません。販売者向けの対応手順は [`docs/SUPPORT_PLAYBOOK.md`](docs/SUPPORT_PLAYBOOK.md) にあります。

## 利用規約・免責事項・ライセンス

- [LICENSE](LICENSE)
- [`docs/TERMS_OF_SERVICE_DRAFT.md`](docs/TERMS_OF_SERVICE_DRAFT.md)(下書き・専門家レビュー前)
- [`docs/DISCLAIMER_DRAFT.md`](docs/DISCLAIMER_DRAFT.md)(下書き・専門家レビュー前)

## 販売者向け(納品物の作り方)

- 納品zip: GitHub Actions の「Installers (ココナラ納品物)」を実行し、Artifacts の `coconala-delivery` を取得する
- ライセンスキー: `pnpm license:issue --id L-2026-0001`(秘密鍵はリポジトリ外。[`docs/SELLER_OPERATIONS.md`](docs/SELLER_OPERATIONS.md))
- 人間が行う最終作業: [`docs/HUMAN_RELEASE_CHECKLIST.md`](docs/HUMAN_RELEASE_CHECKLIST.md)

## 開発に参加する方へ

セットアップ手順・主要スクリプト・アーキテクチャ原則は [`CONTRIBUTING.md`](CONTRIBUTING.md) を参照してください。
開発AIへの絶対ルールは [`CLAUDE.md`](CLAUDE.md)、リポジトリ構成は
[`docs/01_REPOSITORY_STRUCTURE.md`](docs/01_REPOSITORY_STRUCTURE.md) にまとめています。
