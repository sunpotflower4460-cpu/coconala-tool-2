/**
 * OS標準の資格情報ストア(macOS Keychain / Windows Credential Manager / Linux Secret Service)への
 * アクセスを抽象化する。APIキーはこのportを通じてのみ読み書きし、通常のSQLite DBには保存しない。
 */
export interface SecretStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export const AI_API_KEY_SECRET_NAME = "ai_provider_api_key";
