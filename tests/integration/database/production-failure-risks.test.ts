import { beforeEach, describe, expect, it } from "vitest";
import { buildDiagnosticsReport } from "@/application/commands/build-diagnostics-report.command";
import {
  createCatalogItem,
  deleteCatalogItem,
  updateCatalogItem,
} from "@/application/commands/catalog-item.commands";
import { createClient, deleteClient, updateClient } from "@/application/commands/client.commands";
import { convertDocument } from "@/application/commands/convert-document.command";
import { importCatalogItemsCsv } from "@/application/commands/import-catalog-items-csv.command";
import { issueDocument } from "@/application/commands/issue-document.command";
import { saveCompany } from "@/application/commands/save-company.command";
import { saveEstimateDraft } from "@/application/commands/save-estimate-draft.command";
import { updateDocumentStatus } from "@/application/commands/update-document-status.command";
import { getDocument } from "@/application/queries/get-document.query";
import { listCatalogItems } from "@/application/queries/list-catalog-items.query";
import { listDocumentEvents } from "@/application/queries/list-document-events.query";
import { listDocuments } from "@/application/queries/list-documents.query";
import type { DatabasePort } from "@/application/ports/database";
import { CATALOG_ITEM_CSV_FIELDS, guessColumnMapping } from "@/domain/csv/fields";
import { parseCsv } from "@/domain/csv/parse";
import { validateCatalogItemRows } from "@/domain/csv/validate-catalog-item-rows";
import type { CompanyInput } from "@/domain/shared/company";
import { createFakeSystemInfoProvider } from "@/lib/test-utils/fake-system-info-provider";
import { createTestDatabase } from "@/lib/test-utils/sqlite";

const sampleCompany: CompanyInput = {
  displayName: "サンプル制作合同会社",
  representativeName: "山田太郎",
  postalCode: null,
  address: "東京都千代田区1-1-1",
  phone: null,
  email: "owner@example.com",
  invoiceRegistrationNumber: null,
  bankName: "みずほ銀行",
  bankBranchName: null,
  bankAccountType: null,
  bankAccountNumber: "1234567",
  bankAccountHolder: null,
  logoPath: null,
  estimateValidDays: 30,
  paymentDueDays: 30,
  defaultNote: null,
};

async function seedDraftEstimate(
  db: DatabasePort,
  options?: { lineName?: string; quantity?: number; unitPriceYen?: number },
) {
  await saveCompany(db, sampleCompany);
  const client = await createClient(db, {
    name: "サンプル株式会社",
    contactName: null,
    postalCode: null,
    address: null,
    phone: null,
    email: "client@example.com",
    note: null,
  });
  if (!client.ok) throw new Error("unexpected client");

  const draft = await saveEstimateDraft(db, {
    id: null,
    clientId: client.value.id,
    issueDate: "2026-07-16",
    dueDate: null,
    validUntil: "2026-08-15",
    pricingType: "tax_exclusive",
    discountYen: 0,
    note: null,
    lines: [
      {
        catalogItemId: null,
        name: options?.lineName ?? "動画編集",
        description: null,
        unit: "本",
        quantity: options?.quantity ?? 2,
        unitPriceYen: options?.unitPriceYen ?? 30000,
        taxCategory: "taxable_10",
        lineDiscountYen: 0,
      },
    ],
  });
  if (!draft.ok) throw new Error("unexpected draft");
  return { clientId: client.value.id, documentId: draft.value.header.id! };
}

