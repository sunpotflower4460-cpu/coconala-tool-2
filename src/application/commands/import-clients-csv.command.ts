import type { DatabasePort } from "@/application/ports/database";
import { createClient, updateClient } from "@/application/commands/client.commands";
import type { CsvImportSummary, DuplicatePolicy } from "@/application/commands/csv-import-summary";
import type { ClientInput } from "@/domain/clients/types";
import type { CsvRowIssue } from "@/domain/csv/types";

async function findClientIdByName(db: DatabasePort, name: string): Promise<number | null> {
  const rows = await db.select<{ id: number }>(`SELECT id FROM clients WHERE name = ? LIMIT 1`, [
    name,
  ]);
  return rows[0]?.id ?? null;
}

export async function importClientsCsv(
  db: DatabasePort,
  rows: CsvRowIssue<ClientInput>[],
  duplicatePolicy: DuplicatePolicy,
): Promise<CsvImportSummary> {
  const summary: CsvImportSummary = { imported: 0, updated: 0, skipped: 0, failed: 0 };

  for (const row of rows) {
    if (row.errors.length > 0 || row.data === null) {
      summary.failed += 1;
      continue;
    }
    const existingId = await findClientIdByName(db, row.data.name);
    if (existingId !== null) {
      if (duplicatePolicy === "skip") {
        summary.skipped += 1;
        continue;
      }
      const result = await updateClient(db, existingId, row.data);
      if (result.ok) summary.updated += 1;
      else summary.failed += 1;
      continue;
    }
    const result = await createClient(db, row.data);
    if (result.ok) summary.imported += 1;
    else summary.failed += 1;
  }

  return summary;
}
