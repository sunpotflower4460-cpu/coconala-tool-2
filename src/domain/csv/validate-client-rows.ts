import type { ClientInput } from "@/domain/clients/types";
import { readCell, type ColumnMapping, type CsvRowIssue } from "@/domain/csv/types";

export function validateClientRows(
  dataRows: string[][],
  mapping: ColumnMapping,
): CsvRowIssue<ClientInput>[] {
  return dataRows.map((raw, rowIndex) => {
    const errors: string[] = [];
    const name = readCell(raw, mapping, "name");
    if (!name) {
      errors.push("顧客名が空です");
    }
    const email = readCell(raw, mapping, "email");
    if (email && !email.includes("@")) {
      errors.push("メールアドレスの形式が正しくありません");
    }

    if (errors.length > 0) {
      return { rowIndex, raw, data: null, errors };
    }

    return {
      rowIndex,
      raw,
      errors: [],
      data: {
        name: name!,
        contactName: readCell(raw, mapping, "contactName"),
        postalCode: readCell(raw, mapping, "postalCode"),
        address: readCell(raw, mapping, "address"),
        phone: readCell(raw, mapping, "phone"),
        email,
        note: readCell(raw, mapping, "note"),
      },
    };
  });
}
