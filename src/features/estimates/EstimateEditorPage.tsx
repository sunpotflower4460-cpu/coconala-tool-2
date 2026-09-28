import { useEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useNavigate, useParams } from "react-router-dom";
import { issueDocument } from "@/application/commands/issue-document.command";
import {
  saveEstimateDraft,
  type SaveEstimateDraftLineInput,
} from "@/application/commands/save-estimate-draft.command";
import { getAppSettings } from "@/application/queries/get-app-settings.query";
import { getCompany } from "@/application/queries/get-company.query";
import { getDocumentDraft } from "@/application/queries/get-document-draft.query";
import { listCatalogItems } from "@/application/queries/list-catalog-items.query";
import { listClients } from "@/application/queries/list-clients.query";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { ErrorBanner } from "@/components/feedback/ErrorBanner";
import { SaveStatus, type SaveStatusValue } from "@/components/feedback/SaveStatus";
import type { CatalogItem } from "@/domain/catalog/types";
import type { Client } from "@/domain/clients/types";
import type { DocumentType } from "@/domain/documents/types";
import { addDaysToIsoDate, localTodayIsoDate } from "@/domain/documents/dates";
import { buildTotalsSummaryRows } from "@/domain/documents/totals-summary";
import { calculateDocumentTotals } from "@/domain/tax/calculate-document-totals";
import type { PricingType, RoundingMode, TaxCategory } from "@/domain/tax/types";
import { useDatabase } from "@/infrastructure/database/use-database";
import { DOCUMENT_TYPE_LABELS } from "@/lib/formatting/document-labels";
import { formatYen } from "@/lib/formatting/money";

interface EditableLine extends SaveEstimateDraftLineInput {
  key: string;
}

let lineKeySeed = 0;
function nextLineKey(): string {
  lineKeySeed += 1;
  return `line-${lineKeySeed}`;
}

