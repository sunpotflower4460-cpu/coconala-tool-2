import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@/application/commands/client.commands";
import { createCatalogItem } from "@/application/commands/catalog-item.commands";
import {
  saveEstimateDraft,
  type SaveEstimateDraftInput,
} from "@/application/commands/save-estimate-draft.command";
import { getDocumentDraft } from "@/application/queries/get-document-draft.query";
import { listDocuments } from "@/application/queries/list-documents.query";
import type { DatabasePort } from "@/application/ports/database";
import { createTestDatabase } from "@/lib/test-utils/sqlite";

describe("見積下書きの保存・再表示(Phase 1の縦の一本)", () => {
  let db: DatabasePort;

  beforeEach(() => {
    db = createTestDatabase();
  });

  it("下書きを保存し、そのまま再取得できる", async () => {
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

    const catalogItem = await createCatalogItem(db, {
      name: "動画編集・基本料金",
      description: null,
      unit: "本",
      unitPriceYen: 30000,
      costPriceYen: null,
      taxCategory: "taxable_10",
      minQuantity: null,
      isActive: true,
    });
    if (!catalogItem.ok) throw new Error("unexpected");

    const input: SaveEstimateDraftInput = {
      id: null,
      clientId: client.value.id,
      issueDate: "2026-07-16",
      dueDate: null,
      validUntil: "2026-08-15",
      pricingType: "tax_exclusive",
      discountYen: 0,
      note: "テスト見積です",
      lines: [
        {
          catalogItemId: catalogItem.value.id,
          name: catalogItem.value.name,
          description: null,
          unit: "本",
          quantity: 3,
          unitPriceYen: 30000,
          taxCategory: "taxable_10",
          lineDiscountYen: 0,
        },
      ],
    };

    const saved = await saveEstimateDraft(db, input);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;

    expect(saved.value.header.status).toBe("draft");
    expect(saved.value.lines).toHaveLength(1);

    const reloaded = await getDocumentDraft(db, saved.value.header.id!);
    expect(reloaded?.lines[0]?.quantity).toBe(3);

    const list = await listDocuments(db, { documentType: "estimate" });
    expect(list).toHaveLength(1);
    expect(list[0]?.totalYen).toBe(99000); // 90000 + 10%税(9000)
  });

  it("既存の下書きを更新すると明細が置き換わる", async () => {
    const first = await saveEstimateDraft(db, {
      id: null,
      clientId: null,
      issueDate: null,
      dueDate: null,
      validUntil: null,
      pricingType: "tax_exclusive",
      discountYen: 0,
      note: null,
      lines: [
        {
          catalogItemId: null,
          name: "作業A",
          description: null,
          unit: null,
          quantity: 1,
          unitPriceYen: 1000,
          taxCategory: "taxable_10",
          lineDiscountYen: 0,
        },
      ],
    });
    if (!first.ok) throw new Error("unexpected");

    const updated = await saveEstimateDraft(db, {
      id: first.value.header.id,
      clientId: null,
      issueDate: null,
      dueDate: null,
      validUntil: null,
      pricingType: "tax_exclusive",
      discountYen: 0,
      note: null,
      lines: [
        {
          catalogItemId: null,
          name: "作業B",
          description: null,
          unit: null,
          quantity: 2,
          unitPriceYen: 2000,
          taxCategory: "taxable_10",
          lineDiscountYen: 0,
        },
      ],
    });

    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.lines).toHaveLength(1);
    expect(updated.value.lines[0]?.name).toBe("作業B");

    const documents = await listDocuments(db, { documentType: "estimate" });
    expect(documents).toHaveLength(1); // 新規作成ではなく上書き
  });

  it("アプリ再起動を模してDB再接続しても下書きが残る", async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "mitsumori-desk-test-"));
    const dbFile = path.join(tempDir, "app.sqlite3");
    let fileDb = createTestDatabase(dbFile);

    const saved = await saveEstimateDraft(fileDb, {
      id: null,
      clientId: null,
      issueDate: null,
      dueDate: null,
      validUntil: null,
      pricingType: "tax_exclusive",
      discountYen: 0,
      note: "再起動確認用",
      lines: [
        {
          catalogItemId: null,
          name: "再起動確認",
          description: null,
          unit: null,
          quantity: 1,
          unitPriceYen: 5000,
          taxCategory: "taxable_10",
          lineDiscountYen: 0,
        },
      ],
    });
    if (!saved.ok) throw new Error("unexpected");
    const documentId = saved.value.header.id!;

    // 「アプリ再起動」を、新しい接続で同じDBファイルを開くことで再現する。
    fileDb = createTestDatabase(dbFile);
    const reloaded = await getDocumentDraft(fileDb, documentId);
    expect(reloaded?.header.note).toBe("再起動確認用");
    expect(reloaded?.lines[0]?.name).toBe("再起動確認");

    rmSync(tempDir, { recursive: true, force: true });
  });
});
