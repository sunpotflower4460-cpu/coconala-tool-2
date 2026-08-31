import type {
  DocumentPrintLayoutProps,
  DocumentPrintLine,
} from "@/components/documents/DocumentPrintLayout";
import type { Client } from "@/domain/clients/types";
import type { Company } from "@/domain/shared/company";
import { calculateDocumentTotals } from "@/domain/tax/calculate-document-totals";
import type { TaxCategory } from "@/domain/tax/types";

export type PdfVisualCaseId =
  "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M";

export interface PdfVisualCase {
  id: PdfVisualCaseId;
  title: string;
  /** 印刷エンジンでの実ページ数は人間が確認する。ここは意図した分量の目安。 */
  intendedPageHint: string;
  distinctiveText: string;
  props: DocumentPrintLayoutProps;
}

const BASE_COMPANY: Company = {
  displayName: "印刷確認用工房",
  representativeName: "代表 太郎",
  postalCode: "100-0001",
  address: "東京都千代田区1-1-1",
  phone: "03-1234-5678",
  email: "print-check@example.com",
  invoiceRegistrationNumber: "T1234567890123",
  bankName: "テスト銀行",
  bankBranchName: "本店",
  bankAccountType: "普通",
  bankAccountNumber: "1234567",
  bankAccountHolder: "インサツカクニンヨウコウボウ",
  logoPath: null,
  estimateValidDays: 30,
  paymentDueDays: 30,
  defaultNote: null,
};

const BASE_CLIENT: Client = {
  id: 1,
  name: "印刷確認商事株式会社",
  contactName: "顧客 花子",
  postalCode: "530-0001",
  address: "大阪府大阪市2-2-2",
  phone: "06-1234-5678",
  email: "client-print@example.com",
  note: null,
};

interface LineInput {
  name: string;
  description?: string | null;
  unit?: string | null;
  quantity: number;
  unitPriceYen: number;
  taxCategory?: TaxCategory;
  lineDiscountYen?: number;
}

function buildProps(
  linesInput: LineInput[],
  overrides: Partial<Omit<DocumentPrintLayoutProps, "lines">> = {},
): DocumentPrintLayoutProps {
  const discountYen = overrides.discountYen ?? 0;
  const pricingType = overrides.pricingType ?? "tax_exclusive";
  const totals = calculateDocumentTotals(
    linesInput.map((line) => ({
      quantity: line.quantity,
      unitPriceYen: line.unitPriceYen,
      taxCategory: line.taxCategory ?? "taxable_10",
      lineDiscountYen: line.lineDiscountYen ?? 0,
    })),
    { discountYen, pricingType, roundingMode: "floor" },
  );
  const lines: DocumentPrintLine[] = linesInput.map((line, index) => ({
    name: line.name,
    description: line.description ?? null,
    unit: line.unit ?? "式",
    quantity: line.quantity,
    unitPriceYen: line.unitPriceYen,
    taxCategory: line.taxCategory ?? "taxable_10",
    amountYen: totals.lines[index]?.amountYen ?? 0,
  }));
  return {
    documentType: "estimate",
    documentNumber: "EST-VISUAL",
    status: "issued",
    issueDate: "2026-08-31",
    validUntil: "2026-09-30",
    dueDate: null,
    company: BASE_COMPANY,
    client: BASE_CLIENT,
    pricingType,
    note: null,
    isDraftPreview: false,
    ...overrides,
    lines,
    subtotalYen: totals.subtotalYen,
    taxYen: totals.taxYen,
    totalYen: totals.totalYen,
    taxBreakdown: totals.taxBreakdown,
    discountYen,
  };
}

function numberedLines(count: number, namePrefix: string): LineInput[] {
  return Array.from({ length: count }, (_, index) => ({
    name: `${namePrefix}${index + 1}`,
    quantity: 1,
    unitPriceYen: 1000,
  }));
}

