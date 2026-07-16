import { useEffect, useState } from "react";
import { buildDiagnosticsReport } from "@/application/commands/build-diagnostics-report.command";
import { createBackup } from "@/application/commands/create-backup.command";
import { deletePracticeData } from "@/application/commands/delete-practice-data.command";
import { restoreBackup } from "@/application/commands/restore-backup.command";
import { saveDiagnosticsReport } from "@/application/commands/save-diagnostics-report.command";
import { seedPracticeData } from "@/application/commands/seed-practice-data.command";
import type { BackupInfo } from "@/application/ports/backup-store";
import {
  getPracticeDataSummary,
  type PracticeDataSummary,
} from "@/application/queries/get-practice-data-summary.query";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { ErrorBanner } from "@/components/feedback/ErrorBanner";
import { CURRENT_SCHEMA_VERSION } from "@/domain/shared/schema-version";
import { tauriBackupStore } from "@/infrastructure/backup/tauri-backup-store";
import { tauriFileExport } from "@/infrastructure/diagnostics/tauri-file-export";
import { tauriSystemInfoProvider } from "@/infrastructure/diagnostics/tauri-system-info-provider";
import { useDatabase } from "@/infrastructure/database/use-database";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

export function DataManagementPage() {
  const db = useDatabase();
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupInfo | null>(null);
  const [restoreDone, setRestoreDone] = useState(false);

  const [diagnosticsMessage, setDiagnosticsMessage] = useState<string | null>(null);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);

  const [practiceSummary, setPracticeSummary] = useState<PracticeDataSummary | null>(null);
  const [practiceError, setPracticeError] = useState<string | null>(null);
  const [practiceBusy, setPracticeBusy] = useState(false);
  const [showDeletePracticeConfirm, setShowDeletePracticeConfirm] = useState(false);

  function reloadBackups() {
    void tauriBackupStore
      .list()
      .then(setBackups)
      .catch(() => setBackups([]));
  }

  function reloadPracticeSummary() {
    void getPracticeDataSummary(db).then(setPracticeSummary);
  }

  useEffect(() => {
    reloadBackups();
    reloadPracticeSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  async function handleCreateBackup() {
    setBackupBusy(true);
    setBackupError(null);
    const result = await createBackup(tauriBackupStore);
    setBackupBusy(false);
    if (!result.ok) {
      setBackupError(result.error.message);
      return;
    }
    reloadBackups();
  }

  async function handleRestore() {
    if (!restoreTarget) return;
    setBackupBusy(true);
    setBackupError(null);
    const result = await restoreBackup(tauriBackupStore, restoreTarget.fileName);
    setBackupBusy(false);
    setRestoreTarget(null);
    if (!result.ok) {
      setBackupError(result.error.message);
      return;
    }
    setRestoreDone(true);
    reloadBackups();
  }

  async function handleSaveDiagnostics() {
    setDiagnosticsError(null);
    setDiagnosticsMessage(null);
    const report = await buildDiagnosticsReport(db, tauriSystemInfoProvider);
    if (!report.ok) {
      setDiagnosticsError(report.error.message);
      return;
    }
    const saved = await saveDiagnosticsReport(tauriFileExport, report.value);
    if (!saved.ok) {
      setDiagnosticsError(saved.error.message);
      return;
    }
    setDiagnosticsMessage(
      saved.value ? `保存しました: ${saved.value}` : "保存をキャンセルしました",
    );
  }

  async function handleSeedPractice() {
    setPracticeBusy(true);
    setPracticeError(null);
    const result = await seedPracticeData(db);
    setPracticeBusy(false);
    if (!result.ok) {
      setPracticeError(result.error.message);
      return;
    }
    reloadPracticeSummary();
  }

  async function handleDeletePractice() {
    setShowDeletePracticeConfirm(false);
    setPracticeBusy(true);
    setPracticeError(null);
    const result = await deletePracticeData(db);
    setPracticeBusy(false);
    if (!result.ok) {
      setPracticeError(result.error.message);
      return;
    }
    reloadPracticeSummary();
  }

  return (
    <div>
      <h1>データ管理</h1>

      <section>
        <h2>練習モード</h2>
        <p>
          サンプルの会社・顧客・価格表・見積を自動作成して、実際のデータを入力する前に操作を試せます。
          既に会社情報を登録済みの場合、会社情報は上書きされません。
        </p>
        {practiceError && <ErrorBanner message={practiceError} />}
        {practiceSummary && (
          <p role="status">
            {practiceSummary.hasPracticeData
              ? `練習データあり(顧客${practiceSummary.clientCount}件・価格表${practiceSummary.catalogItemCount}件・見積${practiceSummary.documentCount}件)`
              : "現在、練習データはありません"}
          </p>
        )}
        {!practiceSummary?.hasPracticeData && (
          <button
            type="button"
            disabled={practiceBusy}
            onClick={() => {
              void handleSeedPractice();
            }}
          >
            練習用データを作成
          </button>
        )}
        {practiceSummary?.hasPracticeData && (
          <button
            type="button"
            disabled={practiceBusy}
            onClick={() => setShowDeletePracticeConfirm(true)}
          >
            練習データを一括削除
          </button>
        )}
        <ConfirmDialog
          open={showDeletePracticeConfirm}
          title="練習データを削除しますか?"
          description="練習モードで作成した会社・顧客・価格表・見積のみを削除します。実際に登録したデータは削除されません。"
          confirmLabel="削除する"
          onConfirm={() => void handleDeletePractice()}
          onCancel={() => setShowDeletePracticeConfirm(false)}
        />
      </section>

      <section>
        <h2>バックアップ</h2>
        <p>
          作成したバックアップはこのパソコン内にのみ保存されます。インターネットへは送信されません。
        </p>
        {backupError && <ErrorBanner message={backupError} />}
        {restoreDone && (
          <p role="status">復元が完了しました。反映するにはアプリを再起動してください。</p>
        )}
        <button
          type="button"
          disabled={backupBusy}
          onClick={() => {
            void handleCreateBackup();
          }}
        >
          バックアップを作成
        </button>
        <ul>
          {backups.map((backup) => {
            const versionMismatch =
              backup.schemaVersion !== null && backup.schemaVersion > CURRENT_SCHEMA_VERSION;
            return (
              <li key={backup.fileName}>
                {backup.fileName}({formatSize(backup.sizeBytes)}
                {backup.schemaVersion !== null && `, スキーマver.${backup.schemaVersion}`}
                {versionMismatch && " ※新しいバージョンで作成されたバックアップです"})
                <button
                  type="button"
                  disabled={backupBusy}
                  onClick={() => setRestoreTarget(backup)}
                >
                  復元
                </button>
              </li>
            );
          })}
          {backups.length === 0 && <li>まだバックアップがありません</li>}
        </ul>
        <ConfirmDialog
          open={restoreTarget !== null}
          title="このバックアップから復元しますか?"
          description={`現在のデータは自動的に退避してから復元します。復元後はアプリの再起動が必要です。(${restoreTarget?.fileName ?? ""})`}
          confirmLabel="復元する"
          onConfirm={() => void handleRestore()}
          onCancel={() => setRestoreTarget(null)}
        />
      </section>

      <section>
        <h2>診断ファイル</h2>
        <p>
          顧客名・会社名・APIキーなどの個人情報・秘密情報を含まない、件数とバージョン情報のみの診断ファイルを保存します。
          サポートへ問い合わせる際に添付してください。
        </p>
        {diagnosticsError && <ErrorBanner message={diagnosticsError} />}
        {diagnosticsMessage && <p role="status">{diagnosticsMessage}</p>}
        <button
          type="button"
          onClick={() => {
            void handleSaveDiagnostics();
          }}
        >
          診断ファイルを保存
        </button>
      </section>
    </div>
  );
}