describe("CONC-01 同一書類の同時発行は1回だけ成功する", () => {
  it("Promise.all で二重発行しても issued は1件、番号は一意、履歴の issue は1件", async () => {
    const db = createTestDatabase();
    const { documentId } = await seedDraftEstimate(db);

    const [first, second] = await Promise.all([
      issueDocument(db, documentId),
      issueDocument(db, documentId),
    ]);
    const outcomes = [first, second];
    const succeeded = outcomes.filter((result) => result.ok);
    const failed = outcomes.filter((result) => !result.ok);

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    if (!failed[0]?.ok) expect(failed[0]?.error.code).toBe("not_issuable");
    if (!failed[0]?.ok) expect(failed[0]?.error.message).not.toMatch(/SQLITE_/);

    const issued = await getDocument(db, documentId);
    expect(issued?.status).toBe("issued");
    expect(issued?.documentNumber).toBe("EST-2026-0001");
    expect(issued?.lines).toHaveLength(1);

    const events = await listDocumentEvents(db, documentId);
    expect(events.filter((event) => event.eventType === "issue")).toHaveLength(1);
  });
});

describe("CONC-02 別書類の同時発行でも番号は一意", () => {
  it("2件同時発行後、採番が重複せず少なくとも1件は成功する", async () => {
    const db = createTestDatabase();
    const first = await seedDraftEstimate(db);
    const second = await seedDraftEstimate(db);

    const results = await Promise.all([
      issueDocument(db, first.documentId),
      issueDocument(db, second.documentId),
    ]);
    const numbers = results
      .filter((result) => result.ok)
      .map((result) => (result.ok ? result.value.documentNumber : null));

    expect(numbers.length).toBeGreaterThanOrEqual(1);
    expect(new Set(numbers).size).toBe(numbers.length);

    const allNumbers = await db.select<{ document_number: string }>(
      `SELECT document_number FROM documents WHERE document_number IS NOT NULL`,
    );
    const values = allNumbers.map((row) => row.document_number);
    expect(new Set(values).size).toBe(values.length);

    for (const result of results) {
      if (!result.ok) {
        expect(result.error.message).not.toMatch(/SQLITE_|UNIQUE constraint/i);
      }
    }
  });
});

describe("CONC-03 発行と下書き保存の競合で発行済み明細を消さない", () => {
  let db: DatabasePort;

  beforeEach(() => {
    db = createTestDatabase();
  });

  it("発行済み書類を保存しようとすると not_editable になり、明細もスナップショットも残る", async () => {
    const { documentId } = await seedDraftEstimate(db);
    const issued = await issueDocument(db, documentId);
    expect(issued.ok).toBe(true);

    const saved = await saveEstimateDraft(db, {
      id: documentId,
      clientId: issued.ok ? issued.value.clientId : null,
      issueDate: "2026-07-16",
      dueDate: null,
      validUntil: null,
      pricingType: "tax_exclusive",
      discountYen: 0,
      note: "改ざん試行",
      lines: [
        {
          catalogItemId: null,
          name: "差し替え後の明細",
          description: null,
          unit: "本",
          quantity: 99,
          unitPriceYen: 1,
          taxCategory: "taxable_10",
          lineDiscountYen: 0,
        },
      ],
    });
    expect(saved.ok).toBe(false);
    if (!saved.ok) expect(saved.error.code).toBe("not_editable");

    const reloaded = await getDocument(db, documentId);
    expect(reloaded?.status).toBe("issued");
    expect(reloaded?.lines).toHaveLength(1);
    expect(reloaded?.lines[0]?.name).toBe("動画編集");
    expect(reloaded?.lines[0]?.quantity).toBe(2);
    expect(reloaded?.totalYen).toBe(66000);
    expect(reloaded?.calculationSnapshot?.totalYen).toBe(66000);
  });

  it("保存と発行を同時実行しても、発行済みなら明細0件やスナップショット欠落にならない", async () => {
    const { documentId, clientId } = await seedDraftEstimate(db);
    const [saveResult, issueResult] = await Promise.all([
      saveEstimateDraft(db, {
        id: documentId,
        clientId,
        issueDate: "2026-07-16",
        dueDate: null,
        validUntil: null,
        pricingType: "tax_exclusive",
        discountYen: 0,
        note: null,
        lines: [
          {
            catalogItemId: null,
            name: "同時保存の明細",
            description: null,
            unit: "本",
            quantity: 1,
            unitPriceYen: 10000,
            taxCategory: "taxable_10",
            lineDiscountYen: 0,
          },
        ],
      }),
      issueDocument(db, documentId),
    ]);

    const reloaded = await getDocument(db, documentId);
    expect(reloaded?.lines.length).toBeGreaterThan(0);
    if (issueResult.ok || reloaded?.status === "issued") {
      expect(reloaded?.status).toBe("issued");
      expect(reloaded?.companySnapshot).not.toBeNull();
      expect(reloaded?.calculationSnapshot).not.toBeNull();
      expect(reloaded?.documentNumber).toMatch(/^EST-2026-/);
    }
    expect(saveResult.ok || issueResult.ok).toBe(true);
  });
});