/** 自動保存までの待ち時間(最後の入力からの経過) */
const AUTOSAVE_DELAY_MS = 5000;

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

  const [documentType, setDocumentType] = useState<DocumentType>("estimate");
  const [clientId, setClientId] = useState<number | null>(null);
  const [issueDate, setIssueDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pricingType, setPricingType] = useState<PricingType>("tax_exclusive");
  const [discountYen, setDiscountYen] = useState(0);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<EditableLine[]>([blankLine()]);

  const [saveStatus, setSaveStatus] = useState<SaveStatusValue>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [showIssueConfirm, setShowIssueConfirm] = useState(false);

  // 未保存の変更の検出: 読み込み・初期値の設定・保存の直後の内容を「基準」とし、それと違えば未保存。
  const formSnapshot = useMemo(
    () =>
      JSON.stringify({
        clientId,
        issueDate,
        validUntil,
        dueDate,
        pricingType,
        discountYen,
        note,
        lines: lines.map(({ key: _key, ...line }) => line),
      }),
    [clientId, issueDate, validUntil, dueDate, pricingType, discountYen, note, lines],
  );
  const [baseline, setBaseline] = useState<string | null>(null);
  const [baselinePending, setBaselinePending] = useState(true);
  useEffect(() => {
    if (!baselinePending) return;
    setBaseline(formSnapshot);
    setBaselinePending(false);
  }, [baselinePending, formSnapshot]);
  // 読み込み直後(基準の更新待ち)の1回の描画では未保存扱いにしない。
  const isDirty = !baselinePending && baseline !== null && formSnapshot !== baseline;

  // 保存・発行の直後に行う画面移動は、確認ダイアログを出さずに通す。
  const allowLeaveRef = useRef(false);
  const savingRef = useRef(false);
  const issuingRef = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && !allowLeaveRef.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    void listClients(db).then(setClients);
    void listCatalogItems(db, { activeOnly: true }).then(setCatalogItems);
    void getAppSettings(db).then((settings) => setRoundingMode(settings.roundingMode));
  }, [db]);

  // 新しい見積は、今日の日付と会社設定の「有効期限(日数)」から初期値を入れる(あとで変更できる)。
  useEffect(() => {
    if (id) return;
    void getCompany(db).then((company) => {
      const today = localTodayIsoDate();
      setIssueDate((current) => current || today);
      if (company?.estimateValidDays != null) {
        const days = company.estimateValidDays;
        setValidUntil((current) => current || addDaysToIsoDate(today, days));
      }
      if (company?.defaultNote) {
        const defaultNote = company.defaultNote;
        setNote((current) => current || defaultNote);
      }
      setBaselinePending(true);
    });
  }, [db, id]);

  useEffect(() => {
    if (documentId === null) return;
    void getDocumentDraft(db, documentId).then((draft) => {
      if (!draft) return;
      setDocumentType(draft.header.documentType);
      setClientId(draft.header.clientId);
      setIssueDate(draft.header.issueDate ?? "");
      setValidUntil(draft.header.validUntil ?? "");
      setDueDate(draft.header.dueDate ?? "");
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
      setBaselinePending(true);
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

  /**
   * 保存に成功したら書類IDを返す。失敗時は null。
   * silent(自動保存)のときは、入力途中の不備でエラー帯を出さない。
   */
  async function handleSave(options: { silent?: boolean } = {}): Promise<number | null> {
    if (savingRef.current) return null;
    savingRef.current = true;
    setSaveStatus("saving");
    if (!options.silent) setErrorMessage(null);

    const result = await saveEstimateDraft(db, {
      id: documentId,
      clientId,
      issueDate: issueDate || null,
      // 支払期限は請求書のときだけ編集できる。他の種別では読み込んだ値をそのまま保つ。
      dueDate: dueDate || null,
      validUntil: validUntil || null,
      pricingType,
      discountYen,
      note: note || null,
      lines: lines.map(({ key: _key, ...line }) => line),
    });

    savingRef.current = false;
    if (!result.ok) {
      if (options.silent) {
        setSaveStatus("idle");
        return null;
      }
      setSaveStatus("error");
      setErrorMessage(result.error.message);
      return null;
    }

    setSaveStatus("saved");
    setBaselinePending(true);
    if (documentId === null) {
      allowLeaveRef.current = true;
      setDocumentId(result.value.header.id);
      void navigate(`/estimates/${result.value.header.id}`, { replace: true });
    }
    return result.value.header.id;
  }

  // 自動保存: 一度保存した下書きは、入力が止まって数秒たったら保存する(発行中は行わない)。
  useEffect(() => {
    allowLeaveRef.current = false;
    if (!isDirty || documentId === null || issuing) return;
    const timer = window.setTimeout(() => {
      if (!issuingRef.current) void handleSave({ silent: true });
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
    // handleSave は毎回作り直されるため依存に含めない(最新の入力は formSnapshot の変化で追う)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formSnapshot, isDirty, documentId, issuing]);

  async function handleOpenPrintPreview() {
    if (documentId === null) return;
    const savedId = isDirty ? await handleSave() : documentId;
    if (savedId === null) return;
    allowLeaveRef.current = true;
    void navigate(`/documents/${savedId}/print`);
  }

  async function handleIssue() {
    if (documentId === null) return;
    issuingRef.current = true;
    setIssuing(true);
    setErrorMessage(null);
    // 画面上の最新の内容を発行するため、必ず保存してから発行する。
    // (保存せずに発行すると、最後に保存した古い内容が発行されてしまう)
    const savedId = await handleSave();
    if (savedId === null) {
      issuingRef.current = false;
      setIssuing(false);
      setShowIssueConfirm(false);
      return;
    }
    const result = await issueDocument(db, savedId);
    issuingRef.current = false;
    setIssuing(false);
    setShowIssueConfirm(false);
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    allowLeaveRef.current = true;
    void navigate(`/documents/${savedId}`);
  }

  return (
    <div>
      <h1>
        {documentId === null
          ? "新しい見積書(下書き)"
          : `${DOCUMENT_TYPE_LABELS[documentType]}(下書き)を編集`}
      </h1>
      {documentId !== null && (
        <button type="button" onClick={() => void handleOpenPrintPreview()}>
          印刷プレビューを開く
        </button>
      )}
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
        {documentType === "estimate" && (
          <div className="field">
            <label htmlFor="estimate-valid-until">有効期限</label>
            <input
              id="estimate-valid-until"
              type="date"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
            />
          </div>
        )}
        {documentType === "invoice" && (
          <div className="field">
            <label htmlFor="estimate-due-date">お支払期限</label>
            <input
              id="estimate-due-date"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>
        )}
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
          {buildTotalsSummaryRows({
            pricingType,
            subtotalYen: totals.subtotalYen,
            totalYen: totals.totalYen,
            discountYen,
            taxBreakdown: totals.taxBreakdown,
          }).map((row) =>
            row.kind === "total" ? (
              <p key={row.kind}>
                <strong>
                  {row.label}: {formatYen(row.amountYen)}
                </strong>
              </p>
            ) : (
              <p key={`${row.kind}-${row.taxCategory ?? ""}`}>
                {row.label}:{" "}
                {row.amountYen < 0 ? `-${formatYen(-row.amountYen)}` : formatYen(row.amountYen)}
              </p>
            ),
          )}
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
      </button>{" "}
      {documentId !== null && (
        <button type="button" onClick={() => setShowIssueConfirm(true)} disabled={issuing}>
          発行する
        </button>
      )}
      <SaveStatus status={saveStatus} errorMessage={errorMessage ?? undefined} />
      <p className="hint">
        {documentId === null
          ? "最初に「下書きを保存」を押すと、以後の変更は自動で保存されます。"
          : isDirty
            ? "未保存の変更があります(数秒後に自動で保存します)。"
            : "変更はすべて保存されています。"}
      </p>
      <ConfirmDialog
        open={blocker.state === "blocked"}
        title="保存していない変更があります"
        description="このまま移動すると、最後に保存してからの変更は失われます。移動しますか?"
        confirmLabel="保存せずに移動する"
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
      <ConfirmDialog
        open={showIssueConfirm}
        title={`この${DOCUMENT_TYPE_LABELS[documentType]}を発行しますか?`}
        description="画面の内容を保存してから発行します。発行すると書類番号が採番され、会社情報・顧客情報・金額が固定されます。発行後は明細を編集できません。"
        confirmLabel="発行する"
        onConfirm={() => void handleIssue()}
        onCancel={() => setShowIssueConfirm(false)}
      />
    </div>
  );
}
