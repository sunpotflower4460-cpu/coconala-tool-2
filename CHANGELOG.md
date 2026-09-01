# Changelog

このプロジェクトは[Keep a Changelog](https://keepachangelog.com/ja/1.1.0/)の形式に従います。

## [Unreleased]

### Added

- Phase 0: Tauri 2 + React + TypeScript + Viteのプロジェクト土台
- Phase 0: Lint / Format / 型チェック / Rust fmt・clippy・test / Vitest / Playwright最小構成
- Phase 0: GitHub Actions CI (frontend / rust / build)
- Phase 0: ADR 0001〜0004
- Phase 1: SQLite migration(companies/clients/catalog_items/catalog_aliases/documents/document_lines/document_events/app_settings)、外部キー制約
- Phase 1: Money・税計算(税抜税込・複数税率・値引き按分・端数処理)・書類状態・書類番号のdomain層
- Phase 1: 初回設定ウィザード、顧客CRUD、価格表CRUD、見積編集(明細追加・自動計算・下書き保存)、見積一覧
- Phase 1: unit/integration test 56件(実SQLiteエンジンによる検証を含む)
- Phase 2: 書類発行(書類番号採番、会社・顧客・計算結果のスナップショット保存、発行後の再計算禁止)
- Phase 2: 見積書→請求書/納品書、請求書→領収書への変換、書類複製、状態遷移(承認・却下・入金・取消)と履歴
- Phase 2: A4印刷専用プレビュー(OS標準印刷ダイアログでPDF保存、ADR 0005)
- Phase 2: unit/integration test 19件追加(発行後スナップショット不変性の検証を含む、計75件)
- Phase 3: 問い合わせ文からの見積明細抽出(AI照合状態の安全な再判定、実在する価格表IDのみ採用、金額はAIに一切生成させない)
- Phase 3: AI Providerの抽象化(interface, zodスキーマ検証, Anthropicアダプタ、AIなしのnull object実装)
- Phase 3: APIキーをOS資格情報ストア(macOSキーチェーン/Windows資格情報マネージャー/Linux Secret Service)へ保存するRust keyring連携、通常のDB・ログ・診断には一切含めない設計
- Phase 3: AI設定画面(有効化トグル・モデルID・APIキー登録/削除・接続確認)、問い合わせ読み取り確認画面(送信前確認ダイアログ、一致度バッジ、明細の採否選択、見積下書きへの反映)
- Phase 3: CSPで外部通信先を`https://api.anthropic.com`のみへ限定(ADR 0006)
- Phase 3: unit/integration test 24件追加(計99件)
- Phase 4: 初回案内ウィザードの仕上げ(進捗表示・各ステップの戻る・中断後の再開・税設定ステップ・練習見積作成)
- Phase 4: CSV取り込み(顧客・価格表、見本CSV、UTF-8/Shift_JIS自動判定、列マッピング、プレビュー、エラー行表示、重複時のスキップ/上書き選択、取り込み前の自動バックアップ)
- Phase 4: 練習モード(サンプル会社・顧客・価格表・見積の自動作成、練習データのみを安全に一括削除)
- Phase 4: バックアップ/復元(作成・一覧・内容検証・復元前の自動退避・復元失敗時のロールバック・スキーマバージョン表示)
- Phase 4: 診断ファイル出力(個人情報・秘密情報を含まない集計情報のみ、保存前の秘密情報検査)
- Phase 4: ヘルプ画面(画面説明・FAQ・インストール案内・サポート範囲)、5分操作動画の台本(`docs/DEMO_VIDEO_SCRIPT.md`)
- Phase 4: 複数SQL文にまたがる書き込みを真に原子的に実行する`executeTransaction`基盤(ADR 0007)
- Phase 4: unit/integration test 38件追加(計137件)
- Phase 5: バージョン情報画面(アプリバージョン・DBスキーマバージョン・動作環境・ライセンス状態・更新確認)
- Phase 5: ライセンス確認・更新確認の抽象境界(`LicensePort`/`UpdateCheckPort`)。初期販売はライセンスなし・更新確認は未設定として安全に動作し、チェック失敗が既存データの閲覧を妨げない設計(ADR 0008)
- Phase 5: JSON列によるFeature Flag基盤(`app_settings.feature_flags_json`、スキーマ変更なしでフラグを追加可能)
- Phase 5: リリース前のバージョン整合性チェック(`pnpm check:release`)、`docs/RELEASE_PROCESS.md`の具体化
- Phase 5: unit test 12件追加(計144件)
- Phase 6: 初回設定ガイド(`docs/QUICK_START_GUIDE.md`)・利用マニュアル下書き(`docs/USER_MANUAL.md`)
- Phase 6: 利用規約・免責事項の下書き(`docs/TERMS_OF_SERVICE_DRAFT.md`・`docs/DISCLAIMER_DRAFT.md`、要専門家レビュー)
- Phase 6: ベータテスト観察シート(`docs/BETA_TEST_OBSERVATION_SHEET.md`)
- 正式販売化PR-1: `pnpm check:release`にLICENSE・利用規約・免責事項のプレースホルダー検出、`bundle.publisher`/`bundle.copyright`未設定検出、`--strict`モード(正式タグ用)を追加
- 正式販売化PR-1: `src-tauri/tauri.conf.json`に`bundle.publisher`・`bundle.copyright`・`bundle.macOS.minimumSystemVersion`の設定欄を追加(値は人間が確定するまで空・暫定値)
- 正式販売化PR-1: バージョン情報画面のライセンス表示を「買い切り版(ライセンス認証不要)」へ、更新未設定表示を「更新は販売ページから手動で提供します」へ変更(`LicensePort`/`UpdateCheckPort`の戻り値自体は変更なし)
- 正式販売化PR-1: `README.md`を購入者向け情報に整理し、開発者向けセットアップ・スクリプト一覧を`CONTRIBUTING.md`へ集約
- 正式販売化PR-1: `docs/RELEASE_GATES.md`を追加(優先度・RC/正式タグの必須条件・バージョン方針)
- 正式販売化PR-1: unit test 3件追加(計147件)
- 正式販売化PR-2: バックアップ作成・復元前退避を、生きているDBの素朴なファイルコピーから
  SQLiteの`VACUUM INTO`ベースへ変更し、書き込み中でもジャーナルモードに関わらず
  一貫したスナップショットを作成できるようにした
- 正式販売化PR-2: バックアップ完了後・復元前退避後に`PRAGMA integrity_check`を実行し、
  失敗した場合はそのバックアップ/退避データを破棄してエラーにする
- 正式販売化PR-2: バックアップにメタデータ(`app_version`・`schema_version`・`created_at_unix`・`os`)を
  `<file>.manifest.json`として付与
- 正式販売化PR-2: バックアップの外部フォルダへの書き出し(`export_backup_to`)・
  外部ファイルからの取り込み(`import_backup_from`)を追加し、データ管理画面から操作できるようにした
- 正式販売化PR-2: Rust unit test 5件・frontend unit test 5件追加(計152件)
- 正式販売化PR-3: `tests/e2e-tauri/`を新規追加。`tauri-driver`+WebKitWebDriver経由で
  実際にビルドしたTauriアプリを操作し、初回設定(会社情報・税設定・顧客登録・価格表登録・
  練習見積作成)、練習見積の金額計算表示、アプリ再起動後のデータ永続化を検証する
  (Linux専用、`pnpm test:e2e-tauri`、CIに`e2e-tauri`ジョブを追加)
- 正式販売化PR-4: 帳票印刷レイアウトに、会社・顧客の郵便番号、顧客の担当者名(「様」付き)、
  会社のメールアドレスの表示を追加(ドメイン型には存在していたが印刷レイアウトに表示されて
  いなかった項目)。顧客の電話番号・メールアドレスは、発行先(相手方)の連絡先情報を印刷物へ
  載せる一般的な商習慣に合わせて意図的に対象外とした(未対応ではなく設計判断)
- 正式販売化PR-4: 印刷CSSに長い会社名・住所・備考への`overflow-wrap: break-word`、
  合計欄・書類ヘッダー・当事者情報が改ページで分断されないよう`break-inside: avoid`を追加
- 正式販売化PR-4: `DocumentPrintLayout`のcomponent test 15件追加(計167件)。
  ページの実際の見た目(改ページ・日本語フォント・PDF文字欠け等)は実機目視が前提のため
  `docs/MANUAL_STEPS.md`へ記録し、コードでは検証していない
- 正式販売化PR-5: AIエラー分類に`rate_limited`(429)・`server_error`(5xx)を追加し、
  「無効なAPIキー」「通信エラー」と区別できるようにした(それまでは`unknown`扱いだった)
- 正式販売化PR-5: AI設定画面に、AIサービスの利用料金が購入者負担であることの明記を追加
- 正式販売化PR-5: AI・問い合わせ抽出のunit testを強化(429/5xx分類、実際の30秒タイムアウト発火、
  巨大な応答の処理、数量0・負数・単位未設定時にAIの状態自己申告を信用しないこと)
- 正式販売化PR-5: migrationファイルにAPIキー等の秘密情報らしき列名が追加されていないことを
  検査する回帰テストを追加(独立レビューの指摘により、`anthropic_api_key`のような接頭辞付き
  列名も検出できるよう正規表現の境界判定を修正済み)
- 正式販売化PR-5: unit test 12件追加(計177件)
- 正式販売化PR-6: 左ナビを「作成」「帳票」「マスタ」「設定」でカテゴリ化し、
  現在位置と次に何をすべきかが分かりやすいようにした
- 正式販売化PR-6: ホームに「今日やること」として、新しい見積を作る・問い合わせを読み取る・
  顧客を追加・価格表を取り込むの4つのクイックアクションを追加
- 正式販売化PR-6: CSV取り込み画面の各セクションに「ステップ1〜4」の見出しを追加し、
  取り込み対象選択→列マッピング→プレビュー→重複時の扱いと取り込み、という流れを
  明示するようにした
- 正式販売化PR-6: component test 5件追加(計182件)。削除・発行・復元の確認ダイアログ、
  発行の不可逆性説明、AI照合結果の色以外での表示、見積編集中の金額内訳固定表示、
  空状態への次アクション配置は既存実装で対応済みであることを確認(追加変更なし)。
  ダークモードは配色切り替え自体が未実装のため、帳票印刷CSSへの混入は現状発生しない
- 正式販売化PR-7: `pnpm check:release` を basic / `--rc` / `--strict` の3段階に拡張し、
  サポート窓口未確定・秘密情報らしき文字列・自動更新未実装の未記載・販売OS表記の矛盾を検査する。
  正式タグでは CHANGELOG の対象バージョン見出しも必須
- 正式販売化PR-7: `.github/workflows/release.yml` にタグ種別ごとのゲートジョブを追加。
  `vX.Y.Z` は `--strict`、`vX.Y.Z-rc.N` は `--rc`。人間確認は完了扱いにしない
- 正式販売化PR-7: `docs/RELEASE_EVIDENCE.md`(自動確認と人間確認の分離)、
  `docs/SUPPORTED_PLATFORMS.md`(初回販売はmacOS、Windowsは実機確認まで正式対応としない)を追加。
  購入者向けREADME・マニュアル・ヘルプのOS表記を方針に揃えた。バージョンは 0.1.0 のまま
  (RCや 1.0.0 への変更は人間の最終判断)
- 正式販売化PR-8: 実Tauri E2Eを帳票フロー(発行・変換・スナップショット不変)、バックアップ復元、
  CSV取り込みまで拡張。シナリオは直列実行(`--test-concurrency=1`)
- 正式販売化PR-8: CSVの列順違い・不足列・余分な列・空行・BOM・UTF-8日本語・重複・5000件の
  取り込みテストを追加。5000件の所要時間はログに残すが宣伝には使わない
- 正式販売化PR-9: 開発用の大量データ生成 `pnpm seed:stress`（本番アプリデータパスでは実行不可、
  `MITSUMORI_ALLOW_STRESS_SEED=1` 必須）。ci プロファイルで起動・一覧・検索・見積作成の所要時間を記録する
- 正式販売化PR-9: バックアップ障害系の自動テスト（空ファイル、巨大ファイル上限、未来スキーマ、
  保存先不在、書き込み権限なし）と、SQLiteエンジンコードを購入者向け日本語へ置換
- 正式販売化PR-10: 帳票PDFの目視用 fixture A〜M（短い/複数ページ/長文/高額/0円/割引/複数税率/文字種混在）と
  `docs/PDF_VISUAL_TEST_CHECKLIST.md`。見た目の最終判定は人間作業
- 正式販売化PR-11: AI連携の403/空応答/壊れたJSONを分類し、APIキーがSQLite・診断JSON・エラー文へ混入しないことを検査。
  AI設定画面に「任意・料金は購入者負担・結果は最終決定ではない・金額は確認」を明示
- 正式販売化PR-12: ヘルプに初回設定からサポート対象外までの自己解決手順を追加。開発用エンジンコードを画面に出さず、
  「診断情報をコピー」で問い合わせ用の要約を渡せるようにした
- 正式販売化PR-13: ココナラ出品文下書き(`docs/COCONALA_LISTING.md`)、人間専用チェックリスト、
  Cursor作業完了報告。誇張表現は使わず、実機未確認を完了扱いにしない

### Fixed

- 販売前ハードニング: stress DBをSQLx互換の `_sqlx_migrations`(checksum含む)で生成するよう修正し、
  実アプリ起動時の migration runner 失敗を防ぐ
- schema version の手動固定をやめ、Rust は registered migrations から導出、TypeScript 定数は
  `pnpm check:migrations` で最新 migration 番号と一致することを必須にした
- アプリ自身が作ったバックアップを 512MiB だけで拒否・削除しない。512MiB 制限は外部importの
  未信頼ファイルにだけ、SQLite を開く前に適用する
- バックアップ I/O エラー分類を英語OSメッセージ文字列依存から `ErrorKind` / raw OS code /
  SQLite error code へ変更し、購入者向けには権限・容量・ファイルなしの日本語だけを出す
- `pnpm seed:stress` を POSIX の環境変数記法から Node launcher へ変え、Windows でも実行できるようにした

- `sql:default`権限にAPI実行(`execute`)が含まれておらず会社情報保存が失敗する不具合を`sql:allow-execute`権限追加で修正
- 請求書が発行後に直接入金済みへ遷移できない不具合(状態遷移表に`issued→paid`を追加)を修正
- 複数SQL文にまたがる書き込み(見積保存・発行・変換・複製・状態変更・練習データ削除)で、`tauri-plugin-sql`のコネクションプールにより手動の`BEGIN`/`COMMIT`が別コネクションに振り分けられ`cannot commit - no transaction is active`が発生し保存が失敗する不具合を、専用コネクションによる原子的なトランザクション実行(`executeTransaction`)へ置き換えて修正(ADR 0007、実機確認で発見)
- `pnpm/action-setup@v4`にpnpmバージョンが指定されておらず、CIのfrontend/dependency-auditジョブが
  mainへの統合コミット時点から継続して失敗していた不具合を、`package.json`への`packageManager`
  フィールド追加で修正
