import type { DatabasePort } from "@/application/ports/database";
import type { AppSettings } from "@/domain/shared/app-settings";
import type { RoundingMode } from "@/domain/tax/types";

interface AppSettingsRow {
  rounding_mode: RoundingMode;
  document_number_prefix_estimate: string;
  document_number_prefix_invoice: string;
  document_number_prefix_delivery: string;
  document_number_prefix_receipt: string;
  theme: string;
  ai_enabled: number;
  ai_model: string;
  onboarding_completed: number;
  onboarding_step: string;
}

function mapAppSettingsRow(row: AppSettingsRow): AppSettings {
  return {
    roundingMode: row.rounding_mode,
    documentNumberPrefixEstimate: row.document_number_prefix_estimate,
    documentNumberPrefixInvoice: row.document_number_prefix_invoice,
    documentNumberPrefixDelivery: row.document_number_prefix_delivery,
    documentNumberPrefixReceipt: row.document_number_prefix_receipt,
    theme: row.theme === "light" || row.theme === "dark" ? row.theme : "system",
    aiEnabled: row.ai_enabled === 1,
    aiModel: row.ai_model,
    onboardingCompleted: row.onboarding_completed === 1,
    onboardingStep: row.onboarding_step,
  };
}

export async function getAppSettings(db: DatabasePort): Promise<AppSettings> {
  const rows = await db.select<AppSettingsRow>(
    `SELECT rounding_mode, document_number_prefix_estimate, document_number_prefix_invoice,
            document_number_prefix_delivery, document_number_prefix_receipt, theme, ai_enabled,
            ai_model, onboarding_completed, onboarding_step
     FROM app_settings WHERE id = 1`,
  );
  const row = rows[0];
  if (!row) {
    throw new Error("app_settingsが初期化されていません");
  }
  return mapAppSettingsRow(row);
}
