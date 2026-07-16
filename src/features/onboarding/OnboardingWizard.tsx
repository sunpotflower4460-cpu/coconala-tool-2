import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createCatalogItem } from "@/application/commands/catalog-item.commands";
import { createClient } from "@/application/commands/client.commands";
import { saveEstimateDraft } from "@/application/commands/save-estimate-draft.command";
import { updateAppSettings } from "@/application/commands/update-app-settings.command";
import { getAppSettings } from "@/application/queries/get-app-settings.query";
import { ErrorBanner } from "@/components/feedback/ErrorBanner";
import { Field } from "@/components/forms/Field";
import { CompanySettingsPage } from "@/features/companies/CompanySettingsPage";
import type { RoundingMode } from "@/domain/tax/types";
import { useDatabase } from "@/infrastructure/database/use-database";

type Step = "company" | "tax" | "client" | "catalog" | "practice" | "done";

const STEPS: Step[] = ["company", "tax", "client", "catalog", "practice", "done"];

const STEP_LABELS: Record<Step, string> = {
  company: "会社情報",
  tax: "税設定",
  client: "顧客登録",
  catalog: "価格表登録",
  practice: "練習見積",
  done: "完了",
};

const ROUNDING_LABELS: Record<RoundingMode, string> = {
  floor: "切り捨て(推奨)",
  round: "四捨五入",
  ceil: "切り上げ",
};

function isStep(value: string): value is Step {
  return (STEPS as string[]).includes(value);
}

