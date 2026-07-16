import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { convertDocument } from "@/application/commands/convert-document.command";
import { duplicateDocument } from "@/application/commands/duplicate-document.command";
import { updateDocumentStatus } from "@/application/commands/update-document-status.command";
import { getDocument, type DocumentDetail } from "@/application/queries/get-document.query";
import {
  listDocumentEvents,
  type DocumentEvent,
} from "@/application/queries/list-document-events.query";
import { ErrorBanner } from "@/components/feedback/ErrorBanner";
import { canConvertDocument, isConvertibleStatus } from "@/domain/documents/conversion";
import { canTransitionDocumentStatus, type DocumentStatus } from "@/domain/documents/status";
import type { DocumentType } from "@/domain/documents/types";
import { useDatabase } from "@/infrastructure/database/use-database";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS } from "@/lib/formatting/document-labels";
import { formatYen } from "@/lib/formatting/money";

const CONVERSION_TARGETS: DocumentType[] = ["invoice", "delivery_note", "receipt"];

export function DocumentDetailPage() {
  const db = useDatabase();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const documentId = Number(id);

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [events, setEvents] = useState<DocumentEvent[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    void getDocument(db, documentId).then(setDocument);
    void listDocumentEvents(db, documentId).then(setEvents);
  }, [db, documentId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleStatusChange(toStatus: DocumentStatus) {
    setBusy(true);
    setErrorMessage(null);
    const result = await updateDocumentStatus(db, documentId, toStatus);
    setBusy(false);
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    reload();
  }

  async function handleConvert(targetType: DocumentType) {
    setBusy(true);
    setErrorMessage(null);
    const result = await convertDocument(db, documentId, targetType);
    setBusy(false);
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    void navigate(`/estimates/${result.value.id}`);
  }

  async function handleDuplicate() {
    setBusy(true);
    setErrorMessage(null);
    const result = await duplicateDocument(db, documentId);
    setBusy(false);
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    void navigate(`/estimates/${result.value.id}`);
  }

  if (!document) {
    return <p>読み込み中…</p>;
  }

  if (document.status === "draft") {
    return (
      <div>
        <p>この書類はまだ下書きです。</p>
        <Link to={`/estimates/${document.id}`}>編集画面を開く</Link>
      </div>
    );
  }

  return (
    <div>
      <h1>
        {DOCUMENT_TYPE_LABELS[document.documentType]} {document.documentNumber}
      </h1>
      {errorMessage && <ErrorBanner message={errorMessage} />}

      <p>
        状態: <strong>{DOCUMENT_STATUS_LABELS[document.status]}</strong>
      </p>
      <p>顧客: {document.clientSnapshot?.name ?? "-"}</p>
      <p>合計金額: {formatYen(document.totalYen)}</p>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", margin: "1rem 0" }}>
        <Link to={`/documents/${document.id}/print`}>
          <button type="button">印刷プレビューを開く</button>
        </Link>

        {canTransitionDocumentStatus(document.status, "approved") && (
          <button type="button" disabled={busy} onClick={() => void handleStatusChange("approved")}>
            承認する
          </button>
        )}
        {canTransitionDocumentStatus(document.status, "rejected") && (
          <button type="button" disabled={busy} onClick={() => void handleStatusChange("rejected")}>
            却下する
          </button>
        )}
        {canTransitionDocumentStatus(document.status, "paid") && (
          <button type="button" disabled={busy} onClick={() => void handleStatusChange("paid")}>
            入金済みにする
          </button>
        )}
        {canTransitionDocumentStatus(document.status, "cancelled") && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleStatusChange("cancelled")}
          >
            取消する
          </button>
        )}

        {isConvertibleStatus(document.status) &&
          CONVERSION_TARGETS.filter((target) =>
            canConvertDocument(document.documentType, target),
          ).map((target) => (
            <button
              key={target}
              type="button"
              disabled={busy}
              onClick={() => void handleConvert(target)}
            >
              {DOCUMENT_TYPE_LABELS[target]}に変換
            </button>
          ))}

        <button type="button" disabled={busy} onClick={() => void handleDuplicate()}>
          複製して下書きを作る
        </button>
      </div>

      <h2>履歴</h2>
      {events.length === 0 ? (
        <p>履歴はありません。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>日時</th>
              <th>内容</th>
              <th>状態変化</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{new Date(event.createdAt).toLocaleString("ja-JP")}</td>
                <td>{event.note ?? event.eventType}</td>
                <td>
                  {event.fromStatus && event.toStatus && event.fromStatus !== event.toStatus
                    ? `${DOCUMENT_STATUS_LABELS[event.fromStatus as DocumentStatus]} → ${DOCUMENT_STATUS_LABELS[event.toStatus as DocumentStatus]}`
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
