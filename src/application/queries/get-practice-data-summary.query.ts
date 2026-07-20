import type { DatabasePort } from "@/application/ports/database";

export interface PracticeDataSummary {
  hasPracticeData: boolean;
  clientCount: number;
  catalogItemCount: number;
  documentCount: number;
  companyIsPractice: boolean;
}

async function countPracticeRows(db: DatabasePort, table: string): Promise<number> {
  const rows = await db.select<{ count: number }>(
    `SELECT COUNT(*) as count FROM ${table} WHERE is_practice_data = 1`,
  );
  return rows[0]?.count ?? 0;
}

export async function getPracticeDataSummary(db: DatabasePort): Promise<PracticeDataSummary> {
  const [clientCount, catalogItemCount, documentCount, companyRows] = await Promise.all([
    countPracticeRows(db, "clients"),
    countPracticeRows(db, "catalog_items"),
    countPracticeRows(db, "documents"),
    db.select<{ count: number }>(
      `SELECT COUNT(*) as count FROM companies WHERE id = 1 AND is_practice_data = 1`,
    ),
  ]);
  const companyIsPractice = (companyRows[0]?.count ?? 0) > 0;
  return {
    hasPracticeData:
      clientCount > 0 || catalogItemCount > 0 || documentCount > 0 || companyIsPractice,
    clientCount,
    catalogItemCount,
    documentCount,
    companyIsPractice,
  };
}
