import { AI_API_KEY_SECRET_NAME, type SecretStore } from "@/application/ports/secret-store";

/** APIキーの値そのものは返さず、設定済みかどうかだけを返す(画面に全文を出さないため)。 */
export async function hasApiKey(secretStore: SecretStore): Promise<boolean> {
  const value = await secretStore.get(AI_API_KEY_SECRET_NAME);
  return value !== null && value.trim() !== "";
}
