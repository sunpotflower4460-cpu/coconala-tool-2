import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listDocuments, type DocumentSummary } from "@/application/queries/list-documents.query";
import type { DocumentType } from "@/domain/documents/types";
import { useDatabase } from "@/infrastructure/database/use-database";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS } from "@/lib/formatting/document-labels";
import { formatYen } from "@/lib/formatting/money";

interface DocumentListPageProps {
  documentType: DocumentType;
  /** trueの場合のみ「新しい◯◯を作成」ボタンを表示する(見積書のみ手動作成できる)。 */
  allowCreate?: boolean;
}

function openHref(document: DocumentSummary): string {
  // 下書きは種類を問わず編集画面(見積編集画面を汎用の下書き編集として流用)を開く。
  if (document.status === "draft") {
    return `/estimates/${document.id}`;
  }
  return `/documents/${document.id}`;
}

export function DocumentListPage({ documentType, allowCreate = false }: DocumentListPageProps) {
  const db = useDatabase();
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const title = `${DOCUMENT_TYPE_LABELS[documentType]}一覧`;

  useEffect(() => {
    void listDocuments(db, { documentType }).then(setDocuments);
  }, [db, documentType]);

  return (
    <div>
      <h1>{title}</h1>
      {allowCreate && (
        <div style={{ margin: "1rem 0" }}>
          <Link to="/estimates/new">
            <button type="button">新しい{DOCUMENT_TYPE_LABELS[documentType]}を作成</button>
          </Link>
        </div>
      )}

      {documents.length === 0 ? (
        <p>まだ{DOCUMENT_TYPE_LABELS[documentType]}がありません。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>書類番号</th>
              <th>顧客</th>
              <th>状態</th>
              <th>合計金額</th>
              <th>更新日時</th>
              <th aria-hidden="true"></th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.id}>
                <td>{document.documentNumber ?? "(下書き)"}</td>
                <td>{document.clientName ?? "-"}</td>
                <td>{DOCUMENT_STATUS_LABELS[document.status]}</td>
                <td>{formatYen(document.totalYen)}</td>
                <td>{new Date(document.updatedAt).toLocaleString("ja-JP")}</td>
                <td>
                  <Link to={openHref(document)}>開く</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
