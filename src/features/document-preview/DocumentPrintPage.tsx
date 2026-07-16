import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAppSettings } from "@/application/queries/get-app-settings.query";
import { getCompany } from "@/application/queries/get-company.query";
import { getDocument } from "@/application/queries/get-document.query";
import { getClient } from "@/application/queries/list-clients.query";
import {
  DocumentPrintLayout,
  type DocumentPrintLayoutProps,
} from "@/components/documents/DocumentPrintLayout";
import { calculateDocumentTotals } from "@/domain/tax/calculate-document-totals";
import { useDatabase } from "@/infrastructure/database/use-database";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; props: DocumentPrintLayoutProps }
  | { status: "error"; message: string };

export function DocumentPrintPage() {
  const db = useDatabase();
  const { id } = useParams<{ id: string }>();
  const documentId = Number(id);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const document = await getDocument(db, documentId);
      if (!document) {
        if (!cancelled) setState({ status: "error", message: "書類が見つかりません" });
        return;
      }

      const lineInputs = document.lines.map((line) => ({
        quantity: line.quantity,
        unitPriceYen: line.unitPriceYen,
        taxCategory: line.taxCategory,
        lineDiscountYen: line.lineDiscountYen,
      }));

      if (document.status === "draft") {
        const [company, client, settings] = await Promise.all([
          getCompany(db),
          document.clientId ? getClient(db, document.clientId) : Promise.resolve(null),
          getAppSettings(db),
        ]);
        if (!company || !client) {
          if (!cancelled) {
            setState({
              status: "error",
              message:
                "会社情報または顧客情報が未登録です。先に登録してからプレビューしてください。",
            });
          }
          return;
        }
        const totals = calculateDocumentTotals(lineInputs, {
          discountYen: document.discountYen,
          pricingType: document.pricingType,
          roundingMode: settings.roundingMode,
        });
        if (cancelled) return;
        setState({
          status: "ready",
          props: {
            documentType: document.documentType,
            documentNumber: document.documentNumber,
            status: document.status,
            issueDate: document.issueDate,
            validUntil: document.validUntil,
            dueDate: document.dueDate,
            company,
            client,
            pricingType: document.pricingType,
            lines: document.lines.map((line, index) => ({
              name: line.name,
              description: line.description,
              unit: line.unit,
              quantity: line.quantity,
              unitPriceYen: line.unitPriceYen,
              taxCategory: line.taxCategory,
              amountYen: totals.lines[index]?.amountYen ?? 0,
            })),
            subtotalYen: totals.subtotalYen,
            taxYen: totals.taxYen,
            totalYen: totals.totalYen,
            taxBreakdown: totals.taxBreakdown,
            discountYen: document.discountYen,
            note: document.note,
            isDraftPreview: true,
          },
        });
        return;
      }

      if (!document.companySnapshot || !document.clientSnapshot || !document.calculationSnapshot) {
        if (!cancelled) {
          setState({ status: "error", message: "発行時の記録が見つかりません" });
        }
        return;
      }

      const snapshot = document.calculationSnapshot;
      const lineTotals = calculateDocumentTotals(lineInputs, {
        discountYen: snapshot.discountYen,
        pricingType: snapshot.pricingType,
        roundingMode: snapshot.roundingMode,
      });
      if (cancelled) return;
      setState({
        status: "ready",
        props: {
          documentType: document.documentType,
          documentNumber: document.documentNumber,
          status: document.status,
          issueDate: document.issueDate,
          validUntil: document.validUntil,
          dueDate: document.dueDate,
          company: document.companySnapshot,
          client: document.clientSnapshot,
          pricingType: snapshot.pricingType,
          lines: document.lines.map((line, index) => ({
            name: line.name,
            description: line.description,
            unit: line.unit,
            quantity: line.quantity,
            unitPriceYen: line.unitPriceYen,
            taxCategory: line.taxCategory,
            amountYen: lineTotals.lines[index]?.amountYen ?? 0,
          })),
          subtotalYen: document.subtotalYen,
          taxYen: document.taxYen,
          totalYen: document.totalYen,
          taxBreakdown: snapshot.taxBreakdown,
          discountYen: snapshot.discountYen,
          note: document.note,
          isDraftPreview: false,
        },
      });
    }

    load().catch(() => {
      if (!cancelled) setState({ status: "error", message: "読み込みに失敗しました" });
    });

    return () => {
      cancelled = true;
    };
  }, [db, documentId]);

  if (state.status === "loading") {
    return <p style={{ padding: "2rem" }}>読み込み中…</p>;
  }
  if (state.status === "error") {
    return (
      <p role="alert" style={{ padding: "2rem" }}>
        {state.message}
      </p>
    );
  }

  return (
    <div>
      <div className="no-print print-toolbar">
        <Link to="/">
          <button type="button">ホームに戻る</button>
        </Link>{" "}
        <button
          type="button"
          onClick={() => {
            window.print();
          }}
        >
          印刷する(PDFとして保存もこちらから)
        </button>
      </div>
      <DocumentPrintLayout {...state.props} />
    </div>
  );
}
