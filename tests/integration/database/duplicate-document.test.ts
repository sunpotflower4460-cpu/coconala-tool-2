import { beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@/application/commands/client.commands";
import { duplicateDocument } from "@/application/commands/duplicate-document.command";
import { issueDocument } from "@/application/commands/issue-document.command";
import { saveCompany } from "@/application/commands/save-company.command";
import { saveEstimateDraft } from "@/application/commands/save-estimate-draft.command";
import { getDocument } from "@/application/queries/get-document.query";
import type { DatabasePort } from "@/application/ports/database";
import { createTestDatabase } from "@/lib/test-utils/sqlite";

describe("duplicateDocument", () => {
  let db: DatabasePort;

  beforeEach(() => {
    db = createTestDatabase();
  });

  it("発行済みの書類を複製すると、番号なしの新しい下書きになる", async () => {
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
      note: "複製元",
      lines: [
        {
          catalogItemId: null,
          name: "動画編集",
          description: null,
          unit: "本",
          quantity: 1,
          unitPriceYen: 50000,
          taxCategory: "taxable_10",
          lineDiscountYen: 0,
        },
      ],
    });
    if (!draft.ok) throw new Error("unexpected");
    const issued = await issueDocument(db, draft.value.header.id!);
    if (!issued.ok) throw new Error("unexpected");

    const duplicated = await duplicateDocument(db, issued.value.id);
    expect(duplicated.ok).toBe(true);
    if (!duplicated.ok) return;

    expect(duplicated.value.status).toBe("draft");
    expect(duplicated.value.documentNumber).toBeNull();
    expect(duplicated.value.lines).toHaveLength(1);
    expect(duplicated.value.lines[0]?.name).toBe("動画編集");
    expect(duplicated.value.id).not.toBe(issued.value.id);

    // 複製元は変化しない
    const original = await getDocument(db, issued.value.id);
    expect(original?.status).toBe("issued");
    expect(original?.documentNumber).toBe(issued.value.documentNumber);
  });

  it("存在しない書類の複製はエラーになる", async () => {
    const result = await duplicateDocument(db, 9999);
    expect(result.ok).toBe(false);
  });
});
