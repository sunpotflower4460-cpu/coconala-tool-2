import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";
import { activateLicense, removeLicense } from "@/application/commands/license.commands";
import type { UpdateCheckResult } from "@/application/ports/update-check";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { ErrorBanner } from "@/components/feedback/ErrorBanner";
import { CURRENT_SCHEMA_VERSION } from "@/domain/shared/schema-version";
import { useDatabase } from "@/infrastructure/database/use-database";
import { tauriSystemInfoProvider } from "@/infrastructure/diagnostics/tauri-system-info-provider";
import { notConfiguredUpdateCheck } from "@/infrastructure/updates/not-configured-update-check";
import { useLicense } from "@/features/license/license-context";
import {
  LICENSE_INVALID_REASON_LABELS,
  LICENSE_LABELS,
  updateResultLabel,
} from "@/features/version-info/labels";

export function VersionInfoPage() {
  const db = useDatabase();
  const license = useLicense();
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [dbSchemaVersion, setDbSchemaVersion] = useState<number | null>(null);
  const [os, setOs] = useState<string | null>(null);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [licenseInput, setLicenseInput] = useState("");
  const [licenseBusy, setLicenseBusy] = useState(false);
  const [licenseMessage, setLicenseMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  useEffect(() => {
    void getVersion()
      .then(setAppVersion)
      .catch(() => setAppVersion("不明"));
    void tauriSystemInfoProvider
      .get()
      .then((info) => {
        setDbSchemaVersion(info.dbSchemaVersion);
        setOs(`${info.os} (${info.osArch})`);
      })
      .catch(() => setOs("不明"));
  }, []);

  async function handleActivate() {
    setLicenseBusy(true);
    setErrorMessage(null);
    setLicenseMessage(null);
    const result = await activateLicense(db, license.verifier, licenseInput);
    setLicenseBusy(false);
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    setLicenseInput("");
    setLicenseMessage("ライセンスキーを登録しました。ご購入ありがとうございます。");
    license.refresh();
  }

  async function handleRemove() {
    setLicenseBusy(true);
    setErrorMessage(null);
    const result = await removeLicense(db);
    setLicenseBusy(false);
    setShowRemoveConfirm(false);
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    setLicenseMessage("ライセンスキーを削除しました。");
    license.refresh();
  }

  const status = license.status;

  return (
    <div>
      <h1>バージョン情報</h1>
      {errorMessage && <ErrorBanner message={errorMessage} code="license_error" />}
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
        <dd>
          {status ? LICENSE_LABELS[status.state] : "確認中…"}
          {status?.state === "valid" && (
            <>
              <br />
              ライセンス番号: {status.licenseId}(発行日 {status.issuedAt})
            </>
          )}
          {status?.state === "invalid" && (
            <>
              <br />
              {LICENSE_INVALID_REASON_LABELS[status.reason]}
            </>
          )}
        </dd>
      </dl>
      <h2>ライセンスキーの登録</h2>
      <p>
        ご購入時にココナラのトークルームでお届けした「MDK1.」で始まるライセンスキーを、そのまま貼り付けてください。
        インターネット接続は不要です。登録しなくても書類の作成・保存・バックアップはすべて使えますが、印刷・PDFに「未認証版」と入ります。
      </p>
      <div className="field">
        <label htmlFor="license-key-input">ライセンスキー</label>
        <textarea
          id="license-key-input"
          rows={3}
          value={licenseInput}
          onChange={(event) => setLicenseInput(event.target.value)}
          placeholder="MDK1.xxxxxxxx.xxxxxxxx"
          spellCheck={false}
          autoComplete="off"
        />
      </div>
      <button
        type="button"
        disabled={licenseBusy || licenseInput.trim() === ""}
        onClick={() => {
          void handleActivate();
        }}
      >
        登録する
      </button>{" "}
      {status?.state === "valid" && (
        <button type="button" disabled={licenseBusy} onClick={() => setShowRemoveConfirm(true)}>
          登録を削除する
        </button>
      )}
      {licenseMessage && <p role="status">{licenseMessage}</p>}
      <h2>更新について</h2>
      <p>
        自動更新はありません。新しい版は、ココナラのメッセージでインストーラーをお届けします。
        更新する前に「データ管理」でバックアップを作成し、届いたインストーラーで上書きインストールしてください。データはそのまま引き継がれます。
      </p>
      <button
        type="button"
        onClick={() => {
          void notConfiguredUpdateCheck.check().then(setUpdateResult);
        }}
      >
        更新方法を確認
      </button>
      {updateResult && <p role="status">{updateResultLabel(updateResult)}</p>}
      <ConfirmDialog
        open={showRemoveConfirm}
        title="ライセンスキーの登録を削除しますか?"
        description="書類やデータは消えません。削除すると、印刷・PDFに再び「未認証版」と入ります。別のパソコンへ移るときなどに使います。"
        confirmLabel="削除する"
        onConfirm={() => void handleRemove()}
        onCancel={() => setShowRemoveConfirm(false)}
      />
    </div>
  );
}
