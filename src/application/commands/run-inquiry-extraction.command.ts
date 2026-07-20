import type { AiProvider } from "@/application/ports/ai-provider";
import type { DatabasePort } from "@/application/ports/database";
import { AI_API_KEY_SECRET_NAME, type SecretStore } from "@/application/ports/secret-store";
import type { AppError } from "@/application/errors";
import { listCatalogItems } from "@/application/queries/list-catalog-items.query";
import type { ExtractedInquiry } from "@/domain/inquiries/types";
import { err, ok, type Result } from "@/lib/result";

export interface RunInquiryExtractionResult {
  extractionId: number;
  extraction: ExtractedInquiry;
}

export async function runInquiryExtraction(
  db: DatabasePort,
  provider: AiProvider,
  secretStore: SecretStore,
  text: string,
  model: string | null,
  options?: { signal?: AbortSignal },
): Promise<Result<RunInquiryExtractionResult, AppError>> {
  if (text.trim() === "") {
    return err({ code: "empty_text", message: "問い合わせ文を入力してください" });
  }

  const apiKey = await secretStore.get(AI_API_KEY_SECRET_NAME);
  if (!apiKey) {
    return err({
      code: "no_api_key",
      message: "APIキーが設定されていません。AI設定画面から登録してください。",
    });
  }

  const catalogItems = await listCatalogItems(db, { activeOnly: true });
  const result = await provider.extractInquiry(
    {
      text,
      catalogItems: catalogItems.map((item) => ({
        id: item.id,
        name: item.name,
        aliases: [],
        unit: item.unit,
      })),
    },
    apiKey,
    options,
  );

  if (!result.ok) {
    return err({ code: result.error.code, message: result.error.message });
  }

  const now = new Date().toISOString();
  const inserted = await db.execute(
    `INSERT INTO ai_extractions (source_text, provider_id, model, result_json, confirmed, created_at)
     VALUES (?, ?, ?, ?, 0, ?)`,
    [text, provider.id, model, JSON.stringify(result.value), now],
  );

  return ok({ extractionId: inserted.lastInsertId, extraction: result.value });
}
