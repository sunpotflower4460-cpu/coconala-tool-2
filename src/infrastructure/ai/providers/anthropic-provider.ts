import type {
  AiCallOptions,
  AiError,
  AiProvider,
  ConnectionStatus,
  InquiryExtractionInput,
} from "@/application/ports/ai-provider";
import type { ExtractedInquiry } from "@/domain/inquiries/types";
import { mapExtractionResponse } from "@/infrastructure/ai/map-extraction-response";
import {
  buildInquiryExtractionUserPrompt,
  INQUIRY_EXTRACTION_SYSTEM_PROMPT,
} from "@/infrastructure/ai/prompts/inquiry-extraction.prompt";
import { inquiryExtractionSchema } from "@/infrastructure/ai/schemas/inquiry-extraction.schema";
import { err, ok, type Result } from "@/lib/result";

const API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MODEL = "claude-sonnet-5";

const EXTRACTION_TOOL_NAME = "submit_inquiry_extraction";

const EXTRACTION_TOOL = {
  name: EXTRACTION_TOOL_NAME,
  description: "問い合わせ文を整理した構造化データを提出する。金額は含めない。",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      requested_due_date: { type: ["string", "null"] },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            source_text: { type: "string" },
            normalized_name: { type: "string" },
            quantity: { type: ["number", "null"] },
            unit: { type: ["string", "null"] },
            catalog_candidates: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  catalog_item_id: { type: "number" },
                  confidence: { type: "number" },
                  reason: { type: "string" },
                },
                required: ["catalog_item_id", "confidence"],
              },
            },
            questions: { type: "array", items: { type: "string" } },
          },
          required: ["source_text", "normalized_name"],
        },
      },
      global_questions: { type: "array", items: { type: "string" } },
    },
    required: ["summary", "items"],
  },
};

interface AnthropicToolUseBlock {
  type: "tool_use";
  name: string;
  input: unknown;
}

interface AnthropicMessageResponse {
  content: Array<AnthropicToolUseBlock | { type: string }>;
}

function mergeSignals(a: AbortSignal, b: AbortSignal | undefined): AbortSignal {
  if (!b) return a;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([a, b]);
  }
  return a;
}

async function callAnthropic(
  apiKey: string,
  model: string,
  body: Record<string, unknown>,
  options: AiCallOptions | undefined,
): Promise<Result<AnthropicMessageResponse, AiError>> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), DEFAULT_TIMEOUT_MS);
  const signal = mergeSignals(timeoutController.signal, options?.signal);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({ model, ...body }),
      signal,
    });

    if (response.status === 401 || response.status === 403) {
      return err({ code: "invalid_api_key", message: "APIキーが正しくないか、権限がありません。" });
    }
    if (!response.ok) {
      return err({
        code: "unknown",
        message: `AIサービスからエラーが返されました(status: ${response.status})`,
      });
    }

    const json = (await response.json()) as AnthropicMessageResponse;
    return ok(json);
  } catch (error) {
    if (options?.signal?.aborted) {
      return err({ code: "cancelled", message: "処理をキャンセルしました。" });
    }
    if (timeoutController.signal.aborted) {
      return err({
        code: "timeout",
        message: "AIサービスからの応答がありませんでした(タイムアウト)。",
      });
    }
    return err({
      code: "network",
      message:
        error instanceof Error
          ? "通信に失敗しました。インターネット接続を確認してください。"
          : "不明なエラーが発生しました。",
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export class AnthropicProvider implements AiProvider {
  readonly id = "anthropic";
  readonly displayName = "Anthropic Claude";

  constructor(private readonly model: string = DEFAULT_MODEL) {}

  async testConnection(
    apiKey: string,
    options?: AiCallOptions,
  ): Promise<Result<ConnectionStatus, AiError>> {
    const result = await callAnthropic(
      apiKey,
      this.model,
      { max_tokens: 8, messages: [{ role: "user", content: "OK" }] },
      options,
    );
    if (!result.ok) return result;
    return ok({ ok: true, message: "接続できました。" });
  }

  async extractInquiry(
    input: InquiryExtractionInput,
    apiKey: string,
    options?: AiCallOptions,
  ): Promise<Result<ExtractedInquiry, AiError>> {
    const result = await callAnthropic(
      apiKey,
      this.model,
      {
        max_tokens: 4096,
        system: INQUIRY_EXTRACTION_SYSTEM_PROMPT,
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: "tool", name: EXTRACTION_TOOL_NAME },
        messages: [
          {
            role: "user",
            content: buildInquiryExtractionUserPrompt(input.text, input.catalogItems),
          },
        ],
      },
      options,
    );
    if (!result.ok) return result;

    const toolUse = result.value.content.find(
      (block): block is AnthropicToolUseBlock => block.type === "tool_use",
    );
    if (!toolUse) {
      return err({ code: "invalid_response", message: "AIの応答形式が不正でした。" });
    }

    const parsed = inquiryExtractionSchema.safeParse(toolUse.input);
    if (!parsed.success) {
      return err({ code: "invalid_response", message: "AIの応答形式が不正でした。" });
    }

    return ok(mapExtractionResponse(parsed.data, input.catalogItems));
  }
}
