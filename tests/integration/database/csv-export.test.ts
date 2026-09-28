import { beforeEach, describe, expect, it } from "vitest";
import { createCatalogItem } from "@/application/commands/catalog-item.commands";
import { createClient } from "@/application/commands/client.commands";
import { exportCsv } from "@/application/commands/export-csv.command";
import { issueDocument } from "@/application/commands/issue-document.command";
import { saveCompany } from "@/application/commands/save-company.command";
import { saveEstimateDraft } from "@/application/commands/save-estimate-draft.command";
import { updateClient } from "@/application/commands/client.commands";
import type { DatabasePort } from "@/application/ports/database";
import { decodeCsvBytes } from "@/domain/csv/encoding";
import {
  CATALOG_ITEM_CSV_FIELDS,
  CLIENT_CSV_FIELDS,
  guessColumnMapping,
} from "@/domain/csv/fields";
import { parseCsv } from "@/domain/csv/parse";
import { validateCatalogItemRows } from "@/domain/csv/validate-catalog-item-rows";
import { validateClientRows } from "@/domain/csv/validate-client-rows";
import { createFakeFileExport } from "@/lib/test-utils/fake-file-export";
import { createTestDatabase } from "@/lib/test-utils/sqlite";

function readBack(content: string): string[][] {
  const bytes = new TextEncoder().encode(content);
  return parseCsv(decodeCsvBytes(bytes).text);
}

describe("CSV書き出し", () => {
  let db: DatabasePort;
  beforeEach(() => {
    db = createTestDatabase();
  });

  it("顧客CSVはそのままCSV取り込みの検証を通る(読み戻せる)", async () => {
    await createClient(db, {
      name: "株式会社サンプル, 本社",
      contactName: "山田",
      postalCode: "100-0001",
      address: "東京都千代田区",
      phone: "03-0000-0000",
      email: "info@example.com",
      note: "=危険な式",
    });
    const fileExport = createFakeFileExport();
    const result = await exportCsv(db, fileExport, "clients", new Date(2026, 9, 1));
    expect(result.ok).toBe(true);
    const saved = fileExport.saved[0]!;
    expect(saved.path).toMatch(/顧客一覧-.*\.csv$/);
    const [header, ...rows] = readBack(saved.content);
    const mapping = guessColumnMapping(header!, CLIENT_CSV_FIELDS);
    const validated = validateClientRows(rows, mapping);
    expect(validated.every((row) => row.errors.length === 0)).toBe(true);
    expect(rows[0]?.[0]).toBe("株式会社サンプル, 本社");
    expect(rows[0]?.[6]).toBe("'=危険な式");
  });

  it("価格表CSVは単価・税区分を取り込み可能な形で出す", async () => {
    await createCatalogItem(db, {
      name: "動画編集",
      description: null,
      unit: "本",
      unitPriceYen: 30000,
      costPriceYen: null,
      taxCategory: "taxable_8",
      minQuantity: null,
      isActive: true,
    });
    const fileExport = createFakeFileExport();
    await exportCsv(db, fileExport, "catalog");
    const [header, ...rows] = readBack(fileExport.saved[0]!.content);
    const mapping = guessColumnMapping(header!, CATALOG_ITEM_CSV_FIELDS);
    const validated = validateCatalogItemRows(rows, mapping);
    expect(validated[0]?.errors).toEqual([]);
    expect(rows[0]?.slice(0, 4)).toEqual(["動画編集", "本", "30000", "taxable_8"]);
  });

  it("書類一覧は発行済みだけを、発行時の顧客名・税率別の金額で出す", async () => {
    await saveCompany(db, {
      displayName: "自社",
      representativeName: null,
      postalCode: null,
      address: null,
      phone: null,
      email: null,
      invoiceRegistrationNumber: null,
      bankName: null,
      bankBranchName: null,
      bankAccountType: null,
      bankAccountNumber: null,
      bankAccountHolder: null,
      logoPath: null,
      estimateValidDays: null,
      paymentDueDays: null,
      defaultNote: null,
    });
    const client = await createClient(db, {
      name: "発行時の名前",
      contactName: null,
      postalCode: null,
      address: null,
      phone: null,
      email: null,
      note: null,
    });
    if (!client.ok) throw new Error("unexpected");
    const input = {
      id: null,
      clientId: client.value.id,
      issueDate: "2026-07-16",
      dueDate: null,
      validUntil: null,
      pricingType: "tax_exclusive" as const,
      discountYen: 0,
      note: null,
      lines: [
        {
          catalogItemId: null,
          name: "作業",
          description: null,
          unit: null,
          quantity: 1,
          unitPriceYen: 10000,
          taxCategory: "taxable_10" as const,
          lineDiscountYen: 0,
        },
        {
          catalogItemId: null,
          name: "飲食",
          description: null,
          unit: null,
          quantity: 1,
          unitPriceYen: 1000,
          taxCategory: "taxable_8" as const,
          lineDiscountYen: 0,
        },
      ],
    };
    const issued = await saveEstimateDraft(db, input);
    const draftOnly = await saveEstimateDraft(db, input);
    if (!issued.ok || !draftOnly.ok) throw new Error("unexpected");
    const issueResult = await issueDocument(db, issued.value.header.id!);
    if (!issueResult.ok) throw new Error(issueResult.error.message);
    await updateClient(db, client.value.id, {
      name: "変更後の名前",
      contactName: null,
      postalCode: null,
      address: null,
      phone: null,
      email: null,
      note: null,
    });

    const fileExport = createFakeFileExport();
    await exportCsv(db, fileExport, "documents");
    const [header, ...rows] = readBack(fileExport.saved[0]!.content);
    expect(rows).toHaveLength(1);
    const row = Object.fromEntries(header!.map((key, index) => [key, rows[0]![index]]));
    expect(row["顧客名"]).toBe("発行時の名前");
    expect(row["種別"]).toBe("見積書");
    expect(row["10%対象"]).toBe("10000");
    expect(row["10%消費税"]).toBe("1000");
    expect(row["8%対象"]).toBe("1000");
    expect(row["8%消費税"]).toBe("80");
    expect(row["合計"]).toBe("12080");
  });

  it("保存ダイアログでキャンセルしたら null を返す", async () => {
    const result = await exportCsv(db, { saveTextFile: () => Promise.resolve(null) }, "clients");
    expect(result).toEqual({ ok: true, value: null });
  });
});
