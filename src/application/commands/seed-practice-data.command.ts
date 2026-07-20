import type { DatabasePort } from "@/application/ports/database";
import { toAppError, type AppError } from "@/application/errors";
import { saveEstimateDraft } from "@/application/commands/save-estimate-draft.command";
import { err, ok, type Result } from "@/lib/result";

export const PRACTICE_INQUIRY_SAMPLE_TEXT =
  "お世話になっております。動画編集を3本、サムネイル制作を2枚お願いしたいです。来週金曜までに納品可能でしょうか。";

export interface PracticeSeedResult {
  clientId: number;
  catalogItemIds: number[];
  documentId: number;
  inquirySampleText: string;
  companySeeded: boolean;
}

interface CatalogSeed {
  name: string;
  unit: string;
  unitPriceYen: number;
}

const PRACTICE_CATALOG_ITEMS: CatalogSeed[] = [
  { name: "動画編集(基本)", unit: "本", unitPriceYen: 15000 },
  { name: "サムネイル制作", unit: "枚", unitPriceYen: 3000 },
  { name: "テロップ入れ", unit: "本", unitPriceYen: 5000 },
];

// 練習モードは、既存の会社情報を絶対に上書きしない。
// 会社情報が未設定(初回設定前)の場合のみ、練習用の会社情報を仮登録する。
async function seedPracticeCompanyIfMissing(db: DatabasePort, now: string): Promise<boolean> {
  const rows = await db.select<{ count: number }>(
    `SELECT COUNT(*) as count FROM companies WHERE id = 1`,
  );
  if ((rows[0]?.count ?? 0) > 0) {
    return false;
  }
  await db.execute(
    `INSERT INTO companies (
       id, display_name, representative_name, estimate_valid_days, payment_due_days,
       is_practice_data, created_at, updated_at
     ) VALUES (1, ?, ?, ?, ?, 1, ?, ?)`,
    ["練習用会社(サンプル)", "練習 太郎", 30, 30, now, now],
  );
  return true;
}

export async function seedPracticeData(
  db: DatabasePort,
): Promise<Result<PracticeSeedResult, AppError>> {
  try {
    const now = new Date().toISOString();
    const companySeeded = await seedPracticeCompanyIfMissing(db, now);

    const clientResult = await db.execute(
      `INSERT INTO clients (name, contact_name, note, is_practice_data, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?)`,
      ["サンプル株式会社", "サンプル 花子", "練習モードで自動作成されたデータです", now, now],
    );
    const clientId = clientResult.lastInsertId;

    const catalogItemIds: number[] = [];
    for (const item of PRACTICE_CATALOG_ITEMS) {
      const result = await db.execute(
        `INSERT INTO catalog_items (
           name, unit, unit_price_yen, tax_category, is_active, is_practice_data, created_at, updated_at
         ) VALUES (?, ?, ?, 'taxable_10', 1, 1, ?, ?)`,
        [item.name, item.unit, item.unitPriceYen, now, now],
      );
      catalogItemIds.push(result.lastInsertId);
    }

    const draftResult = await saveEstimateDraft(db, {
      id: null,
      clientId,
      issueDate: null,
      dueDate: null,
      validUntil: null,
      pricingType: "tax_exclusive",
      discountYen: 0,
      note: "練習モードで自動作成された見積です。自由に編集・削除して操作を試せます。",
      lines: PRACTICE_CATALOG_ITEMS.map((item, index) => ({
        catalogItemId: catalogItemIds[index] ?? null,
        name: item.name,
        description: null,
        unit: item.unit,
        quantity: index === 0 ? 3 : index === 1 ? 2 : 1,
        unitPriceYen: item.unitPriceYen,
        taxCategory: "taxable_10",
        lineDiscountYen: 0,
      })),
    });
    if (!draftResult.ok) {
      return err(draftResult.error);
    }
    const documentId = draftResult.value.header.id;
    if (documentId === null) {
      return err({ code: "save_failed", message: "練習用見積の作成に失敗しました" });
    }
    await db.execute(`UPDATE documents SET is_practice_data = 1 WHERE id = ?`, [documentId]);

    return ok({
      clientId,
      catalogItemIds,
      documentId,
      inquirySampleText: PRACTICE_INQUIRY_SAMPLE_TEXT,
      companySeeded,
    });
  } catch (error) {
    return err(toAppError(error, "練習用データの作成に失敗しました"));
  }
}
