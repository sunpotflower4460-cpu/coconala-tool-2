import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  saveEstimateDraft,
  type SaveEstimateDraftLineInput,
} from "@/application/commands/save-estimate-draft.command";
import { getAppSettings } from "@/application/queries/get-app-settings.query";
import { getDocumentDraft } from "@/application/queries/get-document-draft.query";
import { listCatalogItems } from "@/application/queries/list-catalog-items.query";
import { listClients } from "@/application/queries/list-clients.query";
import { ErrorBanner } from "@/components/feedback/ErrorBanner";
import { SaveStatus, type SaveStatusValue } from "@/components/feedback/SaveStatus";
import type { CatalogItem } from "@/domain/catalog/types";
import type { Client } from "@/domain/clients/types";
import { calculateDocumentTotals } from "@/domain/tax/calculate-document-totals";
import type { PricingType, RoundingMode, TaxCategory } from "@/domain/tax/types";
import { useDatabase } from "@/infrastructure/database/use-database";
import { formatYen } from "@/lib/formatting/money";

interface EditableLine extends SaveEstimateDraftLineInput {
  key: string;
}

let lineKeySeed = 0;
function nextLineKey(): string {
  lineKeySeed += 1;
  return `line-${lineKeySeed}`;
}

function blankLine(): EditableLine {
  return {
    key: nextLineKey(),
    catalogItemId: null,
    name: "",
    description: null,
    unit: null,
    quantity: 1,
    unitPriceYen: 0,
    taxCategory: "taxable_10",
    lineDiscountYen: 0,
  };
}

