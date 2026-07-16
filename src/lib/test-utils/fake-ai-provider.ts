import type {
  AiCallOptions,
  AiError,
  AiProvider,
  ConnectionStatus,
  InquiryExtractionInput,
} from "@/application/ports/ai-provider";
import type { ExtractedInquiry } from "@/domain/inquiries/types";
import { err, ok, type Result } from "@/lib/result";

interface FakeAiProviderOptions {
  connectionResult?: Result<ConnectionStatus, AiError>;
  extractionResult?: Result<ExtractedInquiry, AiError>;
}

export class FakeAiProvider implements AiProvider {
  readonly id = "fake";
  readonly displayName = "テスト用AI";
  calls: { text: string }[] = [];

  constructor(private readonly options: FakeAiProviderOptions = {}) {}

  testConnection(
    _apiKey: string,
    _callOptions?: AiCallOptions,
  ): Promise<Result<ConnectionStatus, AiError>> {
    return Promise.resolve(this.options.connectionResult ?? ok({ ok: true, message: "OK" }));
  }

  extractInquiry(
    input: InquiryExtractionInput,
    _apiKey: string,
    _callOptions?: AiCallOptions,
  ): Promise<Result<ExtractedInquiry, AiError>> {
    this.calls.push({ text: input.text });
    return Promise.resolve(
      this.options.extractionResult ??
        err({ code: "unknown", message: "テストで結果が設定されていません" }),
    );
  }
}
