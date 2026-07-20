# SECURITY.md

## 保存してはいけない場所

以下にAPIキーを保存しない。

- 通常のSQLite DB(`companies`等の平文テーブル)
- `localStorage` / `sessionStorage`
- コンソールログ・ファイルログ
- 診断ファイル
- テストfixture
- Gitコミット

## APIキーの保存方法

OS標準の資格情報ストア(macOS Keychain / Windows Credential Manager / Linuxのsecret service)を、Rust側の`keyring`クレート経由で利用する(`src-tauri/src/commands/secrets.rs`)。フロントエンドは`application/ports/secret-store.ts`(`SecretStore`)経由でのみアクセスし、`infrastructure/secrets/tauri-secret-store.ts`が実装を提供する。APIキーの値そのものはRust側コマンドの引数・戻り値としてのみ受け渡し、SQLite・localStorage・ログへは書き込まない。

## 通信

- AIを使う場合のみ、利用者が明示的に実行した問い合わせ文だけを送信する。送信前に内容を画面表示する。
- Tauriの`http`権限は、AI Providerのエンドポイントと自動更新の配布先のみに限定する。任意URLへの通信は許可しない。

## Tauri権限(Capabilities)

- `capabilities/default.json`には、DBアクセス・ダイアログ・必要なファイル操作など、通常画面が必要とする権限だけを列挙する。
- 更新処理用の権限は別Capabilityへ分離する(Phase 5)。
- 診断ファイル書き出しは、許可した保存先のみに制限する(Phase 4)。
- 任意のShellコマンド実行権限(`shell:allow-execute`等)は付与しない。

## 診断ファイル

含めてよい: アプリバージョン、OS/CPU種別、DBスキーマバージョン、直近エラー種別と時刻、機能フラグ、個人情報を除いた処理ステップ。

含めてはいけない: APIキー、顧客名・住所・メール、問い合わせ本文、書類明細、振込先、ローカルファイルのフルパス。

診断ファイルは件数・バージョン等の集計値のみから構成し(`build-diagnostics-report.command.ts`)、生成後に`src/domain/diagnostics/secret-scan.ts`の禁止文字列・秘密情報パターン検査(APIキーらしき文字列・メールアドレス・長いbase64風文字列)を通過した場合のみ保存する(`save-diagnostics-report.command.ts`)。検査に引っかかった場合は保存を中止する。

## ログ方針

- `console.log`へ個人情報(顧客名・住所・メール・問い合わせ本文)を出力しない。
- エラーは種別・発生箇所のみを記録し、スタックトレースに個人情報が含まれないか注意する。
- エラーを握り潰さず、`Result`型で呼び出し元へ伝搬する。

## 依存関係

- `.github/workflows/security.yml`で`pnpm audit`・`cargo audit`・APIキーらしき文字列のコミット検査を定期実行する。
- 秘密鍵・署名証明書はリポジトリに含めず、GitHub Secretsで管理する(`docs/MANUAL_STEPS.md`参照)。

## インシデント対応の初期方針

顧客情報・APIキーの漏えいが疑われる場合、`docs/04_ACCEPTANCE_CHECKLIST.md`の「販売停止条件」に従い、解消するまで販売・更新公開を停止する。
