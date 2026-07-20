import { beforeEach, describe, expect, it } from "vitest";
import { createClient, updateClient } from "@/application/commands/client.commands";
import { issueDocument } from "@/application/commands/issue-document.command";
import { saveCompany } from "@/application/commands/save-company.command";
import { saveEstimateDraft } from "@/application/commands/save-estimate-draft.command";
import { getDocument } from "@/application/queries/get-document.query";
import { listDocumentEvents } from "@/application/queries/list-document-events.query";
import type { DatabasePort } from "@/application/ports/database";
import type { CompanyInput } from "@/domain/shared/company";
import { createTestDatabase } from "@/lib/test-utils/sqlite";

const sampleCompany: CompanyInput = {
  displayName: "サンプル制作合同会社",
  representativeName: "山田太郎",
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
  estimateValidDays: 30,
  paymentDueDays: 30,
  defaultNote: null,
};

async function seedDraftEstimate(db: DatabasePort) {
  await saveCompany(db, sampleCompany);
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
    validUntil: "2026-08-15",
    pricingType: "tax_exclusive",
    discountYen: 0,
    note: null,
    lines: [
      {
        catalogItemId: null,
        name: "動画編集",
        description: null,
        unit: "本",
        quantity: 2,
        unitPriceYen: 30000,
        taxCategory: "taxable_10",
        lineDiscountYen: 0,
      },
    ],
  });
  if (!draft.ok) throw new Error("unexpected");
  return { clientId: client.value.id, documentId: draft.value.header.id! };
}

describe("issueDocument", () => {
  let db: DatabasePort;

  beforeEach(() => {
    db = createTestDatabase();
  });

  it("下書きを発行すると書類番号・スナップショット・履歴が作られる", async () => {
    const { documentId } = await seedDraftEstimate(db);
    const result = await issueDocument(db, documentId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.status).toBe("issued");
    expect(result.value.documentNumber).toBe("EST-2026-0001");
    expect(result.value.companySnapshot?.displayName).toBe("サンプル制作合同会社");
    expect(result.value.clientSnapshot?.name).toBe("サンプル株式会社");
    expect(result.value.totalYen).toBe(66000); // 60,000 + 10%

    const events = await listDocumentEvents(db, documentId);
    expect(events.some((event) => event.eventType === "issue")).toBe(true);
  });

  it("発行後に顧客名や会社情報を変更しても、発行済み書類のスナップショットは変化しない(ADR 0004)", async () => {
    const { documentId, clientId } = await seedDraftEstimate(db);
    await issueDocument(db, documentId);

    await updateClient(db, clientId, {
      name: "変更後の顧客名",
      contactName: null,
      postalCode: null,
      address: null,
      phone: null,
      email: null,
      note: null,
    });
    await saveCompany(db, { ...sampleCompany, displayName: "変更後の会社名" });

    const reloaded = await getDocument(db, documentId);
    expect(reloaded?.clientSnapshot?.name).toBe("サンプル株式会社");
    expect(reloaded?.companySnapshot?.displayName).toBe("サンプル制作合同会社");
  });

  it("同じ年の2件目は連番が増える", async () => {
    const first = await seedDraftEstimate(db);
    await issueDocument(db, first.documentId);

    const second = await seedDraftEstimate(db);
    const result = await issueDocument(db, second.documentId);
    expect(result.ok && result.value.documentNumber).toBe("EST-2026-0002");
  });

  it("顧客未選択の場合は発行できない", async () => {
    await saveCompany(db, sampleCompany);
    const draft = await saveEstimateDraft(db, {
      id: null,
      clientId: null,
      issueDate: null,
      dueDate: null,
      validUntil: null,
      pricingType: "tax_exclusive",
      discountYen: 0,
      note: null,
      lines: [],
    });
    if (!draft.ok) throw new Error("unexpected");

    const result = await issueDocument(db, draft.value.header.id!);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("client_required");
  });

  it("会社情報が未登録の場合は発行できない", async () => {
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

    const result = await issueDocument(db, draft.value.header.id!);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("company_required");
  });

  it("発行済みの書類を再度発行しようとするとエラーになる", async () => {
    const { documentId } = await seedDraftEstimate(db);
    await issueDocument(db, documentId);
    const second = await issueDocument(db, documentId);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe("not_issuable");
  });
});
