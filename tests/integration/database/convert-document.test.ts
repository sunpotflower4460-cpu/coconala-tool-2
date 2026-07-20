import { beforeEach, describe, expect, it } from "vitest";
import { convertDocument } from "@/application/commands/convert-document.command";
import { issueDocument } from "@/application/commands/issue-document.command";
import { saveEstimateDraft } from "@/application/commands/save-estimate-draft.command";
import { updateDocumentStatus } from "@/application/commands/update-document-status.command";
import { getDocument } from "@/application/queries/get-document.query";
import { createClient } from "@/application/commands/client.commands";
import { saveCompany } from "@/application/commands/save-company.command";
import type { DatabasePort } from "@/application/ports/database";
import { createTestDatabase } from "@/lib/test-utils/sqlite";

async function seedIssuedEstimate(db: DatabasePort) {
  await saveCompany(db, {
    displayName: "サンプル制作合同会社",
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
    name: "サンプル株式会社",
    contactName: null,
    postalCode: null,
    address: null,
    phone: null,
    email: null,
    note: null,
  });
  if (!client.ok) throw new Error("unexpected");

  const draft = await saveEstimateDraft(db, {
    id: null,
    clientId: client.value.id,
    issueDate: "2026-07-16",
    dueDate: null,
    validUntil: null,
    pricingType: "tax_exclusive",
    discountYen: 0,
    note: "テスト見積",
    lines: [
      {
        catalogItemId: null,
        name: "動画編集",
        description: null,
        unit: "本",
        quantity: 1,
        unitPriceYen: 100000,
        taxCategory: "taxable_10",
        lineDiscountYen: 0,
      },
    ],
  });
  if (!draft.ok) throw new Error("unexpected");
  const issued = await issueDocument(db, draft.value.header.id!);
  if (!issued.ok) throw new Error("unexpected");
  return issued.value;
}

describe("convertDocument", () => {
  let db: DatabasePort;

  beforeEach(() => {
    db = createTestDatabase();
  });

  it("承認済み見積を請求書へ変換すると、明細が引き継がれ元の見積は請求済みになる", async () => {
    const estimate = await seedIssuedEstimate(db);
    const approved = await updateDocumentStatus(db, estimate.id, "approved");
    expect(approved.ok).toBe(true);

    const result = await convertDocument(db, estimate.id, "invoice");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.documentType).toBe("invoice");
    expect(result.value.status).toBe("draft");
    expect(result.value.sourceDocumentId).toBe(estimate.id);
    expect(result.value.lines).toHaveLength(1);
    expect(result.value.lines[0]?.name).toBe("動画編集");
    expect(result.value.totalYen).toBe(110000);

    const sourceAfter = await getDocument(db, estimate.id);
    expect(sourceAfter?.status).toBe("invoiced");
  });

  it("見積は納品書へも変換できる(元の状態は変わらない)", async () => {
    const estimate = await seedIssuedEstimate(db);
    const result = await convertDocument(db, estimate.id, "delivery_note");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.documentType).toBe("delivery_note");

    const sourceAfter = await getDocument(db, estimate.id);
    expect(sourceAfter?.status).toBe("issued");
  });

  it("請求書は領収書へ変換でき、元の請求書は入金済みになる", async () => {
    const estimate = await seedIssuedEstimate(db);
    const invoiceResult = await convertDocument(db, estimate.id, "invoice");
    if (!invoiceResult.ok) throw new Error("unexpected");
    const issuedInvoice = await issueDocument(db, invoiceResult.value.id);
    if (!issuedInvoice.ok) throw new Error("unexpected");

    const receiptResult = await convertDocument(db, issuedInvoice.value.id, "receipt");
    expect(receiptResult.ok).toBe(true);
    if (receiptResult.ok) expect(receiptResult.value.documentType).toBe("receipt");

    const invoiceAfter = await getDocument(db, issuedInvoice.value.id);
    expect(invoiceAfter?.status).toBe("paid");
  });

  it("許可されていない変換はエラーになる", async () => {
    const estimate = await seedIssuedEstimate(db);
    const result = await convertDocument(db, estimate.id, "receipt");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_conversion");
  });

  it("下書きの見積は変換できない", async () => {
    const client = await createClient(db, {
      name: "サンプル株式会社",
      contactName: null,
      postalCode: null,
      address: null,
      phone: null,
      email: null,
      note: null,
    });
    if (!client.ok) throw new Error("unexpected");
    const draft = await saveEstimateDraft(db, {
      id: null,
      clientId: client.value.id,
      issueDate: null,
      dueDate: null,
      validUntil: null,
      pricingType: "tax_exclusive",
      discountYen: 0,
      note: null,
      lines: [],
    });
    if (!draft.ok) throw new Error("unexpected");

    const result = await convertDocument(db, draft.value.header.id!, "invoice");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_convertible");
  });
});
