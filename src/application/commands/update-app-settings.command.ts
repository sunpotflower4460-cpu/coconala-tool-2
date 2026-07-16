import type { DatabasePort } from "@/application/ports/database";
import { toAppError, type AppError } from "@/application/errors";
import { getAppSettings } from "@/application/queries/get-app-settings.query";
import type { AppSettings, AppSettingsInput } from "@/domain/shared/app-settings";
import { err, ok, type Result } from "@/lib/result";

export async function updateAppSettings(
  db: DatabasePort,
  input: AppSettingsInput,
): Promise<Result<AppSettings, AppError>> {
  try {
    const current = await getAppSettings(db);
    const next: AppSettings = { ...current, ...input };
    const now = new Date().toISOString();

    await db.execute(
      `UPDATE app_settings SET
         rounding_mode = ?,
         document_number_prefix_estimate = ?,
         document_number_prefix_invoice = ?,
         document_number_prefix_delivery = ?,
         document_number_prefix_receipt = ?,
         theme = ?,
         ai_enabled = ?,
         onboarding_completed = ?,
         updated_at = ?
       WHERE id = 1`,
      [
        next.roundingMode,
        next.documentNumberPrefixEstimate,
        next.documentNumberPrefixInvoice,
        next.documentNumberPrefixDelivery,
        next.documentNumberPrefixReceipt,
        next.theme,
        next.aiEnabled ? 1 : 0,
        next.onboardingCompleted ? 1 : 0,
        now,
      ],
    );

    return ok(next);
  } catch (error) {
    return err(toAppError(error, "設定の保存に失敗しました"));
  }
}
