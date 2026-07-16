# 0006 — 最初のAI Provider実装とAPIキー保存・通信制限の方式

## ステータス

採用

## コンテキスト

ADR 0003で定めたAdapter方式(`AiProvider`)に対し、Phase 3で最初の実Providerを実装する必要がある。あわせて、APIキーの保存方法と、Tauriアプリからの通信範囲をどう制限するかを決める必要がある。

## 決定

### Provider

最初の実Providerとして`AnthropicProvider`(`src/infrastructure/ai/providers/anthropic-provider.ts`)を実装する。

- Anthropic Messages APIの`tool_choice`でツール呼び出しを強制し、自由文ではなく構造化されたJSON(ツールの`input`)を得る。これによりJSON抽出の失敗率を下げる。
- 受け取った`input`は`zod`スキーマ(`src/infrastructure/ai/schemas/inquiry-extraction.schema.ts`)で検証し、検証後に`src/domain/inquiries/reconcile.ts`で「利用者から渡した価格表IDのみ許可」という安全規則を強制する。AIの自己申告する`status`(matched/review/unresolved)は信用せず、reconcile側で再計算する。
- モデルIDは`app_settings.ai_model`でユーザーが変更できるようにし、コードへ固定のバージョン文字列を埋め込みすぎないようにする(将来のモデル更新に追従しやすくするため)。
- AIを使わない選択をした利用者のために`NoAiProvider`(常にエラーを返すnull object)を用意し、`aiEnabled`設定で切り替える(`infrastructure/ai/create-ai-provider.ts`)。

### APIキーの保存

Rust側で`keyring`クレート(v4, `apple-native-keyring-store` / `windows-native-keyring-store` / `zbus-secret-service-keyring-store`機能を有効化)を使い、OS標準の資格情報ストアへ保存する。フロントエンドはTauriの`invoke`でRustコマンド(`secret_get` / `secret_set` / `secret_delete`)を呼ぶだけで、キーの値を直接扱う処理はRust側に閉じる。

理由:

- macOS Keychain / Windows Credential Manager / Linuxのsecret serviceを、OSごとの分岐コードなしで扱える。
- SQLite・localStorage・ログへキーが混入する経路を作らない(`SecretStore`ポート経由のみに限定)。

### 通信範囲の制限

`tauri.conf.json`の`app.security.csp`を`null`から明示的な許可リストへ変更し、`connect-src`を`'self' ipc: http://ipc.localhost https://api.anthropic.com`に限定した。任意のURLへの通信を防ぎ、AI Providerのエンドポイントのみを許可する(`docs/01_REPOSITORY_STRUCTURE.md` 10章の方針に合致)。将来の自動更新機能を追加する際は、更新配布先のホストをここへ追記する。

## 影響

- 新しいAI Providerを追加する場合、`connect-src`にそのProviderのAPIホストを追記する必要がある(見落とすと通信がCSPでブロックされる)。
- Rustの`keyring`クレートの実接続確認は、D-Bus secret serviceやOSキーチェーンが利用できるデスクトップ環境でのみ行える。開発コンテナ内ではRust側の単体テストを持たず、TypeScript側はfakeの`SecretStore`実装でテストする。実機(macOS/Windows/Linuxデスクトップ)での動作確認は`docs/MANUAL_STEPS.md`に記載する。
- CSPを厳格化したことで、開発中に新しい外部リソース(フォント、画像CDN等)を追加する場合は、このADRとCSP設定を両方更新する必要がある。
