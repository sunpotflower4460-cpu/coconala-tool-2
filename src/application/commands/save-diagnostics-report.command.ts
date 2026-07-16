import type { FileExportPort } from "@/application/ports/file-export";
import type { DiagnosticsReport } from "@/application/commands/build-diagnostics-report.command";
import { toAppError, type AppError } from "@/application/errors";
import { containsSecretLikeContent } from "@/domain/diagnostics/secret-scan";
import { formatTimestampLabel } from "@/lib/formatting/timestamp-label";
import { err, ok, type Result } from "@/lib/result";

export async function saveDiagnosticsReport(
  fileExport: FileExportPort,
  report: DiagnosticsReport,
  now: Date = new Date(),
): Promise<Result<string | null, AppError>> {
  const content = JSON.stringify(report, null, 2);
  if (containsSecretLikeContent(content)) {
    return err({
      code: "unsafe_diagnostics_content",
      message:
        "診断内容に秘密情報らしき文字列が含まれているため保存を中止しました。この画面の内容を控えて開発者へご連絡ください。",
    });
  }
  try {
    const path = await fileExport.saveTextFile(
      `mitsumori-desk-diagnostics-${formatTimestampLabel(now)}.json`,
      content,
    );
    return ok(path);
  } catch (error) {
    return err(toAppError(error, "診断ファイルの保存に失敗しました"));
  }
}
