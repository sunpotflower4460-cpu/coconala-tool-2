import { beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@/application/commands/client.commands";
import { convertDocument } from "@/application/commands/convert-document.command";
import { issueDocument } from "@/application/commands/issue-document.command";
import { saveCompany } from "@/application/commands/save-company.command";
import { saveEstimateDraft } from "@/application/commands/save-estimate-draft.command";
import { storeImageAsset } from "@/application/commands/store-image-asset.command";
import { getCompany } from "@/application/queries/get-company.query";
import { getDocument } from "@/application/queries/get-document.query";
import { getImageAssetDataUrl } from "@/application/queries/get-image-asset.query";
import type { DatabasePort } from "@/application/ports/database";
import { addDaysToIsoDate, localTodayIsoDate } from "@/domain/documents/dates";
import type { CompanyInput } from "@/domain/shared/company";
import { createTestDatabase } from "@/lib/test-utils/sqlite";

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const fakePng = (marker: number) => new Uint8Array([...PNG_HEADER, 0, 0, 0, marker]);

const company: CompanyInput = {
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
  estimateValidDays: 30,
  paymentDueDays: 14,
  defaultNote: null,
};

async function issueEstimate(db: DatabasePort): Promise<number> {
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
    note: null,
    lines: [
      {
        catalogItemId: null,
        name: "動画編集",
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
  const id = draft.value.header.id!;
  const issued = await issueDocument(db, id);
  if (!issued.ok) throw new Error(issued.error.message);
  return id;
}

describe("会社ロゴ(app_assets)", () => {
  let db: DatabasePort;
  beforeEach(() => {
    db = createTestDatabase();
  });

  it("PNG/JPEG 以外(SVG・拡張子だけの偽装)は保存しない", async () => {
    const svg = new TextEncoder().encode("<svg onload=alert(1)></svg>");
    const result = await storeImageAsset(db, svg);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("unsupported_image");
  });

  it("大きすぎる画像は保存しない", async () => {
    const big = new Uint8Array(400_000);
    big.set(PNG_HEADER);
    const result = await storeImageAsset(db, big);
    expect(result.ok).toBe(false);
  });

  it("同じ画像は1件だけ保存し、data URL で取り出せる", async () => {
    const first = await storeImageAsset(db, fakePng(1));
    const second = await storeImageAsset(db, fakePng(1));
    if (!first.ok || !second.ok) throw new Error("unexpected");
    expect(first.value.sha256).toBe(second.value.sha256);
    const rows = await db.select<{ n: number }>("SELECT COUNT(*) AS n FROM app_assets");
    expect(rows[0]?.n).toBe(1);
    expect(await getImageAssetDataUrl(db, first.value.sha256)).toMatch(/^data:image\/png;base64,/);
  });

  it("発行後にロゴを変えても、発行済み書類のロゴは発行時のまま", async () => {
    const logoA = await storeImageAsset(db, fakePng(1));
    const logoB = await storeImageAsset(db, fakePng(2));
    if (!logoA.ok || !logoB.ok) throw new Error("unexpected");

    await saveCompany(db, { ...company, logoAssetSha256: logoA.value.sha256 });
    const documentId = await issueEstimate(db);
    await saveCompany(db, { ...company, logoAssetSha256: logoB.value.sha256 });

    const issued = await getDocument(db, documentId);
    expect(issued?.companySnapshot?.logoAssetSha256).toBe(logoA.value.sha256);
    expect(await getImageAssetDataUrl(db, issued?.companySnapshot?.logoAssetSha256)).not.toBeNull();
    expect((await getCompany(db))?.logoAssetSha256).toBe(logoB.value.sha256);
  });

  it("ロゴを指定せずに会社情報を保存しても、登録済みのロゴは消えない", async () => {
    const logo = await storeImageAsset(db, fakePng(3));
    if (!logo.ok) throw new Error("unexpected");
    await saveCompany(db, { ...company, logoAssetSha256: logo.value.sha256 });
    await saveCompany(db, { ...company, displayName: "名前変更" });
    expect((await getCompany(db))?.logoAssetSha256).toBe(logo.value.sha256);
  });
});

describe("書類の日付の初期値", () => {
  it("請求書へ変換すると、会社設定の支払期限(日数)から支払期限が入る", async () => {
    const db = createTestDatabase();
    await saveCompany(db, company);
    const estimateId = await issueEstimate(db);
    const invoice = await convertDocument(db, estimateId, "invoice");
    if (!invoice.ok) throw new Error(invoice.error.message);
    expect(invoice.value.dueDate).toBe(addDaysToIsoDate(localTodayIsoDate(), 14));
  });

  it("納品書へ変換したときは支払期限を入れない", async () => {
    const db = createTestDatabase();
    await saveCompany(db, company);
    const estimateId = await issueEstimate(db);
    const delivery = await convertDocument(db, estimateId, "delivery_note");
    if (!delivery.ok) throw new Error(delivery.error.message);
    expect(delivery.value.dueDate).toBeNull();
  });
});

describe("書類番号の採番(種別をまたぐ衝突の防止)", () => {
  it("見積書と請求書の記号を同じにしていた期間があっても、発行が UNIQUE で失敗しない", async () => {
    const db = createTestDatabase();
    await saveCompany(db, company);
    // 旧設定で請求書の記号が見積書と同じだった想定の番号を先に作る
    await db.execute(
      `INSERT INTO documents (document_type, status, document_number, issue_date, pricing_type,
         rounding_mode, discount_yen, subtotal_yen, tax_yen, total_yen, created_at, updated_at)
       VALUES ('invoice', 'issued', 'EST-2026-0001', '2026-07-01', 'tax_exclusive', 'floor', 0, 0, 0, 0, 'x', 'x')`,
    );
    const estimateId = await issueEstimate(db);
    const issued = await getDocument(db, estimateId);
    expect(issued?.documentNumber).toBe("EST-2026-0002");
  });
});
