import type { DatabasePort } from "@/application/ports/database";
import { createCatalogItem, updateCatalogItem } from "@/application/commands/catalog-item.commands";
import type { CsvImportSummary, DuplicatePolicy } from "@/application/commands/csv-import-summary";
import type { CatalogItemInput } from "@/domain/catalog/types";
import type { CsvRowIssue } from "@/domain/csv/types";

async function findCatalogItemIdByName(db: DatabasePort, name: string): Promise<number | null> {
  const rows = await db.select<{ id: number }>(
    `SELECT id FROM catalog_items WHERE name = ? LIMIT 1`,
    [name],
  );
  return rows[0]?.id ?? null;
}

export async function importCatalogItemsCsv(
  db: DatabasePort,
  rows: CsvRowIssue<CatalogItemInput>[],
  duplicatePolicy: DuplicatePolicy,
): Promise<CsvImportSummary> {
  const summary: CsvImportSummary = { imported: 0, updated: 0, skipped: 0, failed: 0 };

  for (const row of rows) {
    if (row.errors.length > 0 || row.data === null) {
      summary.failed += 1;
      continue;
    }
    const existingId = await findCatalogItemIdByName(db, row.data.name);
    if (existingId !== null) {
      if (duplicatePolicy === "skip") {
        summary.skipped += 1;
        continue;
      }
      const result = await updateCatalogItem(db, existingId, row.data);
      if (result.ok) summary.updated += 1;
      else summary.failed += 1;
      continue;
    }
    const result = await createCatalogItem(db, row.data);
    if (result.ok) summary.imported += 1;
    else summary.failed += 1;
  }

  return summary;
}
