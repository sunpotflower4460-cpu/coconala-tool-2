import type { DatabasePort } from "@/application/ports/database";

/** 保存済み画像を <img src> に使える data URL で返す。見つからなければ null。 */
export async function getImageAssetDataUrl(
  db: DatabasePort,
  sha256: string | null | undefined,
): Promise<string | null> {
  if (!sha256) return null;
  const rows = await db.select<{ mime_type: string; data_base64: string }>(
    "SELECT mime_type, data_base64 FROM app_assets WHERE sha256 = ?",
    [sha256],
  );
  const row = rows[0];
  if (!row || (row.mime_type !== "image/png" && row.mime_type !== "image/jpeg")) return null;
  return `data:${row.mime_type};base64,${row.data_base64}`;
}
