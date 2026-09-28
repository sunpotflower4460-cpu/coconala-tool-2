# 人間専用 — 正式販売前チェックリスト(上から順に行う)

コードや自動テストでは完了にできない作業だけを、**実施する順番**に並べています。
詳しい手順は [`MANUAL_STEPS.md`](MANUAL_STEPS.md)、ココナラでの日々の作業は [`SELLER_OPERATIONS.md`](SELLER_OPERATIONS.md) を見てください。

未実施の項目を確認済みと書かない。バージョンを `0.9.0-rc.1` や `1.0.0` へ上げる判断も、ここに残る項目が埋まってから人間が行う。

関連: [`RELEASE_GATES.md`](RELEASE_GATES.md) / [`RELEASE_EVIDENCE.md`](RELEASE_EVIDENCE.md) / [`PDF_VISUAL_TEST_CHECKLIST.md`](PDF_VISUAL_TEST_CHECKLIST.md) / [`COCONALA_LISTING.md`](COCONALA_LISTING.md)

---

## 0. このブランチを main へ入れる

- [ ] プルリクエストを作り、CI(lint・テスト・Rust・macOS/Windows/Linux ビルド・E2E)が緑になることを確認して main へ入れる
- [ ] Actions の「Installers (ココナラ納品物)」を手動実行し、Mac と Windows の zip ができることを確認する(この時点では Mac は `-unsigned` で正しい)

## 1. Apple の署名・公証(Mac)

- [ ] Developer ID Application 証明書を作り `.p12` に書き出す(`MANUAL_STEPS.md` Phase 5)
- [ ] App 用パスワードを作り、Team ID を確認する
- [ ] GitHub Secrets に `APPLE_CERTIFICATE` / `APPLE_CERTIFICATE_PASSWORD` / `APPLE_SIGNING_IDENTITY` / `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` を登録する
- [ ] Installers をもう一度実行し、Mac の zip 名から `-unsigned` が消え、「署名・公証の確認」ジョブが成功することを確認する

## 2. ライセンスの本番鍵

- [ ] `pnpm license:keygen` を実行し、公開鍵で `src-tauri/license/public_key.b64` を置き換えてコミットする
- [ ] 秘密鍵(`~/.mitsumori-desk-license/private.pem`)を USB メモリ等にもバックアップする
- [ ] Installers を実行し直して、本番鍵入りの zip を作る

## 3. 販売者情報・法務

- [ ] 権利者名を `LICENSE` に記入する
- [ ] `src-tauri/tauri.conf.json` の `bundle.publisher` / `bundle.copyright` を入れる
- [ ] 特定商取引法に基づく表示の要否と内容を確認し、確定する
- [ ] `docs/TERMS_OF_SERVICE_DRAFT.md` を専門家レビューのうえ確定し(利用台数・返金・対応OS・準拠法・管轄)、`_DRAFT` を外す
- [ ] `docs/DISCLAIMER_DRAFT.md` を同様に確定し、`_DRAFT` を外す
- [ ] 販売価格と返金条件を決める
- [x] サポート窓口: ココナラのトークルーム/ダイレクトメッセージに確定済み
- [ ] `pnpm check:release -- --strict` が通ることを確認する(上記が揃うまで失敗するのが正しい)

## 4. Mac 実機確認

- [ ] 署名済み zip を別の Mac でダウンロード → 展開 → dmg からインストールして起動できる(警告なしで開ける)
- [ ] 日本語PDFを [`PDF_VISUAL_TEST_CHECKLIST.md`](PDF_VISUAL_TEST_CHECKLIST.md) の A〜Q で目視する(合計欄・税率別の対象額・ロゴ・未認証版の透かしを含む)
- [ ] バックアップ作成→データ変更→復元→再起動を10回行い、欠損がない
- [ ] 古い版の上にインストールしても既存データが残る
- [ ] 本番鍵で発行したライセンスキーを登録できる。1文字変えたキーは拒否される
- [ ] 実Anthropic APIキーで保存・接続確認・読み取り・削除(キーをリポジトリやissueに貼らない)
- [ ] 小さい画面(13インチ)で表示が崩れない
- [ ] `bundle.macOS.minimumSystemVersion` を実機結果で確定する

## 5. Windows 実機確認

- [ ] Windows 10 / 11 の実機で zip を展開し、SmartScreen を手順書どおり通してインストール・起動できる
- [ ] PDF保存(Microsoft Print to PDF)で A〜Q を目視する
- [ ] バックアップ復元、上書きインストールでのデータ保持を確認する
- [ ] アンインストール画面の「データ削除」の文言を確認し、`docs/INSTALL_GUIDE_WINDOWS.md` の説明と合っているか直す
- [ ] 問題なければ `docs/supported-platforms.json` の `firstSale` に `"windows"` を追加し、README・マニュアル・出品文の「Windows版は実機確認が完了するまで…」を外す(`pnpm check:release -- --rc` で確認)

## 6. 販売ページ・同梱物

- [ ] 納品 zip の中の PDF を開き、画面の文言と差がないか見る
- [ ] ココナラのトークルームに zip を添付できることを確認する(サイズ・拡張子)
- [ ] 商品画像(実機の画面)と5分操作動画(`docs/DEMO_VIDEO_SCRIPT.md`)を作る
- [ ] ココナラの最新の規約を確認し、[`COCONALA_LISTING.md`](COCONALA_LISTING.md) を実ページへ反映する(誇張表現を入れない。Windows の実機確認前なら「Mac版のみ」にする)

## 7. βテスト

- [ ] 初心者 5〜10名(`docs/BETA_TEST_OBSERVATION_SHEET.md`)に `0.9.0-rc.1` を配る
- [ ] 観察と修正
- [ ] 販売停止条件(重大な計算誤り・データ消失・復元不能・秘密情報漏えい・発行済み書類の変化)に抵触しないことを確認してサインオフ

## 8. 正式リリース

- [ ] `docs/RELEASE_EVIDENCE.md` の人間確認欄を、実施した担当者が記入する
- [ ] バージョンを `1.0.0` にし、CHANGELOG に `[1.0.0]` を作ってタグを切る(`docs/RELEASE_PROCESS.md`)
- [ ] Installers の zip(署名済み・本番鍵入り)で最終確認し、ココナラへ出品・公開する
