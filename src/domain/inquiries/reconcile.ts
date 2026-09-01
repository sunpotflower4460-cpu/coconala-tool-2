import type { CatalogCandidate, ExtractedInquiryItem, MatchStatus } from "@/domain/inquiries/types";

const MATCH_CONFIDENCE_THRESHOLD = 0.75;
const MATCH_CONFIDENCE_MARGIN = 0.15;

/**
 * AIが提示した価格表候補を、実在する価格表IDのみに絞り込む。
 * AIが存在しないIDを返した場合(幻覚)、その候補は破棄する。
 */
export function reconcileCatalogCandidates(
  rawCandidates: CatalogCandidate[],
  validCatalogItemIds: ReadonlySet<number>,
): CatalogCandidate[] {
  return rawCandidates
    .filter(
      (candidate) =>
        Number.isInteger(candidate.catalogItemId) &&
        validCatalogItemIds.has(candidate.catalogItemId),
    )
    .map((candidate) => ({
      ...candidate,
      confidence: Number.isFinite(candidate.confidence)
        ? Math.min(1, Math.max(0, candidate.confidence))
        : 0,
    }))
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * AI自身が申告した状態(matched/review/unresolved)は信用せず、
 * DB照合済みの候補と数量・単位の有無から、この関数だけで状態を決める。
 */
export function determineMatchStatus(
  candidates: CatalogCandidate[],
  quantity: number | null,
  unit: string | null,
): MatchStatus {
  if (candidates.length === 0) {
    return "unresolved";
  }
  if (quantity === null || quantity <= 0 || unit === null) {
    return "review";
  }

  const [best, second] = candidates;
  const isClearBest =
    second === undefined || best!.confidence - second.confidence >= MATCH_CONFIDENCE_MARGIN;

  if (best!.confidence >= MATCH_CONFIDENCE_THRESHOLD && isClearBest) {
    return "matched";
  }
  return "review";
}

export interface RawExtractedInquiryItem {
  sourceText: string;
  normalizedName: string;
  quantity: number | null;
  unit: string | null;
  catalogCandidates: CatalogCandidate[];
  questions: string[];
}

export function reconcileExtractedItem(
  raw: RawExtractedInquiryItem,
  validCatalogItemIds: ReadonlySet<number>,
): ExtractedInquiryItem {
  const catalogCandidates = reconcileCatalogCandidates(raw.catalogCandidates, validCatalogItemIds);
  const status = determineMatchStatus(catalogCandidates, raw.quantity, raw.unit);

  return {
    sourceText: raw.sourceText,
    normalizedName: raw.normalizedName,
    quantity: raw.quantity,
    unit: raw.unit,
    catalogCandidates,
    status,
    questions: raw.questions,
  };
}
