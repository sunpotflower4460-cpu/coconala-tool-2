import { beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@/application/commands/client.commands";
import { importClientsCsv } from "@/application/commands/import-clients-csv.command";
import { importCatalogItemsCsv } from "@/application/commands/import-catalog-items-csv.command";
import {
  CATALOG_ITEM_CSV_FIELDS,
  CLIENT_CSV_FIELDS,
  guessColumnMapping,
} from "@/domain/csv/fields";
import { parseCsv } from "@/domain/csv/parse";
import { validateCatalogItemRows } from "@/domain/csv/validate-catalog-item-rows";
import { validateClientRows } from "@/domain/csv/validate-client-rows";
import { listClients } from "@/application/queries/list-clients.query";
import { listCatalogItems } from "@/application/queries/list-catalog-items.query";
import type { DatabasePort } from "@/application/ports/database";
import { createTestDatabase } from "@/lib/test-utils/sqlite";

describe("importClientsCsv", () => {
  let db: DatabasePort;

  beforeEach(() => {
    db = createTestDatabase();
  });

  it("正常な行を新規登録し、エラー行は取り込まない", async () => {
    const rows = parseCsv(
      "顧客名,担当者名,メールアドレス\nサンプル株式会社,山田太郎,taro@example.com\n,担当者のみ,\n",
    );
    const [header, ...dataRows] = rows;
    const mapping = guessColumnMapping(header!, CLIENT_CSV_FIELDS);
    const validated = validateClientRows(dataRows, mapping);

    const summary = await importClientsCsv(db, validated, "skip");
    expect(summary.imported).toBe(1);
    expect(summary.failed).toBe(1);

    const clients = await listClients(db);
    expect(clients).toHaveLength(1);
    expect(clients[0]?.name).toBe("サンプル株式会社");
  });

  it("重複ポリシーがskipなら既存顧客を上書きしない", async () => {
    await createClient(db, {
      name: "サンプル株式会社",
      contactName: "旧担当者",
      postalCode: null,
      address: null,
      phone: null,
      email: null,
      note: null,
    });
    const rows = parseCsv("顧客名,担当者名\nサンプル株式会社,新担当者\n");
    const [header, ...dataRows] = rows;
    const mapping = guessColumnMapping(header!, CLIENT_CSV_FIELDS);
    const validated = validateClientRows(dataRows, mapping);

    const summary = await importClientsCsv(db, validated, "skip");
    expect(summary.skipped).toBe(1);
    expect(summary.imported).toBe(0);

    const clients = await listClients(db);
    expect(clients[0]?.contactName).toBe("旧担当者");
  });

  it("重複ポリシーがoverwriteなら既存顧客を更新する", async () => {
    await createClient(db, {
      name: "サンプル株式会社",
      contactName: "旧担当者",
      postalCode: null,
      address: null,
      phone: null,
      email: null,
      note: null,
    });
    const rows = parseCsv("顧客名,担当者名\nサンプル株式会社,新担当者\n");
    const [header, ...dataRows] = rows;
    const mapping = guessColumnMapping(header!, CLIENT_CSV_FIELDS);
    const validated = validateClientRows(dataRows, mapping);

    const summary = await importClientsCsv(db, validated, "overwrite");
    expect(summary.updated).toBe(1);

    const clients = await listClients(db);
    expect(clients[0]?.contactName).toBe("新担当者");
  });
});

describe("importCatalogItemsCsv", () => {
  let db: DatabasePort;

  beforeEach(() => {
    db = createTestDatabase();
  });

  it("正常な行を新規登録する", async () => {
    const rows = parseCsv(
      "商品名,単位,単価,税区分\n動画編集,本,15000,\nサムネイル,枚,3000,taxable_8\n",
    );
    const [header, ...dataRows] = rows;
    const mapping = guessColumnMapping(header!, CATALOG_ITEM_CSV_FIELDS);
    const validated = validateCatalogItemRows(dataRows, mapping);

    const summary = await importCatalogItemsCsv(db, validated, "skip");
    expect(summary.imported).toBe(2);

    const items = await listCatalogItems(db);
    expect(items).toHaveLength(2);
    expect(items.find((item) => item.name === "サムネイル")?.taxCategory).toBe("taxable_8");
  });
});
