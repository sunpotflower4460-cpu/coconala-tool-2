export interface CsvFieldSpec {
  key: string;
  label: string;
  csvHeader: string;
  required: boolean;
}

export const CLIENT_CSV_FIELDS: CsvFieldSpec[] = [
  { key: "name", label: "顧客名", csvHeader: "顧客名", required: true },
  { key: "contactName", label: "担当者名", csvHeader: "担当者名", required: false },
  { key: "postalCode", label: "郵便番号", csvHeader: "郵便番号", required: false },
  { key: "address", label: "住所", csvHeader: "住所", required: false },
  { key: "phone", label: "電話番号", csvHeader: "電話番号", required: false },
  { key: "email", label: "メールアドレス", csvHeader: "メールアドレス", required: false },
  { key: "note", label: "備考", csvHeader: "備考", required: false },
];

export const CATALOG_ITEM_CSV_FIELDS: CsvFieldSpec[] = [
  { key: "name", label: "商品名", csvHeader: "商品名", required: true },
  { key: "unit", label: "単位", csvHeader: "単位", required: false },
  { key: "unitPriceYen", label: "単価(円)", csvHeader: "単価", required: true },
  {
    key: "taxCategory",
    label: "税区分(taxable_10/taxable_8/tax_exempt。空欄はtaxable_10)",
    csvHeader: "税区分",
    required: false,
  },
];

export function buildSampleCsv(fields: CsvFieldSpec[], sampleRow: string[]): string {
  const header = fields.map((field) => field.csvHeader).join(",");
  const row = sampleRow.join(",");
  return `${header}\n${row}\n`;
}

// 見本CSVの列名と完全一致(大文字小文字を区別しない)する場合は、自動でマッピングする。
export function guessColumnMapping(
  header: string[],
  fields: CsvFieldSpec[],
): Record<string, number | null> {
  const mapping: Record<string, number | null> = {};
  for (const field of fields) {
    const index = header.findIndex(
      (column) => column.trim().toLowerCase() === field.csvHeader.toLowerCase(),
    );
    mapping[field.key] = index >= 0 ? index : null;
  }
  return mapping;
}