export function OnboardingWizard() {
  const db = useDatabase();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("company");
  const [loaded, setLoaded] = useState(false);
  const [roundingMode, setRoundingMode] = useState<RoundingMode>("floor");
  const [clientName, setClientName] = useState("");
  const [lastClientId, setLastClientId] = useState<number | null>(null);
  const [catalogName, setCatalogName] = useState("");
  const [catalogPrice, setCatalogPrice] = useState("");
  const [lastCatalogItemId, setLastCatalogItemId] = useState<number | null>(null);
  const [lastCatalogUnitPrice, setLastCatalogUnitPrice] = useState<number | null>(null);
  const [practiceEstimateId, setPracticeEstimateId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void getAppSettings(db).then((settings) => {
      setRoundingMode(settings.roundingMode);
      if (!settings.onboardingCompleted && isStep(settings.onboardingStep)) {
        setStep(settings.onboardingStep);
      }
      setLoaded(true);
    });
  }, [db]);

  function goTo(next: Step) {
    setStep(next);
    setErrorMessage(null);
    void updateAppSettings(db, { onboardingStep: next });
  }

  const currentIndex = STEPS.indexOf(step);

  async function handleSaveTax(event: FormEvent) {
    event.preventDefault();
    const result = await updateAppSettings(db, { roundingMode });
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    goTo("client");
  }

  async function handleAddClient(event: FormEvent) {
    event.preventDefault();
    if (clientName.trim() === "") {
      goTo("catalog");
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
    setLastClientId(result.value.id);
    goTo("catalog");
  }

  async function handleAddCatalogItem(event: FormEvent) {
    event.preventDefault();
    if (catalogName.trim() === "") {
      goTo("practice");
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
    setLastCatalogItemId(result.value.id);
    setLastCatalogUnitPrice(result.value.unitPriceYen);
    goTo("practice");
  }

  async function handleCreatePracticeEstimate() {
    if (lastClientId === null || lastCatalogItemId === null) {
      goTo("done");
      return;
    }
    const draft = await saveEstimateDraft(db, {
      id: null,
      clientId: lastClientId,
      issueDate: null,
      dueDate: null,
      validUntil: null,
      pricingType: "tax_exclusive",
      discountYen: 0,
      note: "初回設定の練習で作成した見積です。自由に編集・削除して構いません。",
      lines: [
        {
          catalogItemId: lastCatalogItemId,
          name: catalogName.trim(),
          description: null,
          unit: null,
          quantity: 1,
          unitPriceYen: lastCatalogUnitPrice ?? 0,
          taxCategory: "taxable_10",
          lineDiscountYen: 0,
        },
      ],
    });
    if (!draft.ok) {
      setErrorMessage(draft.error.message);
      return;
    }
    setPracticeEstimateId(draft.value.header.id);
    goTo("done");
  }

  async function handleFinish() {
    await updateAppSettings(db, { onboardingCompleted: true, onboardingStep: "done" });
    void navigate(practiceEstimateId ? `/estimates/${practiceEstimateId}` : "/");
  }

  if (!loaded) return null;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem" }}>
      <ol className="onboarding-progress" aria-label="初回設定の進み具合">
        {STEPS.map((s, index) => (
          <li key={s} aria-current={s === step ? "step" : undefined}>
            {index + 1}. {STEP_LABELS[s]}
            {index < currentIndex && " ✓"}
          </li>
        ))}
      </ol>
      <p>
        ステップ {currentIndex + 1}/{STEPS.length}: {STEP_LABELS[step]}
      </p>
      <p className="hint">
        途中で他の画面へ移動しても、続きから再開できます。左のメニューから「ホーム」に戻っても構いません。
      </p>
      {errorMessage && <ErrorBanner message={errorMessage} />}

      {step === "company" && (
        <>
          <p>まずは会社名・屋号などの基本情報を入力してください。あとから変更できます。</p>
          <CompanySettingsPage onSaved={() => goTo("tax")} />
        </>
      )}

      {step === "tax" && (
        <form
          onSubmit={(event) => {
            void handleSaveTax(event);
          }}
        >
          <p>消費税計算の端数処理方法を選んでください。あとから変更できます。</p>
          <Field label="端数処理" htmlFor="onboarding-rounding-mode">
            <select
              id="onboarding-rounding-mode"
              value={roundingMode}
              onChange={(event) => setRoundingMode(event.target.value as RoundingMode)}
            >
              {(["floor", "round", "ceil"] as RoundingMode[]).map((mode) => (
                <option key={mode} value={mode}>
                  {ROUNDING_LABELS[mode]}
                </option>
              ))}
            </select>
          </Field>
          <button type="button" onClick={() => goTo("company")}>
            戻る
          </button>{" "}
          <button type="submit">次へ</button>
        </form>
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
          <button type="button" onClick={() => goTo("tax")}>
            戻る
          </button>{" "}
          <button type="submit">登録して次へ</button>{" "}
          <button type="button" onClick={() => goTo("catalog")}>
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
          <button type="button" onClick={() => goTo("client")}>
            戻る
          </button>{" "}
          <button type="submit">登録して次へ</button>{" "}
          <button type="button" onClick={() => goTo("practice")}>
            スキップ
          </button>
        </form>
      )}

      {step === "practice" && (
        <div>
          {lastClientId !== null && lastCatalogItemId !== null ? (
            <p>
              登録した顧客と商品を使って、練習用の見積を1件作ってみましょう。内容はあとで自由に編集・削除できます。
            </p>
          ) : (
            <p>顧客または商品の登録をスキップしたため、練習見積の作成もスキップします。</p>
          )}
          <button type="button" onClick={() => goTo("catalog")}>
            戻る
          </button>{" "}
          {lastClientId !== null && lastCatalogItemId !== null && (
            <button
              type="button"
              onClick={() => {
                void handleCreatePracticeEstimate();
              }}
            >
              練習用の見積を作る
            </button>
          )}{" "}
          <button type="button" onClick={() => goTo("done")}>
            スキップして次へ
          </button>
        </div>
      )}

      {step === "done" && (
        <div>
          <p>
            準備ができました。
            {practiceEstimateId
              ? "作成した練習見積を確認しましょう。"
              : "最初の見積書を作りましょう。"}
          </p>
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
