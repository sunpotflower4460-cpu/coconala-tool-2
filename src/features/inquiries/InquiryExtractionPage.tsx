import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { confirmInquiryExtraction } from "@/application/commands/confirm-inquiry-extraction.command";
import { runInquiryExtraction } from "@/application/commands/run-inquiry-extraction.command";
import {
  saveEstimateDraft,
  type SaveEstimateDraftLineInput,
} from "@/application/commands/save-estimate-draft.command";
import { getAppSettings } from "@/application/queries/get-app-settings.query";
import { listCatalogItems } from "@/application/queries/list-catalog-items.query";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { ErrorBanner } from "@/components/feedback/ErrorBanner";
import type { CatalogItem } from "@/domain/catalog/types";
import type { CatalogCandidate, MatchStatus } from "@/domain/inquiries/types";
import { createAiProvider } from "@/infrastructure/ai/create-ai-provider";
import { tauriSecretStore } from "@/infrastructure/secrets/tauri-secret-store";
import { useDatabase } from "@/infrastructure/database/use-database";

const STATUS_LABELS: Record<MatchStatus, string> = {
  matched: "緑: 一致",
  review: "黄: 要確認",
  unresolved: "赤: 不明",
};

const STATUS_CLASS: Record<MatchStatus, string> = {
  matched: "match-status match-status--matched",
  review: "match-status match-status--review",
  unresolved: "match-status match-status--unresolved",
};

interface ReviewItem {
  key: string;
  sourceText: string;
  normalizedName: string;
  quantity: number | null;
  unit: string | null;
  status: MatchStatus;
  candidates: CatalogCandidate[];
  selectedCatalogItemId: number | null;
  questions: string[];
  included: boolean;
}

let keySeed = 0;
function nextKey(): string {
  keySeed += 1;
  return `item-${keySeed}`;
}

