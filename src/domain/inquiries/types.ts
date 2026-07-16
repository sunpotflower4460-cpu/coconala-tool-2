export type MatchStatus = "matched" | "review" | "unresolved";

export interface CatalogCandidate {
  catalogItemId: number;
  confidence: number;
  reason: string;
}

export interface ExtractedInquiryItem {
  sourceText: string;
  normalizedName: string;
  quantity: number | null;
  unit: string | null;
  catalogCandidates: CatalogCandidate[];
  status: MatchStatus;
  questions: string[];
}

export interface ExtractedInquiry {
  summary: string;
  requestedDueDate: string | null;
  items: ExtractedInquiryItem[];
  globalQuestions: string[];
}
