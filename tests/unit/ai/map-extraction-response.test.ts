import { describe, expect, it } from "vitest";
import { mapExtractionResponse } from "@/infrastructure/ai/map-extraction-response";
import type { RawInquiryExtractionResponse } from "@/infrastructure/ai/schemas/inquiry-extraction.schema";

describe("mapExtractionResponse", () => {
  it("価格表に存在する候補のみ残し、AIの自己申告statusは使わない", () => {
    const raw: RawInquiryExtractionResponse = {
      summary: "動画編集の依頼",
      requested_due_date: "2026-08-01",
      items: [
        {
          source_text: "動画編集を3本",
          normalized_name: "動画編集",
          quantity: 3,
          unit: "本",
          catalog_candidates: [
            { catalog_item_id: 1, confidence: 0.95, reason: "一致" },
            { catalog_item_id: 999, confidence: 0.99, reason: "存在しないID" },
          ],
          status: "matched",
          questions: [],
        },
      ],
      global_questions: [],
    };

    const result = mapExtractionResponse(raw, [
      { id: 1, name: "動画編集", aliases: [], unit: "本" },
    ]);

    expect(result.summary).toBe("動画編集の依頼");
    expect(result.items[0]?.catalogCandidates).toHaveLength(1);
    expect(result.items[0]?.catalogCandidates[0]?.catalogItemId).toBe(1);
    expect(result.items[0]?.status).toBe("matched");
  });

  it("価格表にない依頼はunresolvedになる", () => {
    const raw: RawInquiryExtractionResponse = {
      summary: "不明な依頼",
      requested_due_date: null,
      items: [
        {
          source_text: "特殊な作業",
          normalized_name: "特殊な作業",
          quantity: 1,
          unit: "件",
          catalog_candidates: [],
          questions: ["価格表にありません"],
        },
      ],
      global_questions: [],
    };

    const result = mapExtractionResponse(raw, []);
    expect(result.items[0]?.status).toBe("unresolved");
  });
});
