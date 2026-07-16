export type DocumentStatus =
  "draft" | "issued" | "approved" | "rejected" | "invoiced" | "paid" | "cancelled";

const ALLOWED_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  draft: ["issued"],
  issued: ["approved", "rejected", "cancelled"],
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
