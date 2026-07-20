import type { DocumentStatus } from "@/domain/documents/status";
import type { DocumentType } from "@/domain/documents/types";

const ALLOWED_CONVERSIONS: Record<DocumentType, DocumentType[]> = {
  estimate: ["invoice", "delivery_note"],
  invoice: ["receipt"],
  delivery_note: [],
  receipt: [],
};

/** 変換元の書類状態(発行後のみ変換できる)。 */
const CONVERTIBLE_STATUSES: DocumentStatus[] = ["issued", "approved", "invoiced", "paid"];

export function canConvertDocument(from: DocumentType, to: DocumentType): boolean {
  return ALLOWED_CONVERSIONS[from].includes(to);
}

export function isConvertibleStatus(status: DocumentStatus): boolean {
  return CONVERTIBLE_STATUSES.includes(status);
}
