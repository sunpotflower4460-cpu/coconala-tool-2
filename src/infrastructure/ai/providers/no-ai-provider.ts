import type {
  AiCallOptions,
  AiError,
  AiProvider,
  ConnectionStatus,
  InquiryExtractionInput,
} from "@/application/ports/ai-provider";
import type { ExtractedInquiry } from "@/domain/inquiries/types";
import { err, type Result } from "@/lib/result";

const DISABLED_MESSAGE = "AI機能は設定されていません。手動で見積を作成してください。";

/** AIを使わない選択をしている利用者向けの、常にエラーを返すProvider(null object)。 */
export class NoAiProvider implements AiProvider {
  readonly id = "none";
  readonly displayName = "AIを使用しない";

  testConnection(
    _apiKey: string,
    _options?: AiCallOptions,
  ): Promise<Result<ConnectionStatus, AiError>> {
    return Promise.resolve(err({ code: "unknown", message: DISABLED_MESSAGE }));
  }

  extractInquiry(
    _input: InquiryExtractionInput,
    _apiKey: string,
    _options?: AiCallOptions,
  ): Promise<Result<ExtractedInquiry, AiError>> {
    return Promise.resolve(err({ code: "unknown", message: DISABLED_MESSAGE }));
  }
}
