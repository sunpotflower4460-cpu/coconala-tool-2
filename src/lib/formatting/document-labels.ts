import type { DocumentStatus } from "@/domain/documents/status";
import type { DocumentType } from "@/domain/documents/types";
import type { TaxCategory } from "@/domain/tax/types";

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  estimate: "見積書",
  invoice: "請求書",
  delivery_note: "納品書",
  receipt: "領収書",
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  draft: "下書き",
  issued: "発行済み",
  approved: "承認済み",
  rejected: "却下",
  invoiced: "請求済み",
  paid: "入金済み",
  cancelled: "取消",
};

export const TAX_CATEGORY_LABELS: Record<TaxCategory, string> = {
  taxable_10: "10%",
  taxable_8: "8%(軽減税率)",
  tax_exempt: "非課税",
};
