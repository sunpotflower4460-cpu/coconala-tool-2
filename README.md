# 見積・請求書デスク (mitsumori-desk)

購入者自身が初回設定し、AIなしでも見積書・請求書・納品書・領収書を作れる買い切りデスクトップツールです。

<!-- support-contact: PENDING -->

- データはお使いのパソコンに保存されます(ローカルファースト)
- AIを契約しなくても基本機能が使えます
- 問い合わせ文をAIで整理できます(任意)
- 金額は必ずご自身で確認してから発行します
- 買い切り(サブスクリプションなし)。更新版は販売ページから手動で配布します(自動更新は未設定です)

## 対応OS

初回販売の対象OSは **macOS** です。実機でのインストール確認・署名・公証が完了するまでは、販売可能な完成品ではありません。

Windows版は実機確認が完了するまで正式対応としません。CI上でWindows向けビルドが成功することと、購入者へ正式対応と案内することは別です。詳細は [`docs/SUPPORTED_PLATFORMS.md`](docs/SUPPORTED_PLATFORMS.md) を参照してください。

詳しい商品仕様は [`docs/00_PRODUCT_SPEC.md`](docs/00_PRODUCT_SPEC.md) を、
インストール・初回設定・操作方法は [`docs/QUICK_START_GUIDE.md`](docs/QUICK_START_GUIDE.md) と
[`docs/USER_MANUAL.md`](docs/USER_MANUAL.md) を参照してください。

## サポート・お問い合わせ

サポート範囲は [`docs/USER_MANUAL.md`](docs/USER_MANUAL.md) の「5. お困りの際は」および
[`docs/TERMS_OF_SERVICE_DRAFT.md`](docs/TERMS_OF_SERVICE_DRAFT.md) 第5条(サポート範囲)を参照してください。
問い合わせ窓口は販売開始までに確定します(確定後、この節とヘルプ画面の `support-contact: PENDING` を `CONFIRMED` へ更新します)。

## 利用規約・免責事項・ライセンス

- [LICENSE](LICENSE)
- [`docs/TERMS_OF_SERVICE_DRAFT.md`](docs/TERMS_OF_SERVICE_DRAFT.md)(下書き・専門家レビュー前)
- [`docs/DISCLAIMER_DRAFT.md`](docs/DISCLAIMER_DRAFT.md)(下書き・専門家レビュー前)

## 開発に参加する方へ

セットアップ手順・主要スクリプト・アーキテクチャ原則は [`CONTRIBUTING.md`](CONTRIBUTING.md) を参照してください。
開発AIへの絶対ルールは [`CLAUDE.md`](CLAUDE.md)、リポジトリ構成は
[`docs/01_REPOSITORY_STRUCTURE.md`](docs/01_REPOSITORY_STRUCTURE.md) にまとめています。
