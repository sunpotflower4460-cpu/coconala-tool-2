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
import { decodeCsvBytes } from "@/domain/csv/encoding";
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

  it("列順が違っても列名で取り込む", async () => {
    const rows = parseCsv("単価,商品名,単位\n8000,ロゴ制作,式\n");
    const [header, ...dataRows] = rows;
    const mapping = guessColumnMapping(header!, CATALOG_ITEM_CSV_FIELDS);
    const validated = validateCatalogItemRows(dataRows, mapping);
    const summary = await importCatalogItemsCsv(db, validated, "skip");
    expect(summary.imported).toBe(1);
    const items = await listCatalogItems(db);
    expect(items[0]?.name).toBe("ロゴ制作");
    expect(items[0]?.unitPriceYen).toBe(8000);
  });

  it("余分な列があっても必須列があれば取り込む", async () => {
    const rows = parseCsv("商品名,単位,単価,税区分,社内メモ\n撮影,時間,12000,,捨てる列\n");
    const [header, ...dataRows] = rows;
    const mapping = guessColumnMapping(header!, CATALOG_ITEM_CSV_FIELDS);
    const validated = validateCatalogItemRows(dataRows, mapping);
    const summary = await importCatalogItemsCsv(db, validated, "skip");
    expect(summary.imported).toBe(1);
  });

  it("必須列が無い場合は全行失敗になる", async () => {
    const rows = parseCsv("単位,税区分\n本,taxable_10\n");
    const [header, ...dataRows] = rows;
    const mapping = guessColumnMapping(header!, CATALOG_ITEM_CSV_FIELDS);
    const validated = validateCatalogItemRows(dataRows, mapping);
    const summary = await importCatalogItemsCsv(db, validated, "skip");
    expect(summary.imported).toBe(0);
    expect(summary.failed).toBe(1);
  });

  it("UTF-8 BOM付き日本語CSVを取り込める", async () => {
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const body = new TextEncoder().encode("商品名,単位,単価\n日本語商品名,式,1000\n");
    const merged = new Uint8Array(bom.length + body.length);
    merged.set(bom, 0);
    merged.set(body, bom.length);
    const { text } = decodeCsvBytes(merged.buffer);
    const rows = parseCsv(text);
    const [header, ...dataRows] = rows;
    const mapping = guessColumnMapping(header!, CATALOG_ITEM_CSV_FIELDS);
    const validated = validateCatalogItemRows(dataRows, mapping);
    const summary = await importCatalogItemsCsv(db, validated, "skip");
    expect(summary.imported).toBe(1);
    const items = await listCatalogItems(db);
    expect(items.some((item) => item.name === "日本語商品名")).toBe(true);
  });

  it("空行を含むCSVでも正常行だけ取り込む", async () => {
    const rows = parseCsv("商品名,単位,単価\n\n空行の後,式,2000\n\n");
    const [header, ...dataRows] = rows;
    const mapping = guessColumnMapping(header!, CATALOG_ITEM_CSV_FIELDS);
    const validated = validateCatalogItemRows(dataRows, mapping);
    const summary = await importCatalogItemsCsv(db, validated, "skip");
    expect(summary.imported).toBe(1);
    expect(summary.failed).toBe(0);
  });

  it("重複データは skip で2回目に増やさない", async () => {
    const rows = parseCsv("商品名,単位,単価\n重複商品,式,3000\n");
    const [header, ...dataRows] = rows;
    const mapping = guessColumnMapping(header!, CATALOG_ITEM_CSV_FIELDS);
    const validated = validateCatalogItemRows(dataRows, mapping);
    await importCatalogItemsCsv(db, validated, "skip");
    const second = await importCatalogItemsCsv(db, validated, "skip");
    expect(second.skipped).toBe(1);
    expect(second.imported).toBe(0);
    expect(await listCatalogItems(db)).toHaveLength(1);
  });

  it("5000件の価格表CSVをクラッシュせず取り込める", async () => {
    const lines = ["商品名,単位,単価"];
    for (let index = 0; index < 5000; index += 1) {
      lines.push(`大量商品${index},個,${1000 + (index % 50)}`);
    }
    const rows = parseCsv(lines.join("\n"));
    const [header, ...dataRows] = rows;
    const mapping = guessColumnMapping(header!, CATALOG_ITEM_CSV_FIELDS);
    const validated = validateCatalogItemRows(dataRows, mapping);
    const started = Date.now();
    const summary = await importCatalogItemsCsv(db, validated, "skip");
    const elapsedMs = Date.now() - started;
    expect(summary.imported).toBe(5000);
    expect(summary.failed).toBe(0);
    expect(await listCatalogItems(db)).toHaveLength(5000);
    console.warn(`csv-import 5000件: ${elapsedMs}ms (宣伝文句には使わない計測値)`);
  }, 60_000);
});
