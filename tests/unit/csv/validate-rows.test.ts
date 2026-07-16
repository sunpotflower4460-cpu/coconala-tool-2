import { describe, expect, it } from "vitest";
import {
  CATALOG_ITEM_CSV_FIELDS,
  CLIENT_CSV_FIELDS,
  guessColumnMapping,
} from "@/domain/csv/fields";
import { validateCatalogItemRows } from "@/domain/csv/validate-catalog-item-rows";
import { validateClientRows } from "@/domain/csv/validate-client-rows";

describe("guessColumnMapping", () => {
  it("見本CSVの列名と一致する列を自動でマッピングする", () => {
    const mapping = guessColumnMapping(["顧客名", "担当者名", "メールアドレス"], CLIENT_CSV_FIELDS);
    expect(mapping.name).toBe(0);
    expect(mapping.contactName).toBe(1);
    expect(mapping.email).toBe(2);
    expect(mapping.address).toBeNull();
  });
});

describe("validateClientRows", () => {
  const mapping = guessColumnMapping(["顧客名", "担当者名", "メールアドレス"], CLIENT_CSV_FIELDS);

  it("正常な行はClientInputへ変換できる", () => {
    const result = validateClientRows(
      [["サンプル株式会社", "山田太郎", "taro@example.com"]],
      mapping,
    );
    expect(result[0]?.errors).toHaveLength(0);
    expect(result[0]?.data?.name).toBe("サンプル株式会社");
    expect(result[0]?.data?.email).toBe("taro@example.com");
  });

  it("顧客名が空の行はエラーになる", () => {
    const result = validateClientRows([["", "山田太郎", ""]], mapping);
    expect(result[0]?.errors).toContain("顧客名が空です");
    expect(result[0]?.data).toBeNull();
  });

  it("メールアドレスの形式が不正な行はエラーになる", () => {
    const result = validateClientRows([["サンプル株式会社", "", "invalid-email"]], mapping);
    expect(result[0]?.errors).toContain("メールアドレスの形式が正しくありません");
  });
});

describe("validateCatalogItemRows", () => {
  const mapping = guessColumnMapping(["商品名", "単位", "単価", "税区分"], CATALOG_ITEM_CSV_FIELDS);

  it("正常な行はCatalogItemInputへ変換できる(税区分省略時はtaxable_10)", () => {
    const result = validateCatalogItemRows([["動画編集", "本", "15000", ""]], mapping);
    expect(result[0]?.errors).toHaveLength(0);
    expect(result[0]?.data?.unitPriceYen).toBe(15000);
    expect(result[0]?.data?.taxCategory).toBe("taxable_10");
  });

  it("単価が整数でない行はエラーになる", () => {
    const result = validateCatalogItemRows([["動画編集", "本", "15000.5", ""]], mapping);
    expect(result[0]?.errors).toContain("単価は0以上の整数(円)で入力してください");
  });

  it("単価が負の行はエラーになる", () => {
    const result = validateCatalogItemRows([["動画編集", "本", "-100", ""]], mapping);
    expect(result[0]?.errors).toContain("単価は0以上の整数(円)で入力してください");
  });

  it("不正な税区分はエラーになる", () => {
    const result = validateCatalogItemRows([["動画編集", "本", "15000", "invalid"]], mapping);
    expect(result[0]?.errors.some((e) => e.includes("税区分"))).toBe(true);
  });
});
