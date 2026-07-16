import type { CatalogItemForExtraction } from "@/application/ports/ai-provider";
import { reconcileExtractedItem } from "@/domain/inquiries/reconcile";
import type { ExtractedInquiry } from "@/domain/inquiries/types";
import type { RawInquiryExtractionResponse } from "@/infrastructure/ai/schemas/inquiry-extraction.schema";

export function mapExtractionResponse(
  raw: RawInquiryExtractionResponse,
  catalogItems: CatalogItemForExtraction[],
): ExtractedInquiry {
  const validCatalogItemIds = new Set(catalogItems.map((item) => item.id));

  return {
    summary: raw.summary,
    requestedDueDate: raw.requested_due_date,
    items: raw.items.map((item) =>
      reconcileExtractedItem(
        {
          sourceText: item.source_text,
          normalizedName: item.normalized_name,
          quantity: item.quantity,
          unit: item.unit,
          catalogCandidates: item.catalog_candidates.map((candidate) => ({
            catalogItemId: candidate.catalog_item_id,
            confidence: candidate.confidence,
            reason: candidate.reason,
          })),
          questions: item.questions,
        },
        validCatalogItemIds,
      ),
    ),
    globalQuestions: raw.global_questions,
  };
}
