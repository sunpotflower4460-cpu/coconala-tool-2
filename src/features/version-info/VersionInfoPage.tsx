import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";
import { updateAppSettings } from "@/application/commands/update-app-settings.command";
import { getAppSettings } from "@/application/queries/get-app-settings.query";
import type { LicenseStatus } from "@/application/ports/license";
import type { UpdateCheckResult } from "@/application/ports/update-check";
import { ErrorBanner } from "@/components/feedback/ErrorBanner";
import { CURRENT_SCHEMA_VERSION } from "@/domain/shared/schema-version";
import { useDatabase } from "@/infrastructure/database/use-database";
import { tauriSystemInfoProvider } from "@/infrastructure/diagnostics/tauri-system-info-provider";
import { noLicenseCheck } from "@/infrastructure/license/no-license-check";
import { notConfiguredUpdateCheck } from "@/infrastructure/updates/not-configured-update-check";

const LICENSE_LABELS: Record<LicenseStatus["state"], string> = {
  unlicensed: "ライセンス管理なし(現在は無償・テスト配布)",
  valid: "有効",
  invalid: "無効",
};

function updateResultLabel(result: UpdateCheckResult): string {
  switch (result.status) {
    case "not_configured":
      return "更新確認は未設定です(署名鍵・配置先の準備後に有効化されます)";
    case "up_to_date":
      return "最新バージョンです";
    case "available":
      return `新しいバージョン(${result.version})が利用可能です`;
    case "error":
      return `更新確認に失敗しました: ${result.message}`;
  }
}

export function VersionInfoPage() {
  const db = useDatabase();
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [dbSchemaVersion, setDbSchemaVersion] = useState<number | null>(null);
  const [os, setOs] = useState<string | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [updateCheckEnabled, setUpdateCheckEnabled] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void getVersion().then(setAppVersion);
    void tauriSystemInfoProvider.get().then((info) => {
      setDbSchemaVersion(info.dbSchemaVersion);
      setOs(`${info.os} (${info.osArch})`);
    });
    void noLicenseCheck.check().then(setLicenseStatus);
    void getAppSettings(db).then((settings) =>
      setUpdateCheckEnabled(settings.featureFlags.updateCheckEnabled),
    );
  }, [db]);

  async function handleToggleUpdateCheck(next: boolean) {
    setErrorMessage(null);
    const settings = await getAppSettings(db);
    const result = await updateAppSettings(db, {
      featureFlags: { ...settings.featureFlags, updateCheckEnabled: next },
    });
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    setUpdateCheckEnabled(next);
  }

  async function handleCheckUpdate() {
    setCheckingUpdate(true);
    const result = await notConfiguredUpdateCheck.check();
    setUpdateResult(result);
    setCheckingUpdate(false);
  }

  return (
    <div>
      <h1>バージョン情報</h1>
      {errorMessage && <ErrorBanner message={errorMessage} />}

      <dl>
        <dt>アプリバージョン</dt>
        <dd>{appVersion ?? "確認中…"}</dd>
        <dt>データベースのスキーマバージョン</dt>
        <dd>
          {dbSchemaVersion ?? "確認中…"} (アプリが想定するバージョン: {CURRENT_SCHEMA_VERSION})
        </dd>
        <dt>動作環境</dt>
        <dd>{os ?? "確認中…"}</dd>
        <dt>ライセンス</dt>
        <dd>{licenseStatus ? LICENSE_LABELS[licenseStatus.state] : "確認中…"}</dd>
      </dl>

      <h2>更新確認</h2>
      <p>
        署名鍵と更新ファイルの配置先が準備でき次第、有効化できます。有効化していない間、または未設定の場合でも、既存のデータには一切影響しません。
      </p>
      <label>
        <input
          type="checkbox"
          checked={updateCheckEnabled}
          onChange={(event) => {
            void handleToggleUpdateCheck(event.target.checked);
          }}
        />
        起動時に更新を確認する(準備ができてから有効化してください)
      </label>
      <div style={{ marginTop: "0.5rem" }}>
        <button
          type="button"
          disabled={checkingUpdate}
          onClick={() => {
            void handleCheckUpdate();
          }}
        >
          今すぐ更新を確認
        </button>
        {updateResult && <p role="status">{updateResultLabel(updateResult)}</p>}
      </div>
    </div>
  );
}
