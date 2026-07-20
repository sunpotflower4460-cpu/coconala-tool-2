import type { AiProvider } from "@/application/ports/ai-provider";
import type { AppSettings } from "@/domain/shared/app-settings";
import { AnthropicProvider } from "@/infrastructure/ai/providers/anthropic-provider";
import { NoAiProvider } from "@/infrastructure/ai/providers/no-ai-provider";

export function createAiProvider(settings: Pick<AppSettings, "aiEnabled" | "aiModel">): AiProvider {
  if (!settings.aiEnabled) {
    return new NoAiProvider();
  }
  return new AnthropicProvider(settings.aiModel);
}