describe("DATA-01 発行後のマスター変更はスナップショットを変えない", () => {
  it("価格表・顧客・会社を変えても発行済みの金額と名は固定", async () => {
    const db = createTestDatabase();
    await saveCompany(db, sampleCompany);
    const client = await createClient(db, {
      name: "発行時の顧客",
      contactName: null,
      postalCode: null,
      address: null,
      phone: null,
      email: null,
      note: null,
    });
    if (!client.ok) throw new Error("unexpected");
    const item = await createCatalogItem(db, {
      name: "動画編集",
      description: null,
      unit: "本",
      unitPriceYen: 30000,
      costPriceYen: null,
      taxCategory: "taxable_10",
      minQuantity: null,
      isActive: true,
    });
    if (!item.ok) throw new Error("unexpected");
    const draft = await saveEstimateDraft(db, {
      id: null,
      clientId: client.value.id,
      issueDate: "2026-07-16",
      dueDate: null,
      validUntil: null,
      pricingType: "tax_exclusive",
      discountYen: 0,
      note: null,
      lines: [
        {
          catalogItemId: item.value.id,
          name: item.value.name,
          description: null,
          unit: "本",
          quantity: 1,
          unitPriceYen: 30000,
          taxCategory: "taxable_10",
          lineDiscountYen: 0,
        },
      ],
    });
    if (!draft.ok) throw new Error("unexpected");
    const issued = await issueDocument(db, draft.value.header.id!);
    expect(issued.ok).toBe(true);

    await updateCatalogItem(db, item.value.id, {
      name: "値上げ後の商品名",
      description: null,
      unit: "本",
      unitPriceYen: 999999,
      costPriceYen: null,
      taxCategory: "taxable_10",
      minQuantity: null,
      isActive: true,
    });
    await updateClient(db, client.value.id, {
      name: "改名後の顧客",
      contactName: null,
      postalCode: null,
      address: null,
      phone: null,
      email: null,
      note: null,
    });
    await saveCompany(db, { ...sampleCompany, displayName: "改名後の会社" });

    const reloaded = await getDocument(db, draft.value.header.id!);
    expect(reloaded?.lines[0]?.name).toBe("動画編集");
    expect(reloaded?.lines[0]?.unitPriceYen).toBe(30000);
    expect(reloaded?.totalYen).toBe(33000);
    expect(reloaded?.clientSnapshot?.name).toBe("発行時の顧客");
    expect(reloaded?.companySnapshot?.displayName).toBe("サンプル制作合同会社");
  });
});

describe("DATA-02 外部キーと一意制約が壊れた参照を拒否する", () => {
  it("存在しない書類へ明細を足すと失敗し、孤立行が残らない", async () => {
    const db = createTestDatabase();
    await expect(async () => {
      await db.execute(
        `INSERT INTO document_lines (
           document_id, sort_order, name, quantity, unit_price_yen, tax_category, line_discount_yen, amount_yen
         ) VALUES (?, 0, '孤立', 1, 100, 'taxable_10', 0, 100)`,
        [999],
      );
    }).rejects.toThrow(/FOREIGN KEY/i);
    const lines = await db.select("SELECT * FROM document_lines");
    expect(lines).toHaveLength(0);
  });

  it("同じ書類番号を2件入れると UNIQUE で失敗する", async () => {
    const db = createTestDatabase();
    const first = await seedDraftEstimate(db);
    await issueDocument(db, first.documentId);
    const second = await seedDraftEstimate(db);
    await expect(async () => {
      await db.execute(`UPDATE documents SET document_number = ? WHERE id = ?`, [
        "EST-2026-0001",
        second.documentId,
      ]);
    }).rejects.toThrow(/UNIQUE/i);
  });
});