export const PDF_VISUAL_CASES: PdfVisualCase[] = [
  {
    id: "A",
    title: "1ページの短い見積",
    intendedPageHint: "1ページ",
    distinctiveText: "短い見積・基本料金",
    props: buildProps([{ name: "短い見積・基本料金", quantity: 1, unitPriceYen: 10000 }], {
      documentNumber: "EST-A",
    }),
  },
  {
    id: "B",
    title: "2ページ相当の明細",
    intendedPageHint: "おおよそ2ページ",
    distinctiveText: "2ページ確認明細1",
    props: buildProps(numberedLines(35, "2ページ確認明細"), { documentNumber: "EST-B" }),
  },
  {
    id: "C",
    title: "5ページ相当の明細",
    intendedPageHint: "おおよそ5ページ",
    distinctiveText: "5ページ確認明細1",
    props: buildProps(numberedLines(90, "5ページ確認明細"), { documentNumber: "EST-C" }),
  },
  {
    id: "D",
    title: "10ページ相当の明細",
    intendedPageHint: "おおよそ10ページ",
    distinctiveText: "10ページ確認明細1",
    props: buildProps(numberedLines(180, "10ページ確認明細"), { documentNumber: "EST-D" }),
  },
  {
    id: "E",
    title: "非常に長い会社名",
    intendedPageHint: "1ページ(折り返し)",
    distinctiveText: `${"株式会社".repeat(20)}超長社名確認`,
    props: buildProps([{ name: "長い会社名の確認", quantity: 1, unitPriceYen: 8000 }], {
      documentNumber: "EST-E",
      company: {
        ...BASE_COMPANY,
        displayName: `${"株式会社".repeat(20)}超長社名確認`,
      },
    }),
  },
  {
    id: "F",
    title: "非常に長い住所",
    intendedPageHint: "1ページ(折り返し)",
    distinctiveText: `${"東京都千代田区永田町一丁目一番地".repeat(8)}超長住所確認`,
    props: buildProps([{ name: "長い住所の確認", quantity: 1, unitPriceYen: 8000 }], {
      documentNumber: "EST-F",
      company: {
        ...BASE_COMPANY,
        address: `${"東京都千代田区永田町一丁目一番地".repeat(8)}超長住所確認`,
      },
      client: {
        ...BASE_CLIENT,
        address: `${"大阪府大阪市北区梅田".repeat(10)}超長住所確認`,
      },
    }),
  },
  {
    id: "G",
    title: "非常に長い商品名",
    intendedPageHint: "1ページ(折り返し)",
    distinctiveText: `${"超長商品名確認-".repeat(15)}終端`,
    props: buildProps(
      [
        {
          name: `${"超長商品名確認-".repeat(15)}終端`,
          description: "長い品目でも金額列が崩れないこと",
          quantity: 1,
          unitPriceYen: 12000,
        },
      ],
      { documentNumber: "EST-G" },
    ),
  },
  {
    id: "H",
    title: "長文備考",
    intendedPageHint: "1〜2ページ",
    distinctiveText: "長文備考の終端マーカー",
    props: buildProps([{ name: "備考確認の作業", quantity: 1, unitPriceYen: 5000 }], {
      documentNumber: "EST-H",
      note: `${"本見積の備考として、納期・修正回数・素材提供の条件を記載します。".repeat(20)}長文備考の終端マーカー`,
    }),
  },
  {
    id: "I",
    title: "大きな金額",
    intendedPageHint: "1ページ",
    distinctiveText: "高額案件の一式",
    props: buildProps([{ name: "高額案件の一式", quantity: 1, unitPriceYen: 99_999_999 }], {
      documentNumber: "EST-I",
    }),
  },
  {
    id: "J",
    title: "0円項目",
    intendedPageHint: "1ページ",
    distinctiveText: "無償サンプル",
    props: buildProps(
      [
        {
          name: "無償サンプル",
          quantity: 1,
          unitPriceYen: 0,
          taxCategory: "tax_exempt",
        },
        { name: "有償の本体", quantity: 1, unitPriceYen: 3000 },
      ],
      { documentNumber: "EST-J" },
    ),
  },
  {
    id: "K",
    title: "割引",
    intendedPageHint: "1ページ",
    distinctiveText: "値引き対象の作業",
    props: buildProps([{ name: "値引き対象の作業", quantity: 2, unitPriceYen: 10000 }], {
      documentNumber: "EST-K",
      discountYen: 3000,
    }),
  },
  {
    id: "L",
    title: "複数税率",
    intendedPageHint: "1ページ",
    distinctiveText: "標準税率の作業",
    props: buildProps(
      [
        { name: "標準税率の作業", quantity: 1, unitPriceYen: 10000, taxCategory: "taxable_10" },
        { name: "軽減税率の飲食", quantity: 1, unitPriceYen: 800, taxCategory: "taxable_8" },
        { name: "非課税の手数料", quantity: 1, unitPriceYen: 500, taxCategory: "tax_exempt" },
      ],
      { documentNumber: "EST-L" },
    ),
  },
  {
    id: "M",
    title: "日本語・英数字・記号混在",
    intendedPageHint: "1ページ",
    distinctiveText: "Mix確認: 日本語 ABC 123 !?@#&% 「」【】",
    props: buildProps(
      [
        {
          name: "Mix確認: 日本語 ABC 123 !?@#&% 「」【】",
          description: "SKU-0001 / ver.2.0 (beta)",
          quantity: 3,
          unitPriceYen: 2500,
          unit: "本",
        },
      ],
      {
        documentNumber: "EST-M",
        company: { ...BASE_COMPANY, displayName: "PrintCheck Studio / 印刷確認用工房" },
        client: { ...BASE_CLIENT, name: "ACME Corp.（アクメ）" },
      },
    ),
  },
];
