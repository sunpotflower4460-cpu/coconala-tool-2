import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DocumentPrintLayout,
  type DocumentPrintLayoutProps,
} from "@/components/documents/DocumentPrintLayout";
import type { Company } from "@/domain/shared/company";
import type { Client } from "@/domain/clients/types";

const BASE_COMPANY: Company = {
  displayName: "テスト工房",
  representativeName: "代表 太郎",
  postalCode: "100-0001",
  address: "東京都千代田区1-1-1",
  phone: "03-1234-5678",
  email: "info@example.com",
  invoiceRegistrationNumber: "T1234567890123",
  bankName: "テスト銀行",
  bankBranchName: "本店",
  bankAccountType: "普通",
  bankAccountNumber: "1234567",
  bankAccountHolder: "テストコウボウ",
  logoPath: null,
  estimateValidDays: 30,
  paymentDueDays: 30,
  defaultNote: null,
};

const BASE_CLIENT: Client = {
  id: 1,
  name: "テスト商事株式会社",
  contactName: "顧客 花子",
  postalCode: "530-0001",
  address: "大阪府大阪市2-2-2",
  phone: "06-1234-5678",
  email: "client@example.com",
  note: null,
};

function baseProps(overrides: Partial<DocumentPrintLayoutProps> = {}): DocumentPrintLayoutProps {
  return {
    documentType: "estimate",
    documentNumber: "EST-0001",
    status: "draft",
    issueDate: "2026-07-22",
    validUntil: "2026-08-21",
    dueDate: null,
    company: BASE_COMPANY,
    client: BASE_CLIENT,
    pricingType: "tax_exclusive",
    lines: [
      {
        name: "動画編集",
        description: "基本料金",
        unit: "式",
        quantity: 1,
        unitPriceYen: 10000,
        taxCategory: "taxable_10",
        amountYen: 10000,
      },
    ],
    subtotalYen: 10000,
    taxYen: 1000,
    totalYen: 11000,
    taxBreakdown: [{ taxCategory: "taxable_10", taxableAmountYen: 10000, taxYen: 1000 }],
    discountYen: 0,
    note: null,
    isDraftPreview: true,
    ...overrides,
  };
}

