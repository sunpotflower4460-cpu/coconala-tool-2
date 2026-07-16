import type { DatabasePort } from "@/application/ports/database";
import type { SystemInfoProvider } from "@/application/ports/system-info";
import { getAppSettings } from "@/application/queries/get-app-settings.query";
import { CURRENT_SCHEMA_VERSION } from "@/domain/shared/schema-version";
import { toAppError, type AppError } from "@/application/errors";
import { err, ok, type Result } from "@/lib/result";

export interface DiagnosticsReport {
  generatedAt: string;
  appVersion: string;
  os: string;
  osArch: string;
  dbSizeBytes: number;
  dbSchemaVersion: number | null;
  currentSchemaVersion: number;
  aiEnabled: boolean;
  counts: {
    clients: number;
    catalogItems: number;
    documents: number;
  };
}

async function countRows(db: DatabasePort, table: string): Promise<number> {
  const rows = await db.select<{ count: number }>(`SELECT COUNT(*) as count FROM ${table}`);
  return rows[0]?.count ?? 0;
}

// 診断情報は、件数・バージョン等の集計値のみを含む。顧客名・会社名・APIキー等は一切含めない。
export async function buildDiagnosticsReport(
  db: DatabasePort,
  systemInfoProvider: SystemInfoProvider,
  now: Date = new Date(),
): Promise<Result<DiagnosticsReport, AppError>> {
  try {
    const [systemInfo, settings, clients, catalogItems, documents] = await Promise.all([
      systemInfoProvider.get(),
      getAppSettings(db),
      countRows(db, "clients"),
      countRows(db, "catalog_items"),
      countRows(db, "documents"),
    ]);

    return ok({
      generatedAt: now.toISOString(),
      appVersion: systemInfo.appVersion,
      os: systemInfo.os,
      osArch: systemInfo.osArch,
      dbSizeBytes: systemInfo.dbSizeBytes,
      dbSchemaVersion: systemInfo.dbSchemaVersion,
      currentSchemaVersion: CURRENT_SCHEMA_VERSION,
      aiEnabled: settings.aiEnabled,
      counts: { clients, catalogItems, documents },
    });
  } catch (error) {
    return err(toAppError(error, "診断情報の作成に失敗しました"));
  }
}
