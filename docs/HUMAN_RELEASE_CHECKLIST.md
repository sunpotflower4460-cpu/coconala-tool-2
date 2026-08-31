# 人間専用 — 正式販売前チェックリスト

コードや自動テストでは完了にできない作業だけをここに集約する。
`docs/MANUAL_STEPS.md` は開発フェーズ順の詳細、このファイルは「発売するために上から実施する順」である。

未実施の項目を確認済みと書かない。バージョンを `0.9.0-rc.1` や `1.0.0` へ上げる判断も、ここに残る P0 が埋まってから人間が行う。

関連: [`RELEASE_GATES.md`](RELEASE_GATES.md) / [`RELEASE_EVIDENCE.md`](RELEASE_EVIDENCE.md) / [`PDF_VISUAL_TEST_CHECKLIST.md`](PDF_VISUAL_TEST_CHECKLIST.md) / [`COCONALA_LISTING.md`](COCONALA_LISTING.md)

---

## 1. 販売者情報・法務

- [ ] 権利者名を `LICENSE` に記入する
- [ ] `src-tauri/tauri.conf.json` の `bundle.publisher` / `bundle.copyright` を入れる
- [ ] 特定商取引法に基づく表示を確定する
- [ ] `docs/TERMS_OF_SERVICE_DRAFT.md` を専門家レビューのうえ確定し、`_DRAFT` を外す
- [ ] `docs/DISCLAIMER_DRAFT.md` を同様に確定し、`_DRAFT` を外す
- [ ] サポート窓口を確定し、README / USER_MANUAL / ヘルプの `support-contact: PENDING` を `CONFIRMED` へ更新する
- [ ] 販売価格を決める
- [ ] `pnpm check:release -- --strict` が通ることを確認する(上記が揃うまで失敗するのが正しい)

## 2. macOS(初回販売の対象)

- [ ] 実MacでDMG(またはpkg)をインストールして起動できる
- [ ] Developer ID Application で署名する
- [ ] Apple notarization を通す
- [ ] Gatekeeper で、案内どおり起動できる
- [ ] 日本語PDFを [`PDF_VISUAL_TEST_CHECKLIST.md`](PDF_VISUAL_TEST_CHECKLIST.md) の A〜M で目視する
- [ ] バックアップ作成→データ変更→復元→再起動を10回行い、欠損がない
- [ ] 上書きインストール後も既存DBが残る
- [ ] 実Anthropic APIキーで保存・接続確認・削除(キーをリポジトリやissueに貼らない)
- [ ] 小型画面でのUI確認
- [ ] `bundle.macOS.minimumSystemVersion` を実機結果で確定する

## 3. Windows(初回販売対象にする場合のみ)

初回方針では P2。対象にしない場合は「対象外」と記録してスキップする。

- [ ] インストーラー確認
- [ ] SmartScreen
- [ ] コード署名
- [ ] PDF目視
- [ ] バックアップ復元
- [ ] 上書きインストールでDB保持

## 4. 販売ページ・同梱物

- [ ] [`COCONALA_LISTING.md`](COCONALA_LISTING.md) を実ページへ反映(誇張表現を入れない)
- [ ] 商品画像
- [ ] 5分操作動画(`docs/DEMO_VIDEO_SCRIPT.md`)
- [ ] QUICK_START / USER_MANUAL を同梱物として整え、画面文言と差がないか見る
- [ ] ココナラへ出品・公開する

## 5. βテスト

- [ ] 初心者 5〜10名(`docs/BETA_TEST_OBSERVATION_SHEET.md`)
- [ ] 観察と修正
- [ ] 販売停止条件(重大な計算誤り・データ消失・復元不能・秘密情報漏えい・発行済み書類の変化)に抵触しないことを確認してサインオフ

## 6. タグを切る前

- [ ] `docs/RELEASE_EVIDENCE.md` の人間確認欄を、実施した担当者が記入する
- [ ] P0が揃ったと判断したら `0.9.0-rc.1`(β配布)。βを越えたら `1.0.0`
- [ ] GitHub Release の draft 内容を人が確認してから公開する