describe("DATA-03 顧客・商品削除は発行済みスナップショットを消さない", () => {
  it("顧客削除後も発行済みの client_snapshot は残り、client_id は NULL になる", async () => {
    const db = createTestDatabase();
    const { documentId, clientId } = await seedDraftEstimate(db);
    await issueDocument(db, documentId);
    const deleted = await deleteClient(db, clientId);
    expect(deleted.ok).toBe(true);

    const reloaded = await getDocument(db, documentId);
    expect(reloaded?.clientId).toBeNull();
    expect(reloaded?.clientSnapshot?.name).toBe("サンプル株式会社");
    expect(reloaded?.totalYen).toBe(66000);
  });

  it("価格表削除後も明細の名前と単価は残る", async () => {
    const db = createTestDatabase();
    await saveCompany(db, sampleCompany);
    const client = await createClient(db, {
      name: "顧客",
      contactName: null,
      postalCode: null,
      address: null,
      phone: null,
      email: null,
      note: null,
    });
    if (!client.ok) throw new Error("unexpected");
    const item = await createCatalogItem(db, {
      name: "残すべき商品名",
      description: null,
      unit: "本",
      unitPriceYen: 5000,
      costPriceYen: null,
      taxCategory: "taxable_10",
      minQuantity: null,
      isActive: true,
    });
    if (!item.ok) throw new Error("unexpected");
    const draft = await saveEstimateDraft(db, {
      id: null,
      clientId: client.value.id,
      issueDate: "2026-07-16",
      dueDate: null,
      validUntil: null,
      pricingType: "tax_exclusive",
      discountYen: 0,
      note: null,
      lines: [
        {
          catalogItemId: item.value.id,
          name: "残すべき商品名",
          description: null,
          unit: "本",
          quantity: 1,
          unitPriceYen: 5000,
          taxCategory: "taxable_10",
          lineDiscountYen: 0,
        },
      ],
    });
    if (!draft.ok) throw new Error("unexpected");
    await issueDocument(db, draft.value.header.id!);
    const deleted = await deleteCatalogItem(db, item.value.id);
    expect(deleted.ok).toBe(true);

    const reloaded = await getDocument(db, draft.value.header.id!);
    expect(reloaded?.lines[0]?.catalogItemId).toBeNull();
    expect(reloaded?.lines[0]?.name).toBe("残すべき商品名");
    expect(reloaded?.lines[0]?.unitPriceYen).toBe(5000);
  });
});

describe("DATA-04 不正な状態遷移は拒否する", () => {
  it("入金済みから下書きへは戻せない", async () => {
    const db = createTestDatabase();
    const { documentId } = await seedDraftEstimate(db);
    await issueDocument(db, documentId);
    await updateDocumentStatus(db, documentId, "paid");
    const result = await updateDocumentStatus(db, documentId, "draft");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_transition");
    const reloaded = await getDocument(db, documentId);
    expect(reloaded?.status).toBe("paid");
  });
});

