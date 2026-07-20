import type { Client } from "@/domain/clients/types";
import type { DocumentStatus } from "@/domain/documents/status";
import type { DocumentType } from "@/domain/documents/types";
import type { Company } from "@/domain/shared/company";
import type { PricingType, TaxCategory, TaxGroupTotal } from "@/domain/tax/types";
import { DOCUMENT_TYPE_LABELS, TAX_CATEGORY_LABELS } from "@/lib/formatting/document-labels";
import { formatYen } from "@/lib/formatting/money";

export interface DocumentPrintLine {
  name: string;
  description: string | null;
  unit: string | null;
  quantity: number;
  unitPriceYen: number;
  taxCategory: TaxCategory;
  amountYen: number;
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
}

export function DocumentPrintLayout({
  documentType,
  documentNumber,
  issueDate,
  validUntil,
  dueDate,
  company,
  client,
  lines,
  subtotalYen,
  totalYen,
  taxBreakdown,
  discountYen,
  note,
  isDraftPreview,
}: DocumentPrintLayoutProps) {
  return (
    <div className="print-page">
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
          {client.address && <p>{client.address}</p>}
        </div>
        <div className="print-company">
          <p className="print-company-name">{company.displayName}</p>
          {company.representativeName && <p>{company.representativeName}</p>}
          {company.address && <p>{company.address}</p>}
          {company.phone && <p>TEL: {company.phone}</p>}
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

      <p className="print-total-highlight">合計金額: {formatYen(totalYen)}</p>

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
              </td>
              <td>
                {line.quantity}
                {line.unit ?? ""}
              </td>
              <td>{formatYen(line.unitPriceYen)}</td>
              <td>{TAX_CATEGORY_LABELS[line.taxCategory]}</td>
              <td>{formatYen(line.amountYen)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="print-totals">
        <tbody>
          <tr>
            <th>小計</th>
            <td>{formatYen(subtotalYen)}</td>
          </tr>
          {discountYen > 0 && (
            <tr>
              <th>値引き</th>
              <td>-{formatYen(discountYen)}</td>
            </tr>
          )}
          {taxBreakdown.map((group) => (
            <tr key={group.taxCategory}>
              <th>消費税({TAX_CATEGORY_LABELS[group.taxCategory]})</th>
              <td>{formatYen(group.taxYen)}</td>
            </tr>
          ))}
          <tr className="print-total-row">
            <th>合計</th>
            <td>{formatYen(totalYen)}</td>
          </tr>
        </tbody>
      </table>

      {note && (
        <div className="print-note">
          <h2>備考</h2>
          <p>{note}</p>
        </div>
      )}
    </div>
  );
}
