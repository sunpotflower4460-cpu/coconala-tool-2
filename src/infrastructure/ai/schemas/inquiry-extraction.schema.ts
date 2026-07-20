import { z } from "zod";

/**
 * AIの応答は未検証の外部入力として扱い、必ずこのスキーマで検証してから使う。
 * `status`はAIの自己申告であり信用しない(domain/inquiries/reconcileで再計算する)ため、
 * パース対象には含めるが呼び出し側では無視する。
 */
export const catalogCandidateSchema = z.object({
  catalog_item_id: z.union([z.number(), z.string()]).transform((value) => Number(value)),
  confidence: z.number(),
  reason: z.string().default(""),
});

export const extractedInquiryItemSchema = z.object({
  source_text: z.string(),
  normalized_name: z.string(),
  quantity: z.number().nullable().default(null),
  unit: z.string().nullable().default(null),
  catalog_candidates: z.array(catalogCandidateSchema).default([]),
  status: z.enum(["matched", "review", "unresolved"]).optional(),
  questions: z.array(z.string()).default([]),
});

export const inquiryExtractionSchema = z.object({
  summary: z.string(),
  requested_due_date: z.string().nullable().default(null),
  items: z.array(extractedInquiryItemSchema).default([]),
  global_questions: z.array(z.string()).default([]),
});

export type RawInquiryExtractionResponse = z.infer<typeof inquiryExtractionSchema>;