describe("USER-01 SQL断片や巨大な値引きはデータを壊さない", () => {
  it("顧客名に SQL 断片を入れてもテーブルは消えず、名前として保存される", async () => {
    const db = createTestDatabase();
    const evil = "'; DROP TABLE clients;--";
    const created = await createClient(db, {
      name: evil,
      contactName: null,
      postalCode: null,
      address: null,
      phone: null,
      email: null,
      note: null,
    });
    expect(created.ok).toBe(true);
    const tables = await db.select<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'clients'`,
    );
    expect(tables).toHaveLength(1);
    expect(created.ok && created.value.name).toBe(evil);
  });

  it("全体値引きが明細合計を超える見積は保存されず、書類が増えない", async () => {
    const db = createTestDatabase();
    const before = await listDocuments(db);
    const result = await saveEstimateDraft(db, {
      id: null,
      clientId: null,
      issueDate: null,
      dueDate: null,
      validUntil: null,
      pricingType: "tax_exclusive",
      discountYen: 10_000,
      note: null,
      lines: [
        {
          catalogItemId: null,
          name: "作業",
          description: null,
          unit: null,
          quantity: 1,
          unitPriceYen: 1000,
          taxCategory: "taxable_10",
          lineDiscountYen: 0,
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("discount_exceeds_subtotal");
    expect(await listDocuments(db)).toHaveLength(before.length);
  });
});

describe("USER-CSV-03 壊れ行混在のCSVは正常行だけ取り込み、式は失敗にする", () => {
  it("5001件目相当の壊れ行があっても、先行する正常行は残る(行単位)", async () => {
    const db = createTestDatabase();
    const rows = parseCsv(
      ["商品名,単位,単価", "正常A,本,1000", "壊れ行,本,not-a-number", "正常B,本,3000"].join("\n"),
    );
    const [header, ...dataRows] = rows;
    const mapping = guessColumnMapping(header!, CATALOG_ITEM_CSV_FIELDS);
    const validated = validateCatalogItemRows(dataRows, mapping);
    const summary = await importCatalogItemsCsv(db, validated, "skip");
    expect(summary.imported).toBe(2);
    expect(summary.failed).toBe(1);
    const items = await listCatalogItems(db);
    expect(items.map((item) => item.name).sort()).toEqual(["正常A", "正常B"]);
    expect(
      items.every((item) => Number.isInteger(item.unitPriceYen) && item.unitPriceYen >= 0),
    ).toBe(true);
  });
});

describe("EXT-01 診断は顧客名・メール・振込先を含めない", () => {
  it("DBに個人情報があっても診断JSONへ出ない", async () => {
    const db = createTestDatabase();
    const { documentId } = await seedDraftEstimate(db);
    await issueDocument(db, documentId);

    const report = await buildDiagnosticsReport(db, createFakeSystemInfoProvider());
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    const serialized = JSON.stringify(report.value);
    expect(serialized).not.toContain("サンプル株式会社");
    expect(serialized).not.toContain("client@example.com");
    expect(serialized).not.toContain("owner@example.com");
    expect(serialized).not.toContain("みずほ銀行");
    expect(serialized).not.toContain("1234567");
    expect(serialized).not.toContain("動画編集");
    expect(report.value.counts.documents).toBeGreaterThanOrEqual(1);
  });
});

describe("CONC-CONVERT-01 同じ見積から請求書へ連続変換できる(残差:二重押しで下書きが増える)", () => {
  it("2回変換すると請求下書きが2件できるが、元見積のスナップショットは不変", async () => {
    const db = createTestDatabase();
    const { documentId } = await seedDraftEstimate(db);
    const issued = await issueDocument(db, documentId);
    if (!issued.ok) throw new Error("unexpected");

    const first = await convertDocument(db, documentId, "invoice");
    const second = await convertDocument(db, documentId, "invoice");
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);

    const invoices = await listDocuments(db, { documentType: "invoice" });
    expect(invoices).toHaveLength(2);
    expect(invoices.every((document) => document.status === "draft")).toBe(true);

    const source = await getDocument(db, documentId);
    // issued→invoiced は承認経由のみ。未承認の連続変換では元見積は issued のまま。
    expect(source?.status).toBe("issued");
    expect(source?.totalYen).toBe(66000);
    expect(source?.companySnapshot?.displayName).toBe("サンプル制作合同会社");
  });
});
