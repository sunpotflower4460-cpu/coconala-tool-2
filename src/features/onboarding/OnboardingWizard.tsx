import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createCatalogItem } from "@/application/commands/catalog-item.commands";
import { createClient } from "@/application/commands/client.commands";
import { updateAppSettings } from "@/application/commands/update-app-settings.command";
import { ErrorBanner } from "@/components/feedback/ErrorBanner";
import { Field } from "@/components/forms/Field";
import { CompanySettingsPage } from "@/features/companies/CompanySettingsPage";
import { useDatabase } from "@/infrastructure/database/use-database";

type Step = "company" | "client" | "catalog" | "done";

const STEP_LABELS: Record<Step, string> = {
  company: "1. 会社情報",
  client: "2. 顧客登録",
  catalog: "3. 価格表登録",
  done: "4. 完了",
};

export function OnboardingWizard() {
  const db = useDatabase();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("company");
  const [clientName, setClientName] = useState("");
  const [catalogName, setCatalogName] = useState("");
  const [catalogPrice, setCatalogPrice] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleAddClient(event: FormEvent) {
    event.preventDefault();
    if (clientName.trim() === "") {
      setStep("catalog");
      return;
    }
    const result = await createClient(db, {
      name: clientName.trim(),
      contactName: null,
      postalCode: null,
      address: null,
      phone: null,
      email: null,
      note: null,
    });
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    setStep("catalog");
  }

  async function handleAddCatalogItem(event: FormEvent) {
    event.preventDefault();
    if (catalogName.trim() === "") {
      setStep("done");
      return;
    }
    const price = Number(catalogPrice);
    if (!Number.isInteger(price) || price < 0) {
      setErrorMessage("単価は0以上の整数(円)で入力してください");
      return;
    }
    const result = await createCatalogItem(db, {
      name: catalogName.trim(),
      description: null,
      unit: null,
      unitPriceYen: price,
      costPriceYen: null,
      taxCategory: "taxable_10",
      minQuantity: null,
      isActive: true,
    });
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    setStep("done");
  }

  async function handleFinish() {
    await updateAppSettings(db, { onboardingCompleted: true });
    void navigate("/");
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem" }}>
      <p>{STEP_LABELS[step]}</p>
      {errorMessage && <ErrorBanner message={errorMessage} />}

      {step === "company" && (
        <>
          <p>まずは会社名・屋号などの基本情報を入力してください。あとから変更できます。</p>
          <CompanySettingsPage onSaved={() => setStep("client")} />
        </>
      )}

      {step === "client" && (
        <form
          onSubmit={(event) => {
            void handleAddClient(event);
          }}
        >
          <p>よく取引する顧客を1件登録しましょう。あとで追加・変更できます。</p>
          <Field label="顧客名" htmlFor="onboarding-client-name" hint="例: サンプル株式会社">
            <input
              id="onboarding-client-name"
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
            />
          </Field>
          <button type="submit">登録して次へ</button>{" "}
          <button type="button" onClick={() => setStep("catalog")}>
            スキップ
          </button>
        </form>
      )}

      {step === "catalog" && (
        <form
          onSubmit={(event) => {
            void handleAddCatalogItem(event);
          }}
        >
          <p>よく使う商品・サービスを1件登録しましょう。あとでCSV一括登録もできます。</p>
          <Field label="商品名" htmlFor="onboarding-catalog-name" hint="例: 動画編集・基本料金">
            <input
              id="onboarding-catalog-name"
              value={catalogName}
              onChange={(event) => setCatalogName(event.target.value)}
            />
          </Field>
          <Field label="単価(円)" htmlFor="onboarding-catalog-price">
            <input
              id="onboarding-catalog-price"
              inputMode="numeric"
              value={catalogPrice}
              onChange={(event) => setCatalogPrice(event.target.value)}
            />
          </Field>
          <button type="submit">登録して次へ</button>{" "}
          <button type="button" onClick={() => setStep("done")}>
            スキップ
          </button>
        </form>
      )}

      {step === "done" && (
        <div>
          <p>準備ができました。最初の見積書を作りましょう。</p>
          <button
            type="button"
            onClick={() => {
              void handleFinish();
            }}
          >
            はじめる
          </button>
        </div>
      )}
    </div>
  );
}
