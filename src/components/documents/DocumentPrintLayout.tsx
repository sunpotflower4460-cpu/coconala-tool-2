import type { Client } from "@/domain/clients/types";
import type { DocumentStatus } from "@/domain/documents/status";
import type { DocumentType } from "@/domain/documents/types";
import {
  buildTotalsSummaryRows,
  PRINT_TAX_RATE_LABELS,
  REDUCED_TAX_RATE_LEGEND,
} from "@/domain/documents/totals-summary";
import type { Company } from "@/domain/shared/company";
import type { PricingType, TaxCategory, TaxGroupTotal } from "@/domain/tax/types";
import { DOCUMENT_TYPE_LABELS } from "@/lib/formatting/document-labels";
import { formatYen } from "@/lib/formatting/money";

export interface DocumentPrintLine {
  name: string;
  description: string | null;
  unit: string | null;
  quantity: number;
  unitPriceYen: number;
  taxCategory: TaxCategory;
  /**
   * 明細値引き後・全体値引き按分前の金額(calculateDocumentTotals の rawAmountYen)。
   * 全体値引きは合計欄の「値引き」行だけで表し、明細の金額には混ぜない。
   */
  amountYen: number;
  /** 明細値引き(円)。0または未指定なら表示しない */
  lineDiscountYen?: number;
}

export interface DocumentPrintLayoutProps {
  documentType: DocumentType;
  documentNumber: string | null;
  status: DocumentStatus;
  issueDate: string | null;
  validUntil: string | null;
  dueDate: string | null;
  company: Company;
  client: Client;
  pricingType: PricingType;
  lines: DocumentPrintLine[];
  subtotalYen: number;
  taxYen: number;
  totalYen: number;
  taxBreakdown: TaxGroupTotal[];
  discountYen: number;
  note: string | null;
  isDraftPreview: boolean;
  /**
   * ライセンス未登録のとき true。印刷物に「未認証版」を重ねて表示する(表示だけ。
   * 発行済みスナップショットには含めないので、登録後に再印刷すれば透かしは消える。ADR 0009)。
   */
  unlicensedWatermark?: boolean;
}

export function DocumentPrintLayout({
  documentType,
  documentNumber,
  issueDate,
  validUntil,
  dueDate,
  company,
  client,
  pricingType,
  lines,
  subtotalYen,
  totalYen,
  taxBreakdown,
  discountYen,
  note,
  isDraftPreview,
  unlicensedWatermark = false,
}: DocumentPrintLayoutProps) {
  const summaryRows = buildTotalsSummaryRows({
    pricingType,
    subtotalYen,
    totalYen,
    discountYen,
    taxBreakdown,
  });
  const hasReducedRate = lines.some((line) => line.taxCategory === "taxable_8");

  return (
    <div className="print-page">
      {unlicensedWatermark && (
        <div className="license-watermark" aria-hidden="true">
          未認証版
        </div>
      )}
      {isDraftPreview && <p className="draft-watermark">下書きプレビュー(未発行)</p>}

      <header className="print-header">
        <h1>{DOCUMENT_TYPE_LABELS[documentType]}</h1>
        <dl className="print-meta">
          {documentNumber && (
            <>
              <dt>書類番号</dt>
              <dd>{documentNumber}</dd>
            </>
          )}
          {issueDate && (
            <>
              <dt>発行日</dt>
              <dd>{issueDate}</dd>
            </>
          )}
          {validUntil && (
            <>
              <dt>有効期限</dt>
              <dd>{validUntil}</dd>
            </>
          )}
          {dueDate && (
            <>
              <dt>お支払期限</dt>
              <dd>{dueDate}</dd>
            </>
          )}
        </dl>
      </header>

      <div className="print-parties">
        <div className="print-client">
          <p className="print-client-name">{client.name} 御中</p>
          {client.contactName && <p>{client.contactName} 様</p>}
          {client.postalCode && <p>〒{client.postalCode}</p>}
          {client.address && <p>{client.address}</p>}
        </div>
        <div className="print-company">
          <p className="print-company-name">{company.displayName}</p>
          {company.representativeName && <p>{company.representativeName}</p>}
          {company.postalCode && <p>〒{company.postalCode}</p>}
          {company.address && <p>{company.address}</p>}
          {company.phone && <p>TEL: {company.phone}</p>}
          {company.email && <p>Email: {company.email}</p>}
          {company.invoiceRegistrationNumber && (
            <p>登録番号: {company.invoiceRegistrationNumber}</p>
          )}
          {company.bankName && (
            <p>
              振込先: {company.bankName} {company.bankBranchName} {company.bankAccountType}{" "}
              {company.bankAccountNumber} {company.bankAccountHolder}
            </p>
          )}
        </div>
      </div>

      <p className="print-total-highlight">合計金額(税込): {formatYen(totalYen)}</p>

      <table className="print-lines">
        <thead>
          <tr>
            <th>品目</th>
            <th>数量</th>
            <th>単価</th>
            <th>税区分</th>
            <th>金額</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={`${line.name}-${index}`}>
              <td>
                {line.name}
                {line.description && (
                  <div className="print-line-description">{line.description}</div>
                )}
                {(line.lineDiscountYen ?? 0) > 0 && (
                  <div className="print-line-description">
                    明細値引き -{formatYen(line.lineDiscountYen ?? 0)}
                  </div>
                )}
              </td>
              <td>
                {line.quantity}
                {line.unit ?? ""}
              </td>
              <td>{formatYen(line.unitPriceYen)}</td>
              <td>{PRINT_TAX_RATE_LABELS[line.taxCategory]}</td>
              <td>{formatYen(line.amountYen)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {hasReducedRate && <p className="print-tax-legend">{REDUCED_TAX_RATE_LEGEND}</p>}

      <table className="print-totals">
        <tbody>
          {summaryRows.map((row) => (
            <tr
              key={`${row.kind}-${row.taxCategory ?? ""}`}
              className={
                row.kind === "total"
                  ? "print-total-row"
                  : row.kind === "taxable_base" || row.kind === "included_tax"
                    ? "print-totals-reference"
                    : undefined
              }
            >
              <th>{row.label}</th>
              <td>
                {row.amountYen < 0 ? `-${formatYen(-row.amountYen)}` : formatYen(row.amountYen)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {note && (
        <div className="print-note">
          <h2>備考</h2>
          <p>{note}</p>
        </div>
      )}
      {unlicensedWatermark && (
        <p className="license-watermark-footer">
          この書類は未認証版の見積・請求書デスクで作成されました。
        </p>
      )}
    </div>
  );
}