describe("DocumentPrintLayout", () => {
  it("会社・顧客の郵便番号を表示する", () => {
    render(<DocumentPrintLayout {...baseProps()} />);
    expect(screen.getByText("〒100-0001")).toBeInTheDocument();
    expect(screen.getByText("〒530-0001")).toBeInTheDocument();
  });

  it("顧客の担当者名を「様」付きで表示する", () => {
    render(<DocumentPrintLayout {...baseProps()} />);
    expect(screen.getByText("顧客 花子 様")).toBeInTheDocument();
  });

  it("担当者名が未登録の場合は表示しない", () => {
    render(
      <DocumentPrintLayout {...baseProps({ client: { ...BASE_CLIENT, contactName: null } })} />,
    );
    expect(screen.queryByText(/様$/)).not.toBeInTheDocument();
  });

  it("会社のメールアドレスを表示する", () => {
    render(<DocumentPrintLayout {...baseProps()} />);
    expect(screen.getByText("Email: info@example.com")).toBeInTheDocument();
  });

  it("郵便番号・メールが未登録の場合は表示しない", () => {
    render(
      <DocumentPrintLayout
        {...baseProps({
          company: { ...BASE_COMPANY, postalCode: null, email: null },
          client: { ...BASE_CLIENT, postalCode: null },
        })}
      />,
    );
    expect(screen.queryByText(/〒/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Email:/)).not.toBeInTheDocument();
  });

  it("下書きプレビューの場合は透かしを表示する", () => {
    render(<DocumentPrintLayout {...baseProps({ isDraftPreview: true })} />);
    expect(screen.getByText("下書きプレビュー(未発行)")).toBeInTheDocument();
  });

  it("発行済みの場合は透かしを表示しない", () => {
    render(<DocumentPrintLayout {...baseProps({ isDraftPreview: false })} />);
    expect(screen.queryByText("下書きプレビュー(未発行)")).not.toBeInTheDocument();
  });

  it("税率ごとの内訳を表示する(複数税率)", () => {
    render(
      <DocumentPrintLayout
        {...baseProps({
          lines: [
            {
              name: "動画編集",
              description: null,
              unit: null,
              quantity: 1,
              unitPriceYen: 10000,
              taxCategory: "taxable_10",
              amountYen: 10000,
            },
            {
              name: "飲食代",
              description: null,
              unit: null,
              quantity: 1,
              unitPriceYen: 1000,
              taxCategory: "taxable_8",
              amountYen: 1000,
            },
          ],
          taxBreakdown: [
            { taxCategory: "taxable_10", taxableAmountYen: 10000, taxYen: 1000 },
            { taxCategory: "taxable_8", taxableAmountYen: 1000, taxYen: 80 },
          ],
        })}
      />,
    );
    expect(screen.getByText("消費税(10%)")).toBeInTheDocument();
    expect(screen.getByText("消費税(8%(軽減税率))")).toBeInTheDocument();
  });

  it("0円の明細でも金額表示が崩れない", () => {
    render(
      <DocumentPrintLayout
        {...baseProps({
          lines: [
            {
              name: "無料サンプル",
              description: null,
              unit: null,
              quantity: 1,
              unitPriceYen: 0,
              taxCategory: "tax_exempt",
              amountYen: 0,
            },
          ],
          subtotalYen: 0,
          taxYen: 0,
          totalYen: 0,
          taxBreakdown: [],
        })}
      />,
    );
    expect(screen.getAllByText("￥0").length).toBeGreaterThan(0);
  });

  it("全体値引きがある場合はマイナス表記で表示する", () => {
    render(<DocumentPrintLayout {...baseProps({ discountYen: 500 })} />);
    expect(screen.getByText("-￥500")).toBeInTheDocument();
  });

  it("全体値引きが0の場合は値引き行を表示しない", () => {
    render(<DocumentPrintLayout {...baseProps({ discountYen: 0 })} />);
    expect(screen.queryByText("値引き")).not.toBeInTheDocument();
  });

  it("長い会社名・住所でも描画できる(折り返しはCSS側で処理する)", () => {
    const longText = "とても".repeat(60) + "長い名前株式会社";
    render(
      <DocumentPrintLayout
        {...baseProps({
          company: { ...BASE_COMPANY, displayName: longText, address: longText },
        })}
      />,
    );
    expect(screen.getAllByText(longText).length).toBeGreaterThan(0);
  });

  it("書類種別ごとに正しい見出しを表示する", () => {
    const { rerender } = render(
      <DocumentPrintLayout {...baseProps({ documentType: "estimate" })} />,
    );
    expect(screen.getByRole("heading", { name: "見積書" })).toBeInTheDocument();

    rerender(<DocumentPrintLayout {...baseProps({ documentType: "invoice" })} />);
    expect(screen.getByRole("heading", { name: "請求書" })).toBeInTheDocument();

    rerender(<DocumentPrintLayout {...baseProps({ documentType: "delivery_note" })} />);
    expect(screen.getByRole("heading", { name: "納品書" })).toBeInTheDocument();

    rerender(<DocumentPrintLayout {...baseProps({ documentType: "receipt" })} />);
    expect(screen.getByRole("heading", { name: "領収書" })).toBeInTheDocument();
  });

  it("備考がある場合は備考欄を表示する", () => {
    render(<DocumentPrintLayout {...baseProps({ note: "特記事項です" })} />);
    expect(screen.getByText("特記事項です")).toBeInTheDocument();
  });

  it("振込先情報を表示する", () => {
    render(<DocumentPrintLayout {...baseProps()} />);
    expect(
      screen.getByText("振込先: テスト銀行 本店 普通 1234567 テストコウボウ"),
    ).toBeInTheDocument();
  });
});
