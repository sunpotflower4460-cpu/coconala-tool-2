import type { AiProvider, ConnectionStatus } from "@/application/ports/ai-provider";
import { AI_API_KEY_SECRET_NAME, type SecretStore } from "@/application/ports/secret-store";
import type { AppError } from "@/application/errors";
import { err, ok, type Result } from "@/lib/result";

export async function testAiConnection(
  provider: AiProvider,
  secretStore: SecretStore,
): Promise<Result<ConnectionStatus, AppError>> {
  const apiKey = await secretStore.get(AI_API_KEY_SECRET_NAME);
  if (!apiKey) {
    return err({
      code: "no_api_key",
      message: "APIキーが設定されていません。先に登録してください。",
    });
  }
  const result = await provider.testConnection(apiKey);
  if (!result.ok) {
    return err({ code: result.error.code, message: result.error.message });
  }
  return ok(result.value);
}
