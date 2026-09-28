import type { DatabasePort } from "@/application/ports/database";
import type { LicenseStatus, LicenseVerifierPort } from "@/application/ports/license";

/**
 * 保存済みのライセンスキーを検証して状態を返す。例外は投げない
 * (状態が分からなくても、帳票データの利用は止めない)。
 */
export async function getLicenseStatus(
  db: DatabasePort,
  verifier: LicenseVerifierPort,
): Promise<LicenseStatus> {
  try {
    const rows = await db.select<{ license_key: string | null }>(
      "SELECT license_key FROM app_settings WHERE id = 1",
    );
    const key = rows[0]?.license_key ?? null;
    if (!key) return { state: "unlicensed" };
    return await verifier.verify(key);
  } catch {
    return { state: "invalid", reason: "verifier_unavailable" };
  }
}
