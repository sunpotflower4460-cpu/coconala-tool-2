import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decodeCsvBytes } from "@/domain/csv/encoding";
import {
  CATALOG_ITEM_CSV_FIELDS,
  CLIENT_CSV_FIELDS,
  guessColumnMapping,
} from "@/domain/csv/fields";
import { parseCsv } from "@/domain/csv/parse";
import { validateCatalogItemRows } from "@/domain/csv/validate-catalog-item-rows";
import { validateClientRows } from "@/domain/csv/validate-client-rows";

const samplesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../delivery/samples",
);

function load(name: string): string[][] {
  const bytes = readFileSync(path.join(samplesDir, name));
  return parseCsv(
    decodeCsvBytes(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length)).text,
  );
}

describe("納品物に同梱するサンプルCSV", () => {
  it("顧客サンプルはそのまま取り込める", () => {
    const [header, ...rows] = load("顧客サンプル.csv");
    const validated = validateClientRows(rows, guessColumnMapping(header!, CLIENT_CSV_FIELDS));
    expect(validated.length).toBeGreaterThan(0);
    expect(validated.flatMap((row) => row.errors)).toEqual([]);
  });

  it("価格表サンプルはそのまま取り込める", () => {
    const [header, ...rows] = load("価格表サンプル.csv");
    const validated = validateCatalogItemRows(
      rows,
      guessColumnMapping(header!, CATALOG_ITEM_CSV_FIELDS),
    );
    expect(validated.length).toBeGreaterThan(0);
    expect(validated.flatMap((row) => row.errors)).toEqual([]);
  });
});
