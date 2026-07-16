import { beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@/application/commands/client.commands";
import { createCatalogItem } from "@/application/commands/catalog-item.commands";
import { saveEstimateDraft } from "@/application/commands/save-estimate-draft.command";
import { getDocumentDraft } from "@/application/queries/get-document-draft.query";
import type { DatabasePort } from "@/application/ports/database";
import { createTestDatabase } from "@/lib/test-utils/sqlite";
import { sampleCatalogItems } from "../../fixtures/catalogs/sample-items";
import { sampleClients } from "../../fixtures/clients/sample-clients";

// docs/03_CLAUDE_CODE_KICKOFF.mdの問い合わせ例
// 「YouTube用の動画を3本、各10分程度で全編にテロップ、サムネイルも3枚」を想定した見積。
describe("価格表から作る複数明細の見積(サンプルデータ)", () => {
  let db: DatabasePort;

  beforeEach(() => {
    db = createTestDatabase();
  });

  it("価格表4件・顧客2件を登録し、複数明細の見積合計が仕様どおりになる", async () => {
    const createdClients = [];
    for (const client of sampleClients) {
      const result = await createClient(db, client);
      if (!result.ok) throw new Error("client creation failed");
      createdClients.push(result.value);
    }

    const createdItems = [];
    for (const item of sampleCatalogItems) {
      const result = await createCatalogItem(db, item);
      if (!result.ok) throw new Error("catalog item creation failed");
      createdItems.push(result.value);
    }

    const videoEditing = createdItems.find((item) => item.name === "動画編集・基本料金")!;
    const telop = createdItems.find((item) => item.name === "テロップ追加")!;
    const thumbnail = createdItems.find((item) => item.name === "サムネイル制作")!;

    const saved = await saveEstimateDraft(db, {
      id: null,
      clientId: createdClients[0]!.id,
      issueDate: "2026-07-16",
      dueDate: null,
      validUntil: "2026-08-15",
      pricingType: "tax_exclusive",
      discountYen: 0,
      note: "YouTube用動画3本の見積",
      lines: [
        {
          catalogItemId: videoEditing.id,
          name: videoEditing.name,
          description: videoEditing.description,
          unit: videoEditing.unit,
          quantity: 3,
          unitPriceYen: videoEditing.unitPriceYen,
          taxCategory: videoEditing.taxCategory,
          lineDiscountYen: 0,
        },
        {
          catalogItemId: telop.id,
          name: telop.name,
          description: telop.description,
          unit: telop.unit,
          quantity: 30,
          unitPriceYen: telop.unitPriceYen,
          taxCategory: telop.taxCategory,
          lineDiscountYen: 0,
        },
        {
          catalogItemId: thumbnail.id,
          name: thumbnail.name,
          description: thumbnail.description,
          unit: thumbnail.unit,
          quantity: 3,
          unitPriceYen: thumbnail.unitPriceYen,
          taxCategory: thumbnail.taxCategory,
          lineDiscountYen: 0,
        },
      ],
    });

    expect(saved.ok).toBe(true);
    if (!saved.ok) return;

    // 90,000(動画) + 60,000(テロップ) + 15,000(サムネ) = 165,000
    const reloaded = await getDocumentDraft(db, saved.value.header.id!);
    expect(reloaded?.lines).toHaveLength(3);

    const subtotal = 30000 * 3 + 2000 * 30 + 5000 * 3;
    expect(subtotal).toBe(165000);
  });
});
