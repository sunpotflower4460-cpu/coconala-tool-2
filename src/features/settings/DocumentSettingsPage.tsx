import { useEffect, useState } from "react";
import { updateAppSettings } from "@/application/commands/update-app-settings.command";
import { getAppSettings } from "@/application/queries/get-app-settings.query";
import { ErrorBanner } from "@/components/feedback/ErrorBanner";
import { SaveStatus, type SaveStatusValue } from "@/components/feedback/SaveStatus";
import { Field } from "@/components/forms/Field";
import {
  formatDocumentNumber,
  validateDocumentNumberPrefixes,
} from "@/domain/documents/document-number";
import type { RoundingMode } from "@/domain/tax/types";
import { useDatabase } from "@/infrastructure/database/use-database";

const ROUNDING_LABELS: Record<RoundingMode, string> = {
  floor: "切り捨て(一般的)",
  round: "四捨五入",
  ceil: "切り上げ",
};

interface FormState {
  estimate: string;
  invoice: string;
  delivery: string;
  receipt: string;
  roundingMode: RoundingMode;
}

export function DocumentSettingsPage() {
  const db = useDatabase();
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatusValue>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void getAppSettings(db).then((settings) =>
      setForm({
        estimate: settings.documentNumberPrefixEstimate,
        invoice: settings.documentNumberPrefixInvoice,
        delivery: settings.documentNumberPrefixDelivery,
        receipt: settings.documentNumberPrefixReceipt,
        roundingMode: settings.roundingMode,
      }),
    );
  }, [db]);

  if (!form) return <p>読み込み中…</p>;

  async function handleSave(current: FormState) {
    const prefixes = {
      estimate: current.estimate.trim(),
      invoice: current.invoice.trim(),
      delivery: current.delivery.trim(),
      receipt: current.receipt.trim(),
    };
    const validation = validateDocumentNumberPrefixes(prefixes);
    setErrors(validation);
    if (validation.length > 0) return;
    setSaveStatus("saving");
    setErrorMessage(null);
    const result = await updateAppSettings(db, {
      documentNumberPrefixEstimate: prefixes.estimate,
      documentNumberPrefixInvoice: prefixes.invoice,
      documentNumberPrefixDelivery: prefixes.delivery,
      documentNumberPrefixReceipt: prefixes.receipt,
      roundingMode: current.roundingMode,
    });
    if (!result.ok) {
      setSaveStatus("error");
      setErrorMessage(result.error.message);
      return;
    }
    setSaveStatus("saved");
  }

  const year = new Date().getFullYear();
  const prefixFields: { key: keyof Omit<FormState, "roundingMode">; label: string }[] = [
    { key: "estimate", label: "見積書" },
    { key: "invoice", label: "請求書" },
    { key: "delivery", label: "納品書" },
    { key: "receipt", label: "領収書" },
  ];

  return (
    <div>
      <h1>帳票の設定</h1>
      {errorMessage && <ErrorBanner message={errorMessage} />}
      {errors.length > 0 && (
        <ul role="alert" className="form-errors">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      <h2>書類番号の記号</h2>
      <p>
        発行時に「記号-年-連番」の番号が付きます。変更は、これから発行する書類にだけ使われます(発行済みの番号は変わりません)。
      </p>
      {prefixFields.map(({ key, label }) => (
        <Field
          key={key}
          label={label}
          htmlFor={`prefix-${key}`}
          hint={`例: ${formatDocumentNumber(form[key] || "?", year, 1)}`}
        >
          <input
            id={`prefix-${key}`}
            value={form[key]}
            maxLength={10}
            onChange={(event) => setForm({ ...form, [key]: event.target.value })}
          />
        </Field>
      ))}

      <h2>消費税の端数処理</h2>
      <p>
        税額の1円未満の扱いです。これから保存する下書きから使われます。発行済みの書類の金額は変わりません。
      </p>
      <Field label="端数処理" htmlFor="rounding-mode">
        <select
          id="rounding-mode"
          value={form.roundingMode}
          onChange={(event) =>
            setForm({ ...form, roundingMode: event.target.value as RoundingMode })
          }
        >
          {(Object.keys(ROUNDING_LABELS) as RoundingMode[]).map((mode) => (
            <option key={mode} value={mode}>
              {ROUNDING_LABELS[mode]}
            </option>
          ))}
        </select>
      </Field>

      <button
        type="button"
        disabled={saveStatus === "saving"}
        onClick={() => {
          void handleSave(form);
        }}
      >
        保存する
      </button>
      <SaveStatus status={saveStatus} errorMessage={errorMessage ?? undefined} />
    </div>
  );
}
