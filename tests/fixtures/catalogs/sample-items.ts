import type { CatalogItemInput } from "@/domain/catalog/types";

// docs/00_PRODUCT_SPEC.mdの想定利用者(クリエイター・制作会社)を想定したサンプル価格表。
export const sampleCatalogItems: CatalogItemInput[] = [
  {
    name: "動画編集・基本料金",
    description: "10分程度の動画編集作業",
    unit: "本",
    unitPriceYen: 30000,
    costPriceYen: 10000,
    taxCategory: "taxable_10",
    minQuantity: 1,
    isActive: true,
  },
  {
    name: "テロップ追加",
    description: null,
    unit: "分",
    unitPriceYen: 2000,
    costPriceYen: null,
    taxCategory: "taxable_10",
    minQuantity: null,
    isActive: true,
  },
  {
    name: "サムネイル制作",
    description: null,
    unit: "枚",
    unitPriceYen: 5000,
    costPriceYen: null,
    taxCategory: "taxable_10",
    minQuantity: null,
    isActive: true,
  },
  {
    name: "特急対応",
    description: "通常納期より早める場合の追加料金",
    unit: "件",
    unitPriceYen: 10000,
    costPriceYen: null,
    taxCategory: "taxable_10",
    minQuantity: null,
    isActive: true,
  },
];