export function InquiryExtractionPage() {
  const db = useDatabase();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [globalQuestions, setGlobalQuestions] = useState<string[]>([]);
  const [extractionId, setExtractionId] = useState<number | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [creating, setCreating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void listCatalogItems(db, { activeOnly: true }).then(setCatalogItems);
  }, [db]);

  function catalogName(id: number): string {
    return catalogItems.find((item) => item.id === id)?.name ?? `(ID:${id})`;
  }

  async function handleExtract() {
    setShowSendConfirm(false);
    setExtracting(true);
    setErrorMessage(null);
    setSummary(null);
    setItems([]);

    const settings = await getAppSettings(db);
    const provider = createAiProvider(settings);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const result = await runInquiryExtraction(
      db,
      provider,
      tauriSecretStore,
      text,
      settings.aiModel,
      {
        signal: controller.signal,
      },
    );
    setExtracting(false);
    abortControllerRef.current = null;

    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }

    setExtractionId(result.value.extractionId);
    setSummary(result.value.extraction.summary);
    setGlobalQuestions(result.value.extraction.globalQuestions);
    setItems(
      result.value.extraction.items.map((item) => ({
        key: nextKey(),
        sourceText: item.sourceText,
        normalizedName: item.normalizedName,
        quantity: item.quantity,
        unit: item.unit,
        status: item.status,
        candidates: item.catalogCandidates,
        selectedCatalogItemId: item.catalogCandidates[0]?.catalogItemId ?? null,
        questions: item.questions,
        included: item.status !== "unresolved",
      })),
    );
  }

  function handleCancelExtraction() {
    abortControllerRef.current?.abort();
  }

  function updateItem(key: string, patch: Partial<ReviewItem>) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  async function handleCreateEstimate() {
    setCreating(true);
    setErrorMessage(null);

    const lines: SaveEstimateDraftLineInput[] = items
      .filter((item) => item.included && item.selectedCatalogItemId !== null)
      .map((item) => {
        const catalogItem = catalogItems.find(
          (candidate) => candidate.id === item.selectedCatalogItemId,
        )!;
        return {
          catalogItemId: catalogItem.id,
          name: catalogItem.name,
          description: catalogItem.description,
          unit: item.unit ?? catalogItem.unit,
          quantity: item.quantity ?? catalogItem.minQuantity ?? 1,
          unitPriceYen: catalogItem.unitPriceYen,
          taxCategory: catalogItem.taxCategory,
          lineDiscountYen: 0,
        };
      });

    const result = await saveEstimateDraft(db, {
      id: null,
      clientId: null,
      issueDate: null,
      dueDate: null,
      validUntil: null,
      pricingType: "tax_exclusive",
      discountYen: 0,
      note: summary,
      lines,
    });

    setCreating(false);
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    if (extractionId !== null) {
      await confirmInquiryExtraction(db, extractionId, result.value.header.id!);
    }
    void navigate(`/estimates/${result.value.header.id}`);
  }

  return (
    <div>
      <h1>問い合わせ文からの見積作成</h1>
      <p>
        問い合わせメールなどの文章を貼り付けると、価格表と照らし合わせて見積の候補を作ります。
        金額はAIが決めるのではなく、必ず価格表から計算されます。内容は利用者が確認してから見積へ反映します。
      </p>
      {errorMessage && <ErrorBanner message={errorMessage} />}

      <div className="field">
        <label htmlFor="inquiry-text">問い合わせ文</label>
        <textarea
          id="inquiry-text"
          rows={8}
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={extracting}
        />
      </div>

      {!extracting ? (
        <button
          type="button"
          onClick={() => setShowSendConfirm(true)}
          disabled={text.trim() === ""}
        >
          内容を整理する
        </button>
      ) : (
        <>
          <p role="status">AIが読み取り中です…</p>
          <button type="button" onClick={handleCancelExtraction}>
            キャンセル
          </button>
        </>
      )}

      <ConfirmDialog
        open={showSendConfirm}
        title="この文章をAIへ送信します"
        description={text.length > 300 ? `${text.slice(0, 300)}…(以下省略)` : text}
        confirmLabel="送信する"
        onConfirm={() => void handleExtract()}
        onCancel={() => setShowSendConfirm(false)}
      />

      {summary !== null && (
        <div style={{ marginTop: "2rem" }}>
          <h2>要約</h2>
          <p>{summary}</p>

          {globalQuestions.length > 0 && (
            <div className="error-banner" role="status">
              <p>確認したいこと:</p>
              <ul>
                {globalQuestions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </div>
          )}

          <h2>明細候補</h2>
          {items.length === 0 && (
            <p>明細候補が見つかりませんでした。手動で見積を作成してください。</p>
          )}
          {items.map((item) => (
            <div
              key={item.key}
              className="field"
              style={{ border: "1px solid var(--color-border)", padding: "1rem" }}
            >
              <p>
                <span className={STATUS_CLASS[item.status]}>{STATUS_LABELS[item.status]}</span>
              </p>
              <p>元の文章: 「{item.sourceText}」</p>
              <label>
                <input
                  type="checkbox"
                  checked={item.included}
                  onChange={(event) => updateItem(item.key, { included: event.target.checked })}
                />{" "}
                この明細を見積に含める
              </label>

              <div className="field">
                <label htmlFor={`${item.key}-catalog`}>価格表の項目</label>
                <select
                  id={`${item.key}-catalog`}
                  value={item.selectedCatalogItemId ?? ""}
                  onChange={(event) =>
                    updateItem(item.key, {
                      selectedCatalogItemId: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                >
                  <option value="">選択してください</option>
                  {item.candidates.map((candidate) => (
                    <option key={candidate.catalogItemId} value={candidate.catalogItemId}>
                      {catalogName(candidate.catalogItemId)}(AI候補・信頼度
                      {Math.round(candidate.confidence * 100)}%)
                    </option>
                  ))}
                  <optgroup label="価格表から選ぶ">
                    {catalogItems
                      .filter((ci) => !item.candidates.some((c) => c.catalogItemId === ci.id))
                      .map((ci) => (
                        <option key={ci.id} value={ci.id}>
                          {ci.name}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              <div style={{ display: "flex", gap: "1rem" }}>
                <div className="field">
                  <label htmlFor={`${item.key}-quantity`}>数量</label>
                  <input
                    id={`${item.key}-quantity`}
                    inputMode="numeric"
                    value={item.quantity ?? ""}
                    onChange={(event) =>
                      updateItem(item.key, {
                        quantity: event.target.value ? Number(event.target.value) : null,
                      })
                    }
                    style={{ width: "6rem" }}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`${item.key}-unit`}>単位</label>
                  <input
                    id={`${item.key}-unit`}
                    value={item.unit ?? ""}
                    onChange={(event) => updateItem(item.key, { unit: event.target.value || null })}
                    style={{ width: "6rem" }}
                  />
                </div>
              </div>

              {item.questions.length > 0 && (
                <p className="hint">確認事項: {item.questions.join(" / ")}</p>
              )}
            </div>
          ))}

          <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
            <button
              type="button"
              onClick={() => void handleCreateEstimate()}
              disabled={creating || items.every((item) => !item.included)}
            >
              選択した明細で見積を作成
            </button>
          </div>
        </div>
      )}

      <p style={{ marginTop: "2rem" }}>
        AIを使わずに、または結果を使わずに、
        <a
          href="/estimates/new"
          onClick={(event) => {
            event.preventDefault();
            void navigate("/estimates/new");
          }}
        >
          手動で見積を作成
        </a>
        することもできます。
      </p>
    </div>
  );
}
