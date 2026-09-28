import { useEffect, useState, type FormEvent } from "react";
import { saveCompany } from "@/application/commands/save-company.command";
import { storeImageAsset } from "@/application/commands/store-image-asset.command";
import { getCompany } from "@/application/queries/get-company.query";
import { getImageAssetDataUrl } from "@/application/queries/get-image-asset.query";
import { ErrorBanner } from "@/components/feedback/ErrorBanner";
import { Field } from "@/components/forms/Field";
import { SaveStatus, type SaveStatusValue } from "@/components/feedback/SaveStatus";
import type { CompanyInput } from "@/domain/shared/company";
import {
  isValidInvoiceRegistrationNumber,
  normalizeInvoiceRegistrationNumber,
} from "@/domain/shared/invoice-registration";
import { prepareLogoPng } from "@/features/companies/prepare-logo";
import { useDatabase } from "@/infrastructure/database/use-database";

const EMPTY_FORM = {
  displayName: "",
  representativeName: "",
  postalCode: "",
  address: "",
  phone: "",
  email: "",
  invoiceRegistrationNumber: "",
  bankName: "",
  bankBranchName: "",
  bankAccountType: "",
  bankAccountNumber: "",
  bankAccountHolder: "",
  estimateValidDays: "30",
  paymentDueDays: "30",
  defaultNote: "",
};

type FormState = typeof EMPTY_FORM;

function toNullableText(value: string): string | null {
  return value.trim() === "" ? null : value;
}

