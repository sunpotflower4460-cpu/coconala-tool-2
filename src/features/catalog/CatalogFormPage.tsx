import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createCatalogItem, updateCatalogItem } from "@/application/commands/catalog-item.commands";
import { getCatalogItem } from "@/application/queries/list-catalog-items.query";
import { ErrorBanner } from "@/components/feedback/ErrorBanner";
import { Field } from "@/components/forms/Field";
import type { CatalogItemInput } from "@/domain/catalog/types";
import type { TaxCategory } from "@/domain/tax/types";
import { useDatabase } from "@/infrastructure/database/use-database";

const EMPTY_FORM = {
  name: "",
  description: "",
  unit: "",
  unitPriceYen: "",
  costPriceYen: "",
  taxCategory: "taxable_10" as TaxCategory,
  minQuantity: "",
  isActive: true,
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

export function CatalogFormPage() {
  const db = useDatabase();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const itemId = id ? Number(id) : null;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (itemId === null) return;
    void getCatalogItem(db, itemId).then((item) => {
      if (item) {
        setForm({
          name: item.name,
          description: item.description ?? "",
          unit: item.unit ?? "",
          unitPriceYen: String(item.unitPriceYen),
          costPriceYen: item.costPriceYen !== null ? String(item.costPriceYen) : "",
          taxCategory: item.taxCategory,
          minQuantity: item.minQuantity !== null ? String(item.minQuantity) : "",
          isActive: item.isActive,
        });
      }
    });
  }, [db, itemId]);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (form.name.trim() === "") {
      errors.name = "商品名を入力してください";
    }
    const price = Number(form.unitPriceYen);
    if (form.unitPriceYen.trim() === "" || !Number.isInteger(price) || price < 0) {
      errors.unitPriceYen = "単価は0以上の整数(円)で入力してください";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setErrorMessage(null);

    const input: CatalogItemInput = {
      name: form.name.trim(),
      description: toNullableText(form.description),
      unit: toNullableText(form.unit),
      unitPriceYen: Number(form.unitPriceYen),
      costPriceYen: toNullableInt(form.costPriceYen),
      taxCategory: form.taxCategory,
      minQuantity: toNullableInt(form.minQuantity),
      isActive: form.isActive,
    };

    const result =
      itemId === null
        ? await createCatalogItem(db, input)
        : await updateCatalogItem(db, itemId, input);
    setSaving(false);
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    void navigate("/catalog");
  }

  return (
    <div>
      <h1>{itemId === null ? "新しい商品を登録" : "商品情報を編集"}</h1>
      {errorMessage && <ErrorBanner message={errorMessage} />}
      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <Field label="商品名" htmlFor="item-name" required error={fieldErrors.name}>
          <input
            id="item-name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>
        <Field label="説明" htmlFor="item-description" hint="例: 10分程度の動画編集作業">
          <textarea
            id="item-description"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </Field>
        <Field label="単位" htmlFor="item-unit" hint="例: 本、分、件">
          <input
            id="item-unit"
            value={form.unit}
            onChange={(event) => setForm({ ...form, unit: event.target.value })}
          />
        </Field>
        <Field label="単価(円)" htmlFor="item-price" required error={fieldErrors.unitPriceYen}>
          <input
            id="item-price"
            inputMode="numeric"
            value={form.unitPriceYen}
            onChange={(event) => setForm({ ...form, unitPriceYen: event.target.value })}
          />
        </Field>
        <Field label="原価(円・任意)" htmlFor="item-cost">
          <input
            id="item-cost"
            inputMode="numeric"
            value={form.costPriceYen}
            onChange={(event) => setForm({ ...form, costPriceYen: event.target.value })}
          />
        </Field>
        <Field label="税区分" htmlFor="item-tax">
          <select
            id="item-tax"
            value={form.taxCategory}
            onChange={(event) =>
              setForm({ ...form, taxCategory: event.target.value as TaxCategory })
            }
          >
            <option value="taxable_10">10%</option>
            <option value="taxable_8">8%(軽減税率)</option>
            <option value="tax_exempt">非課税</option>
          </select>
        </Field>
        <Field label="最低数量(任意)" htmlFor="item-min-quantity">
          <input
            id="item-min-quantity"
            inputMode="numeric"
            value={form.minQuantity}
            onChange={(event) => setForm({ ...form, minQuantity: event.target.value })}
          />
        </Field>
        <Field label="有効" htmlFor="item-active">
          <input
            id="item-active"
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
          />
        </Field>
        <button type="submit" disabled={saving}>
          {saving ? "保存中…" : "保存する"}
        </button>
      </form>
    </div>
  );
}
