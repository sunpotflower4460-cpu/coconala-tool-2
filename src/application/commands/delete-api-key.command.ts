import { toAppError, type AppError } from "@/application/errors";
import { AI_API_KEY_SECRET_NAME, type SecretStore } from "@/application/ports/secret-store";
import { err, ok, type Result } from "@/lib/result";

export async function deleteApiKey(secretStore: SecretStore): Promise<Result<void, AppError>> {
  try {
    await secretStore.delete(AI_API_KEY_SECRET_NAME);
    return ok(undefined);
  } catch (error) {
    return err(toAppError(error, "APIキーの削除に失敗しました"));
  }
}
