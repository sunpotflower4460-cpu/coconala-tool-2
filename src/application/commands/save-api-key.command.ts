import { toAppError, type AppError } from "@/application/errors";
import { AI_API_KEY_SECRET_NAME, type SecretStore } from "@/application/ports/secret-store";
import { err, ok, type Result } from "@/lib/result";

export async function saveApiKey(
  secretStore: SecretStore,
  apiKey: string,
): Promise<Result<void, AppError>> {
  const trimmed = apiKey.trim();
  if (trimmed === "") {
    return err({ code: "invalid_api_key", message: "APIキーを入力してください" });
  }
  try {
    await secretStore.set(AI_API_KEY_SECRET_NAME, trimmed);
    return ok(undefined);
  } catch (error) {
    return err(toAppError(error, "APIキーの保存に失敗しました"));
  }
}