export function EstimateEditorPage() {
  const db = useDatabase();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [documentId, setDocumentId] = useState<number | null>(id ? Number(id) : null);

  const [clients, setClients] = useState<Client[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [roundingMode, setRoundingMode] = useState<RoundingMode>("floor");

  const [clientId, setClientId] = useState<number | null>(null);
  const [issueDate, setIssueDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [pricingType, setPricingType] = useState<PricingType>("tax_exclusive");
  const [discountYen, setDiscountYen] = useState(0);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<EditableLine[]>([blankLine()]);

  const [saveStatus, setSaveStatus] = useState<SaveStatusValue>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void listClients(db).then(setClients);
    void listCatalogItems(db, { activeOnly: true }).then(setCatalogItems);
    void getAppSettings(db).then((settings) => setRoundingMode(settings.roundingMode));
  }, [db]);

  useEffect(() => {
    if (documentId === null) return;
    void getDocumentDraft(db, documentId).then((draft) => {
      if (!draft) return;
      setClientId(draft.header.clientId);
      setIssueDate(draft.header.issueDate ?? "");
      setValidUntil(draft.header.validUntil ?? "");
      setPricingType(draft.header.pricingType);
      setDiscountYen(draft.header.discountYen);
      setNote(draft.header.note ?? "");
      setLines(
        draft.lines.length > 0
          ? draft.lines.map((line) => ({
              key: nextLineKey(),
              catalogItemId: line.catalogItemId,
              name: line.name,
              description: line.description,
              unit: line.unit,
              quantity: line.quantity,
              unitPriceYen: line.unitPriceYen,
              taxCategory: line.taxCategory,
              lineDiscountYen: line.lineDiscountYen,
            }))
          : [blankLine()],
      );
    });
  }, [db, documentId]);

  const totals = useMemo(() => {
    try {
      return calculateDocumentTotals(
        lines.map((line) => ({
          quantity: line.quantity,
          unitPriceYen: line.unitPriceYen,
          taxCategory: line.taxCategory,
          lineDiscountYen: line.lineDiscountYen,
        })),
        { discountYen, pricingType, roundingMode },
      );
    } catch {
      return null;
    }
  }, [lines, discountYen, pricingType, roundingMode]);

  function updateLine(key: string, patch: Partial<EditableLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function addCatalogLine(catalogItemId: number) {
    const item = catalogItems.find((candidate) => candidate.id === catalogItemId);
    if (!item) return;
    setLines((current) => [
      ...current,
      {
        key: nextLineKey(),
        catalogItemId: item.id,
        name: item.name,
        description: item.description,
        unit: item.unit,
        quantity: item.minQuantity ?? 1,
        unitPriceYen: item.unitPriceYen,
        taxCategory: item.taxCategory,
        lineDiscountYen: 0,
      },
    ]);
  }

  function addBlankLine() {
    setLines((current) => [...current, blankLine()]);
  }

  function removeLine(key: string) {
    setLines((current) =>
      current.length > 1 ? current.filter((line) => line.key !== key) : current,
    );
  }

  async function handleSave() {
    setSaveStatus("saving");
    setErrorMessage(null);

    const result = await saveEstimateDraft(db, {
      id: documentId,
      clientId,
      issueDate: issueDate || null,
      dueDate: null,
      validUntil: validUntil || null,
      pricingType,
      discountYen,
      note: note || null,
      lines: lines.map(({ key: _key, ...line }) => line),
    });

    if (!result.ok) {
      setSaveStatus("error");
      setErrorMessage(result.error.message);
      return;
    }

    setSaveStatus("saved");
    if (documentId === null) {
      setDocumentId(result.value.header.id);
      void navigate(`/estimates/${result.value.header.id}`, { replace: true });
    }
  }

  return (
    <div>
      <h1>{documentId === null ? "新しい見積書(下書き)" : "見積書(下書き)を編集"}</h1>
      {errorMessage && <ErrorBanner message={errorMessage} />}

      <div className="field">
        <label htmlFor="estimate-client">顧客</label>
        <select
          id="estimate-client"
          value={clientId ?? ""}
          onChange={(event) => setClientId(event.target.value ? Number(event.target.value) : null)}
        >
          <option value="">選択してください</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: "1rem" }}>
        <div className="field">
          <label htmlFor="estimate-issue-date">発行予定日</label>
          <input
            id="estimate-issue-date"
            type="date"
            value={issueDate}
            onChange={(event) => setIssueDate(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="estimate-valid-until">有効期限</label>
          <input
            id="estimate-valid-until"
            type="date"
            value={validUntil}
            onChange={(event) => setValidUntil(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="estimate-pricing-type">税の表示方法</label>
          <select
            id="estimate-pricing-type"
            value={pricingType}
            onChange={(event) => setPricingType(event.target.value as PricingType)}
          >
            <option value="tax_exclusive">税抜</option>
            <option value="tax_inclusive">税込</option>
          </select>
        </div>
      </div>

      <h2>明細</h2>
      <table>
        <thead>
          <tr>
            <th>品目</th>
            <th>数量</th>
            <th>単価(円)</th>
            <th>税区分</th>
            <th>明細値引き(円)</th>
            <th aria-hidden="true"></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.key}>
              <td>
                <input
                  aria-label="品目名"
                  value={line.name}
                  onChange={(event) => updateLine(line.key, { name: event.target.value })}
                />
              </td>
              <td>
                <input
                  aria-label="数量"
                  inputMode="numeric"
                  value={line.quantity}
                  onChange={(event) =>
                    updateLine(line.key, { quantity: Number(event.target.value) || 0 })
                  }
                  style={{ width: "5rem" }}
                />
              </td>
              <td>
                <input
                  aria-label="単価"
                  inputMode="numeric"
                  value={line.unitPriceYen}
                  onChange={(event) =>
                    updateLine(line.key, { unitPriceYen: Number(event.target.value) || 0 })
                  }
                  style={{ width: "7rem" }}
                />
              </td>
              <td>
                <select
                  aria-label="税区分"
                  value={line.taxCategory}
                  onChange={(event) =>
                    updateLine(line.key, { taxCategory: event.target.value as TaxCategory })
                  }
                >
                  <option value="taxable_10">10%</option>
                  <option value="taxable_8">8%</option>
                  <option value="tax_exempt">非課税</option>
                </select>
              </td>
              <td>
                <input
                  aria-label="明細値引き"
                  inputMode="numeric"
                  value={line.lineDiscountYen}
                  onChange={(event) =>
                    updateLine(line.key, { lineDiscountYen: Number(event.target.value) || 0 })
                  }
                  style={{ width: "6rem" }}
                />
              </td>
              <td>
                <button type="button" onClick={() => removeLine(line.key)}>
                  削除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: "1rem", margin: "1rem 0" }}>
        <button type="button" onClick={addBlankLine}>
          明細を追加
        </button>
        {catalogItems.length > 0 && (
          <select
            aria-label="価格表から追加"
            value=""
            onChange={(event) => {
              if (event.target.value) addCatalogLine(Number(event.target.value));
            }}
          >
            <option value="">価格表から追加…</option>
            {catalogItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}({formatYen(item.unitPriceYen)})
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="field">
        <label htmlFor="estimate-discount">全体値引き(円)</label>
        <input
          id="estimate-discount"
          inputMode="numeric"
          value={discountYen}
          onChange={(event) => setDiscountYen(Number(event.target.value) || 0)}
          style={{ width: "8rem" }}
        />
      </div>

      <div className="field">
        <label htmlFor="estimate-note">備考</label>
        <textarea
          id="estimate-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      {totals && (
        <div aria-live="polite">
          <p>小計: {formatYen(totals.subtotalYen)}</p>
          <p>消費税: {formatYen(totals.taxYen)}</p>
          <p>
            <strong>合計: {formatYen(totals.totalYen)}</strong>
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          void handleSave();
        }}
        disabled={saveStatus === "saving"}
      >
        下書きを保存
      </button>
      <SaveStatus status={saveStatus} errorMessage={errorMessage ?? undefined} />
    </div>
  );
}
