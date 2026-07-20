import { beforeEach, describe, expect, it } from "vitest";
import { saveCompany } from "@/application/commands/save-company.command";
import { seedPracticeData } from "@/application/commands/seed-practice-data.command";
import { deletePracticeData } from "@/application/commands/delete-practice-data.command";
import { getPracticeDataSummary } from "@/application/queries/get-practice-data-summary.query";
import { getCompany } from "@/application/queries/get-company.query";
import { listClients } from "@/application/queries/list-clients.query";
import { listCatalogItems } from "@/application/queries/list-catalog-items.query";
import type { DatabasePort } from "@/application/ports/database";
import { createTestDatabase } from "@/lib/test-utils/sqlite";

describe("練習モード", () => {
  let db: DatabasePort;

  beforeEach(() => {
    db = createTestDatabase();
  });

  it("会社情報が未設定なら練習用の会社・顧客・価格表・見積を作成する", async () => {
    const seeded = await seedPracticeData(db);
    expect(seeded.ok).toBe(true);
    if (!seeded.ok) return;
    expect(seeded.value.companySeeded).toBe(true);

    const company = await getCompany(db);
    expect(company?.displayName).toBe("練習用会社(サンプル)");

    const summary = await getPracticeDataSummary(db);
    expect(summary.hasPracticeData).toBe(true);
    expect(summary.clientCount).toBe(1);
    expect(summary.catalogItemCount).toBe(3);
    expect(summary.documentCount).toBe(1);
    expect(summary.companyIsPractice).toBe(true);
  });

  it("すでに実際の会社情報が登録されている場合は上書きしない", async () => {
    await saveCompany(db, {
      displayName: "実在する会社",
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

    const seeded = await seedPracticeData(db);
    expect(seeded.ok).toBe(true);
    if (!seeded.ok) return;
    expect(seeded.value.companySeeded).toBe(false);

    const company = await getCompany(db);
    expect(company?.displayName).toBe("実在する会社");

    const summary = await getPracticeDataSummary(db);
    expect(summary.companyIsPractice).toBe(false);
  });

  it("練習データの一括削除は練習データのみを消し、実データを残す", async () => {
    await saveCompany(db, {
      displayName: "実在する会社",
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
    await seedPracticeData(db);

    const deleted = await deletePracticeData(db);
    expect(deleted.ok).toBe(true);

    const summary = await getPracticeDataSummary(db);
    expect(summary.hasPracticeData).toBe(false);

    const company = await getCompany(db);
    expect(company?.displayName).toBe("実在する会社");

    const clients = await listClients(db);
    expect(clients).toHaveLength(0);
    const catalogItems = await listCatalogItems(db);
    expect(catalogItems).toHaveLength(0);
  });

  it("会社情報を伴わずに練習データを作成した場合は、削除時に練習用会社も消える", async () => {
    await seedPracticeData(db);
    const deleted = await deletePracticeData(db);
    expect(deleted.ok).toBe(true);
    const company = await getCompany(db);
    expect(company).toBeNull();
  });
});
