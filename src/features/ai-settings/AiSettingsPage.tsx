import { useEffect, useState, type FormEvent } from "react";
import { deleteApiKey } from "@/application/commands/delete-api-key.command";
import { saveApiKey } from "@/application/commands/save-api-key.command";
import { testAiConnection } from "@/application/commands/test-ai-connection.command";
import { updateAppSettings } from "@/application/commands/update-app-settings.command";
import { getAppSettings } from "@/application/queries/get-app-settings.query";
import { hasApiKey } from "@/application/queries/has-api-key.query";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { ErrorBanner } from "@/components/feedback/ErrorBanner";
import { Field } from "@/components/forms/Field";
import { createAiProvider } from "@/infrastructure/ai/create-ai-provider";
import { tauriSecretStore } from "@/infrastructure/secrets/tauri-secret-store";
import { useDatabase } from "@/infrastructure/database/use-database";

const DEFAULT_MODEL = "claude-sonnet-5";

type ConnectionState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

export function AiSettingsPage() {
  const db = useDatabase();
  const [aiEnabled, setAiEnabled] = useState(false);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [keyConfigured, setKeyConfigured] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>({ status: "idle" });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  function reload() {
    void getAppSettings(db).then((settings) => {
      setAiEnabled(settings.aiEnabled);
      setModel(settings.aiModel);
    });
    void hasApiKey(tauriSecretStore).then(setKeyConfigured);
  }

  useEffect(reload, [db]);

  async function handleSaveSettings(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrorMessage(null);
    const result = await updateAppSettings(db, {
      aiEnabled,
      aiModel: model.trim() || DEFAULT_MODEL,
    });
    setSaving(false);
    if (!result.ok) {
      setErrorMessage(result.error.message);
    }
  }

  async function handleSaveApiKey() {
    setErrorMessage(null);
    const result = await saveApiKey(tauriSecretStore, apiKeyInput);
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    setApiKeyInput("");
    reload();
  }

  async function handleDeleteApiKey() {
    setShowDeleteConfirm(false);
    setErrorMessage(null);
    const result = await deleteApiKey(tauriSecretStore);
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    reload();
  }

  async function handleTestConnection() {
    setConnection({ status: "checking" });
    const settings = await getAppSettings(db);
    const provider = createAiProvider({ aiEnabled: true, aiModel: settings.aiModel });
    const result = await testAiConnection(provider, tauriSecretStore);
    if (!result.ok) {
      setConnection({ status: "error", message: result.error.message });
      return;
    }
    setConnection({ status: "ok", message: result.value.message });
  }

  return (
    <div>
      <h1>AI設定</h1>
      <p>
        AI文章読み取り機能を使用しますか?
        利用しない場合でも、見積・請求・納品・領収書の作成など基本機能はすべて使えます。
      </p>
      <p className="hint">
        この機能を使うには、契約しているAIサービス(Anthropic社等)のAPIキーが必要です。
        AIサービスの利用料金はご自身の契約に基づき発生し、購入者(あなた)のご負担となります。
        本アプリの購入代金には含まれません。
      </p>
      {errorMessage && <ErrorBanner message={errorMessage} />}
      <form
        onSubmit={(event) => {
          void handleSaveSettings(event);
        }}
      >
        <Field label="AI文章読み取り機能を使用する" htmlFor="ai-enabled">
          <input
            id="ai-enabled"
            type="checkbox"
            checked={aiEnabled}
            onChange={(event) => setAiEnabled(event.target.checked)}
          />
        </Field>
        <Field
          label="モデルID"
          htmlFor="ai-model"
          hint="通常は初期値のままで構いません。契約しているAIサービスの案内に従って変更できます。"
        >
          <input id="ai-model" value={model} onChange={(event) => setModel(event.target.value)} />
        </Field>
        <button type="submit" disabled={saving}>
          設定を保存
        </button>
      </form>
      <h2>APIキー</h2>
      <p>
        APIキーとは、契約しているAIサービスをこのアプリから利用するための「専用の合鍵」です。
        このパソコンの安全な保存領域(OSの資格情報ストア)にのみ保存され、通常のデータや診断ファイルには含まれません。
      </p>
      <p>状態: {keyConfigured ? "設定済み" : "未設定"}</p>
      <Field
        label="APIキーを入力"
        htmlFor="ai-api-key"
        hint="保存すると入力欄はクリアされます。全文が画面に残ることはありません。"
      >
        <input
          id="ai-api-key"
          type="password"
          autoComplete="off"
          value={apiKeyInput}
          onChange={(event) => setApiKeyInput(event.target.value)}
        />
      </Field>
      <button
        type="button"
        onClick={() => {
          void handleSaveApiKey();
        }}
      >
        APIキーを保存
      </button>{" "}
      {keyConfigured && (
        <button type="button" onClick={() => setShowDeleteConfirm(true)}>
          APIキーを削除
        </button>
      )}
      <div style={{ marginTop: "1rem" }}>
        <button
          type="button"
          onClick={() => {
            void handleTestConnection();
          }}
          disabled={connection.status === "checking"}
        >
          接続を確認
        </button>
        {connection.status === "checking" && <p role="status">確認中…</p>}
        {connection.status === "ok" && <p role="status">{connection.message}</p>}
        {connection.status === "error" && <ErrorBanner message={connection.message} />}
      </div>
      <ConfirmDialog
        open={showDeleteConfirm}
        title="APIキーを削除しますか?"
        description="削除するとAI文章読み取り機能が使えなくなります。再度使うには登録し直してください。"
        confirmLabel="削除する"
        onConfirm={() => void handleDeleteApiKey()}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
