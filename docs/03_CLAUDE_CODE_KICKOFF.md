# 03 — Claude Code用キックオフプロンプト

以下を、新しく作成したリポジトリのClaude Codeへそのまま渡してください。

---

```text
あなたはこのリポジトリのPrincipal Engineer兼Product Engineerです。

このプロジェクトは、購入者自身が初回設定し、問い合わせ文から見積書・請求書・納品書・領収書を作れる、macOS / Windows向け買い切りデスクトップツールです。

販売者が購入者の会社情報や価格表を代理入力する受託開発ではありません。購入者が購入後、自力で使い始められる完成商品にしてください。

最初に必ず以下を読んでください。

- README.md
- docs/00_PRODUCT_SPEC.md
- docs/01_REPOSITORY_STRUCTURE.md
- docs/02_DEVELOPMENT_PHASES.md
- docs/04_ACCEPTANCE_CHECKLIST.md
- CLAUDE.md

## 最重要原則

1. ローカルファーストです。顧客・価格表・帳票は原則購入者のPCに保存してください。
2. AIなしでも、見積・請求・納品・領収書の基本機能を使えるようにしてください。
3. AIは問い合わせ文を整理する補助です。金額の確定、書類発行、送信を勝手に行わせないでください。
4. 金額は円の整数で扱い、浮動小数点数を使わないでください。
5. 発行済み書類はスナップショット保存し、後の会社情報・顧客情報・価格表変更で内容を変化させないでください。
6. APIキーを通常DB、localStorage、ログ、診断ファイルへ保存しないでください。
7. Tauriの権限は必要最小限にしてください。Shellの任意実行や無制限のファイル・HTTP権限を与えないでください。
8. 初心者向けの画面では、専門用語をそのまま表示しないでください。
9. コードで可能な作業は先に行い、人間だけができる署名・証明書・販売登録などはdocs/MANUAL_STEPS.mdへ集約し、最後に残してください。
10. 日常的な技術判断で私の確認を待たず、安全で単純な案を選び、理由をADRへ記録してください。

## 技術の基準

- Tauri 2
- React
- TypeScript strict
- Vite
- pnpm
- SQLite
- 公式Tauri SQL pluginを優先
- フロント入力はスキーマ検証
- Rust側は構造化エラーを返す
- AI ProviderはAdapter方式
- テスト可能なdomain層を独立

ライブラリの具体的バージョンは、作業時点の公式互換性と安定版を確認して選択してください。不要な大型フレームワークを増やさないでください。

## 作業の進め方

docs/02_DEVELOPMENT_PHASES.mdに従い、Phase 0から順番に進めてください。

routineな作業ごとに確認を求めず、テストが通る範囲で自動的に進行してください。ただし、以下は実行せず、docs/MANUAL_STEPS.mdへ記載してください。

- 有料サービスの契約
- 外部への公開
- GitHub Releaseの本番公開
- macOS / Windowsの本番署名
- 秘密鍵の生成・登録
- 販売ページ公開
- 破壊的な既存データ削除

## 最初の実行範囲

まずPhase 0を完全に行い、そのままPhase 1の「AIなしで見積書を作る縦の一本」まで進めてください。

Phase 1の縦の一本:

初回設定
→ 顧客登録
→ 価格表登録
→ 見積作成
→ SQLiteへ保存
→ アプリ再起動
→ 保存した見積を再表示

この縦の一本が動くまでは、AI、ライセンス、複雑な帳票デザイン、自動更新、外部連携へ進まないでください。

## Phase 0で必ず作るもの

- Tauri + React + TypeScript + Vite project
- pnpm setup
- strict TypeScript
- lint / format / typecheck
- Rust fmt / clippy / test
- frontend unit tests
- minimal E2E structure
- GitHub Actions CI
- error boundary
- typed Result/error model
- initial ADRs
- docs/MANUAL_STEPS.md
- docs/DATA_MODEL.md
- docs/SECURITY.md
- docs/RELEASE_PROCESS.md skeleton

## Phase 1で必ず作るもの

- SQLite migrations
- foreign key enforcement
- company settings
- clients
- catalog items
- estimate documents and lines
- integer Money domain
- tax / discount / rounding calculation
- onboarding flow
- client CRUD
- catalog CRUD
- manual estimate editor
- draft save and reload
- document list
- sample data fixtures
- unit and integration tests

## UI方針

- 初心者が迷わないことを優先
- 1画面に主要操作を1つ
- 保存状態を常に表示
- 削除や初期化は確認を挟む
- 色だけで状態を表現しない
- 日本語を第一言語として設計
- 長い会社名、住所、商品名を前提にする
- 実装前に画面遷移を短く文章で提示し、それに沿って作る

## 実装ルール

- UI内に税計算を直接書かない
- SQLをReact componentへ書かない
- domainからTauri / React / AI SDKを参照しない
- anyを安易に使わない
- TODOだけの機能を完成扱いしない
- モックで通っただけの機能を実データ対応済みと報告しない
- migrationなしでDB schemaを変更しない
- 既存のテストを削除して通す行為をしない
- エラーを握り潰さない
- 個人情報をconsole.logしない

## 各Phase終了時の報告形式

専門用語を減らした日本語で、次を報告してください。

1. 今回できるようになったこと
2. 主に変更したファイル
3. 実行したテストと結果
4. 画面で確認する手順
5. 未完了・既知の問題
6. 次のPhaseで行うこと
7. 人間による作業が必要ならdocs/MANUAL_STEPS.mdの該当箇所

## 品質ゲート

Phaseを完了と呼ぶ前に、少なくとも以下を実行してください。

- pnpm lint
- pnpm typecheck
- pnpm test
- cargo fmt --check
- cargo clippy -- -D warnings
- cargo test
- production build

コマンド名が異なる場合はpackage.jsonへ一貫したscriptを用意してください。

## 最初の返答

最初に、読んだ資料と現在のリポジトリ状態を短く整理してください。
その後、質問で停止せずPhase 0の実装を開始してください。
致命的な不足がある場合だけ、妥当な仮定を置いた上で進み、その仮定をADRまたは作業報告へ明記してください。
```

---

## 追加指示をするときの短いプロンプト

### 次Phaseへ進める

```text
現在のリポジトリ、README、CLAUDE.md、docsを再確認してください。
前Phaseの未完了とテスト結果を検証した上で、docs/02_DEVELOPMENT_PHASES.mdの次Phaseを実装してください。
通常の判断では確認を待たず進み、人間しかできない作業だけdocs/MANUAL_STEPS.mdへ残してください。
最後に、できるようになったこと、テスト、確認手順、残課題を初心者向けの日本語で報告してください。
```

### 不具合を直す

```text
以下の不具合を再現し、原因を推測だけで決めず、ログ・コード・テストで特定してください。
修正前に失敗する回帰テストを追加し、その後修正してください。
個人情報やAPIキーをログへ追加しないでください。
修正後は関連テストとproduction buildを実行し、利用者向けの確認手順を日本語で報告してください。

不具合:
（ここへ現象、操作手順、画面、診断情報を貼る）
```

### UIを改善する

```text
機能やデータ構造を壊さず、対象画面を初心者が説明なしで使えるよう改善してください。
見た目だけでなく、次の行動、保存状態、入力エラー、戻り方、危険操作の確認を明確にしてください。
色だけに依存せず、キーボード操作と長い日本語にも対応してください。
変更前後の画面構造と、E2Eまたはcomponent testの更新を報告してください。
```
