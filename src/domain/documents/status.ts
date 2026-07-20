export type DocumentStatus =
  "draft" | "issued" | "approved" | "rejected" | "invoiced" | "paid" | "cancelled";

const ALLOWED_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  draft: ["issued"],
  // 見積は issued→approved→invoiced と進み、請求書は issued→paid と直接進む(共通のstatusを使い回すため)。
  issued: ["approved", "rejected", "paid", "cancelled"],
  approved: ["invoiced", "cancelled"],
  rejected: ["draft", "cancelled"],
  invoiced: ["paid", "cancelled"],
  paid: [],
  cancelled: [],
};

export function canTransitionDocumentStatus(from: DocumentStatus, to: DocumentStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isEditableStatus(status: DocumentStatus): boolean {
  return status === "draft";
}