function toNullableInt(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

interface CompanySettingsPageProps {
  onSaved?: () => void;
}

export function CompanySettingsPage({ onSaved }: CompanySettingsPageProps) {
  const db = useDatabase();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoAssetSha256, setLogoAssetSha256] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatusValue>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void getCompany(db).then((company) => {
      if (!company) return;
      setLogoPath(company.logoPath);
      setLogoAssetSha256(company.logoAssetSha256 ?? null);
      void getImageAssetDataUrl(db, company.logoAssetSha256).then(setLogoPreview);
      setForm({
        displayName: company.displayName,
        representativeName: company.representativeName ?? "",
        postalCode: company.postalCode ?? "",
        address: company.address ?? "",
        phone: company.phone ?? "",
        email: company.email ?? "",
        invoiceRegistrationNumber: company.invoiceRegistrationNumber ?? "",
        bankName: company.bankName ?? "",
        bankBranchName: company.bankBranchName ?? "",
        bankAccountType: company.bankAccountType ?? "",
        bankAccountNumber: company.bankAccountNumber ?? "",
        bankAccountHolder: company.bankAccountHolder ?? "",
        estimateValidDays:
          company.estimateValidDays !== null ? String(company.estimateValidDays) : "",
        paymentDueDays: company.paymentDueDays !== null ? String(company.paymentDueDays) : "",
        defaultNote: company.defaultNote ?? "",
      });
    });
  }, [db]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (form.displayName.trim() === "") {
      setNameError("会社名・屋号を入力してください");
      return;
    }
    setNameError(null);
    const registration = normalizeInvoiceRegistrationNumber(form.invoiceRegistrationNumber);
    if (registration !== "" && !isValidInvoiceRegistrationNumber(registration)) {
      setRegistrationError("登録番号は「T」と数字13桁です(例: T1234567890123)");
      return;
    }
    setRegistrationError(null);
    setSaveStatus("saving");
    setErrorMessage(null);

    const input: CompanyInput = {
      displayName: form.displayName.trim(),
      representativeName: toNullableText(form.representativeName),
      postalCode: toNullableText(form.postalCode),
      address: toNullableText(form.address),
      phone: toNullableText(form.phone),
      email: toNullableText(form.email),
      invoiceRegistrationNumber: registration === "" ? null : registration,
      bankName: toNullableText(form.bankName),
      bankBranchName: toNullableText(form.bankBranchName),
      bankAccountType: toNullableText(form.bankAccountType),
      bankAccountNumber: toNullableText(form.bankAccountNumber),
      bankAccountHolder: toNullableText(form.bankAccountHolder),
      logoPath,
      logoAssetSha256,
      estimateValidDays: toNullableInt(form.estimateValidDays),
      paymentDueDays: toNullableInt(form.paymentDueDays),
      defaultNote: toNullableText(form.defaultNote),
    };

    const result = await saveCompany(db, input);
    if (!result.ok) {
      setSaveStatus("error");
      setErrorMessage(result.error.message);
      return;
    }
    setSaveStatus("saved");
    onSaved?.();
  }

  async function handleLogoSelected(file: File | undefined) {
    if (!file) return;
    setLogoBusy(true);
    setErrorMessage(null);
    try {
      const bytes = await prepareLogoPng(file);
      const result = await storeImageAsset(db, bytes);
      if (!result.ok) {
        setErrorMessage(result.error.message);
        return;
      }
      setLogoAssetSha256(result.value.sha256);
      setLogoPreview(await getImageAssetDataUrl(db, result.value.sha256));
    } catch {
      setErrorMessage("画像を読み込めませんでした。PNG または JPEG の画像を選んでください。");
    } finally {
      setLogoBusy(false);
    }
  }

  return (
    <div>
      <h1>会社情報</h1>
      {errorMessage && <ErrorBanner message={errorMessage} />}
      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <Field label="会社名・屋号" htmlFor="company-name" required error={nameError ?? undefined}>
          <input
            id="company-name"
            value={form.displayName}
            onChange={(event) => setForm({ ...form, displayName: event.target.value })}
          />
        </Field>
        <Field label="代表者名" htmlFor="company-representative">
          <input
            id="company-representative"
            value={form.representativeName}
            onChange={(event) => setForm({ ...form, representativeName: event.target.value })}
          />
        </Field>
        <Field label="郵便番号" htmlFor="company-postal">
          <input
            id="company-postal"
            value={form.postalCode}
            onChange={(event) => setForm({ ...form, postalCode: event.target.value })}
          />
        </Field>
        <Field label="住所" htmlFor="company-address">
          <input
            id="company-address"
            value={form.address}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
          />
        </Field>
        <Field label="電話番号" htmlFor="company-phone">
          <input
            id="company-phone"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
        </Field>
        <Field label="メールアドレス" htmlFor="company-email">
          <input
            id="company-email"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        </Field>
        <Field
          label="登録番号(適格請求書発行事業者)"
          htmlFor="company-invoice-number"
          hint="インボイス登録をしている場合のみ。「T」と数字13桁(例: T1234567890123)"
          error={registrationError ?? undefined}
        >
          <input
            id="company-invoice-number"
            value={form.invoiceRegistrationNumber}
            onChange={(event) =>
              setForm({ ...form, invoiceRegistrationNumber: event.target.value })
            }
          />
        </Field>
        <Field
          label="ロゴ画像(任意)"
          htmlFor="company-logo"
          hint="PNG または JPEG。書類の右上に小さく印刷されます。発行済みの書類のロゴは変わりません。"
        >
          <input
            id="company-logo"
            type="file"
            accept="image/png,image/jpeg"
            disabled={logoBusy}
            onChange={(event) => {
              void handleLogoSelected(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </Field>
        {logoPreview && (
          <div className="company-logo-preview">
            <img src={logoPreview} alt="登録するロゴ" />
            <button
              type="button"
              onClick={() => {
                setLogoAssetSha256(null);
                setLogoPreview(null);
              }}
            >
              ロゴを外す
            </button>
            <span className="hint">「保存する」を押すと反映されます。</span>
          </div>
        )}
        <Field label="振込先 銀行名" htmlFor="company-bank-name">
          <input
            id="company-bank-name"
            value={form.bankName}
            onChange={(event) => setForm({ ...form, bankName: event.target.value })}
          />
        </Field>
        <Field label="振込先 支店名" htmlFor="company-bank-branch">
          <input
            id="company-bank-branch"
            value={form.bankBranchName}
            onChange={(event) => setForm({ ...form, bankBranchName: event.target.value })}
          />
        </Field>
        <Field label="振込先 口座種別" htmlFor="company-bank-account-type">
          <input
            id="company-bank-account-type"
            value={form.bankAccountType}
            onChange={(event) => setForm({ ...form, bankAccountType: event.target.value })}
          />
        </Field>
        <Field label="振込先 口座番号" htmlFor="company-bank-account-number">
          <input
            id="company-bank-account-number"
            value={form.bankAccountNumber}
            onChange={(event) => setForm({ ...form, bankAccountNumber: event.target.value })}
          />
        </Field>
        <Field label="振込先 口座名義" htmlFor="company-bank-account-holder">
          <input
            id="company-bank-account-holder"
            value={form.bankAccountHolder}
            onChange={(event) => setForm({ ...form, bankAccountHolder: event.target.value })}
          />
        </Field>
        <Field label="見積書の有効期限(日数)" htmlFor="company-estimate-valid-days">
          <input
            id="company-estimate-valid-days"
            inputMode="numeric"
            value={form.estimateValidDays}
            onChange={(event) => setForm({ ...form, estimateValidDays: event.target.value })}
          />
        </Field>
        <Field label="支払期限(日数)" htmlFor="company-payment-due-days">
          <input
            id="company-payment-due-days"
            inputMode="numeric"
            value={form.paymentDueDays}
            onChange={(event) => setForm({ ...form, paymentDueDays: event.target.value })}
          />
        </Field>
        <Field label="備考欄の定型文" htmlFor="company-default-note">
          <textarea
            id="company-default-note"
            value={form.defaultNote}
            onChange={(event) => setForm({ ...form, defaultNote: event.target.value })}
          />
        </Field>
        <button type="submit" disabled={saveStatus === "saving"}>
          保存する
        </button>
        <SaveStatus status={saveStatus} errorMessage={errorMessage ?? undefined} />
      </form>
    </div>
  );
}
