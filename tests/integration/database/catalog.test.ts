import { beforeEach, describe, expect, it } from "vitest";
import {
  createCatalogItem,
  deleteCatalogItem,
  updateCatalogItem,
} from "@/application/commands/catalog-item.commands";
import { getCatalogItem, listCatalogItems } from "@/application/queries/list-catalog-items.query";
import type { DatabasePort } from "@/application/ports/database";
import { createTestDatabase } from "@/lib/test-utils/sqlite";
import type { CatalogItemInput } from "@/domain/catalog/types";

const sample: CatalogItemInput = {
  name: "動画編集・基本料金",
  description: "10分程度の動画編集",
  unit: "本",
  unitPriceYen: 30000,
  costPriceYen: 10000,
  taxCategory: "taxable_10",
  minQuantity: 1,
  isActive: true,
};

describe("catalog_items", () => {
  let db: DatabasePort;

  beforeEach(() => {
    db = createTestDatabase();
  });

  it("商品を登録・取得できる", async () => {
    const created = await createCatalogItem(db, sample);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const fetched = await getCatalogItem(db, created.value.id);
    expect(fetched?.unitPriceYen).toBe(30000);
    expect(fetched?.taxCategory).toBe("taxable_10");
  });

  it("100件登録して名前で検索できる", async () => {
    for (let i = 0; i < 100; i++) {
      await createCatalogItem(db, { ...sample, name: `商品${String(i).padStart(3, "0")}` });
    }
    const all = await listCatalogItems(db);
    expect(all).toHaveLength(100);

    const found = await listCatalogItems(db, { search: "商品050" });
    expect(found).toHaveLength(1);
    expect(found[0]?.name).toBe("商品050");
  });

  it("is_activeで絞り込める", async () => {
    await createCatalogItem(db, { ...sample, name: "有効商品", isActive: true });
    await createCatalogItem(db, { ...sample, name: "無効商品", isActive: false });
    const activeOnly = await listCatalogItems(db, { activeOnly: true });
    expect(activeOnly.map((c) => c.name)).toEqual(["有効商品"]);
  });

  it("商品を更新・削除できる", async () => {
    const created = await createCatalogItem(db, sample);
    if (!created.ok) throw new Error("unexpected");
    const updated = await updateCatalogItem(db, created.value.id, {
      ...sample,
      unitPriceYen: 35000,
    });
    expect(updated.ok && updated.value.unitPriceYen).toBe(35000);

    await deleteCatalogItem(db, created.value.id);
    expect(await getCatalogItem(db, created.value.id)).toBeNull();
  });
});
