import type { DatabasePort } from "@/application/ports/database";
import type { LicenseStatus, LicenseVerifierPort } from "@/application/ports/license";
import { toAppError, type AppError } from "@/application/errors";
import { looksLikeLicenseKey, normalizeLicenseKey } from "@/domain/license/license-key";
import { err, ok, type Result } from "@/lib/result";

/**
 * ライセンスキーを検証し、正しい場合だけ保存する。
 * 誤ったキーは保存しない(以前に登録した正しいキーを上書きしない)。
 */
export async function activateLicense(
  db: DatabasePort,
  verifier: LicenseVerifierPort,
  rawKey: string,
): Promise<Result<LicenseStatus & { state: "valid" }, AppError>> {
  const key = normalizeLicenseKey(rawKey);
  if (!key) {
    return err({ code: "license_empty", message: "ライセンスキーを貼り付けてください。" });
  }
  if (!looksLikeLicenseKey(key)) {
    return err({
      code: "license_malformed",
      message:
        "ライセンスキーの形式が正しくありません。「MDK1.」で始まる文字列を、途中で切れないようにすべて貼り付けてください。",
    });
  }
  const status = await verifier.verify(key);
  if (status.state !== "valid") {
    return err({
      code: "license_invalid",
      message:
        status.state === "invalid" && status.reason === "verifier_unavailable"
          ? "ライセンスキーを確認できませんでした。アプリを再起動してからもう一度お試しください。"
          : "このライセンスキーは正しくありません。ココナラのトークルームでお届けしたキーをそのまま貼り付けてください。",
    });
  }
  try {
    await db.execute(
      "UPDATE app_settings SET license_key = ?, license_activated_at = ?, updated_at = ? WHERE id = 1",
      [key, new Date().toISOString(), new Date().toISOString()],
    );
    return ok(status);
  } catch (error) {
    return err(toAppError(error, "ライセンスキーの保存に失敗しました。"));
  }
}

/** 登録済みのライセンスキーを削除する(別のPCへ移るときなど)。データには影響しない。 */
export async function removeLicense(db: DatabasePort): Promise<Result<null, AppError>> {
  try {
    await db.execute(
      "UPDATE app_settings SET license_key = NULL, license_activated_at = NULL, updated_at = ? WHERE id = 1",
      [new Date().toISOString()],
    );
    return ok(null);
  } catch (error) {
    return err(toAppError(error, "ライセンスキーの削除に失敗しました。"));
  }
}
