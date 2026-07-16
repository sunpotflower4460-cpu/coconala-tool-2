import { beforeEach, describe, expect, it } from "vitest";
import { saveCompany } from "@/application/commands/save-company.command";
import { getCompany } from "@/application/queries/get-company.query";
import type { DatabasePort } from "@/application/ports/database";
import { createTestDatabase } from "@/lib/test-utils/sqlite";
import type { CompanyInput } from "@/domain/shared/company";

const sampleCompany: CompanyInput = {
  displayName: "サンプル制作合同会社",
  representativeName: "山田太郎",
  postalCode: "150-0001",
  address: "東京都渋谷区神宮前1-1-1",
  phone: "03-1234-5678",
  email: "info@example.com",
  invoiceRegistrationNumber: "T1234567890123",
  bankName: "サンプル銀行",
  bankBranchName: "渋谷支店",
  bankAccountType: "普通",
  bankAccountNumber: "1234567",
  bankAccountHolder: "ヤマダタロウ",
  logoPath: null,
  estimateValidDays: 30,
  paymentDueDays: 30,
  defaultNote: "ご不明点はお気軽にお問い合わせください。",
};

describe("company", () => {
  let db: DatabasePort;

  beforeEach(() => {
    db = createTestDatabase();
  });

  it("初期状態ではnullを返す", async () => {
    expect(await getCompany(db)).toBeNull();
  });

  it("会社情報を保存し取得できる", async () => {
    const result = await saveCompany(db, sampleCompany);
    expect(result.ok).toBe(true);

    const fetched = await getCompany(db);
    expect(fetched?.displayName).toBe("サンプル制作合同会社");
    expect(fetched?.invoiceRegistrationNumber).toBe("T1234567890123");
  });

  it("2回目の保存は上書きになる(行が増えない)", async () => {
    await saveCompany(db, sampleCompany);
    await saveCompany(db, { ...sampleCompany, displayName: "変更後の会社名" });

    const rows = await db.select("SELECT COUNT(*) as count FROM companies");
    expect((rows[0] as { count: number }).count).toBe(1);

    const fetched = await getCompany(db);
    expect(fetched?.displayName).toBe("変更後の会社名");
  });
});
