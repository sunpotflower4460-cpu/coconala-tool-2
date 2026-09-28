import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCompany } from "@/application/queries/get-company.query";
import { getDocument } from "@/application/queries/get-document.query";
import { getImageAssetDataUrl } from "@/application/queries/get-image-asset.query";
import { getClient } from "@/application/queries/list-clients.query";
import {
  DocumentPrintLayout,
  type DocumentPrintLayoutProps,
} from "@/components/documents/DocumentPrintLayout";
import { calculateDocumentTotals } from "@/domain/tax/calculate-document-totals";
import { ErrorBanner } from "@/components/feedback/ErrorBanner";
import { DOCUMENT_TYPE_LABELS } from "@/lib/formatting/document-labels";
import { useDatabase } from "@/infrastructure/database/use-database";
import { useLicense } from "@/features/license/license-context";
import { printDocument } from "@/infrastructure/print/print-document";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; props: DocumentPrintLayoutProps }
  | { status: "error"; message: string };

export function DocumentPrintPage() {
  const db = useDatabase();
  const { id } = useParams<{ id: string }>();
  const documentId = Number(id);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [printError, setPrintError] = useState<string | null>(null);
  const { status: licenseStatus } = useLicense();

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
        const [company, client] = await Promise.all([
          getCompany(db),
          document.clientId ? getClient(db, document.clientId) : Promise.resolve(null),
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
        const logoDataUrl = await getImageAssetDataUrl(db, company.logoAssetSha256);
        const totals = calculateDocumentTotals(lineInputs, {
          discountYen: document.discountYen,
          pricingType: document.pricingType,
          // 発行時と同じ結果になるよう、設定値ではなく下書き保存時に記録した端数処理を使う。
          roundingMode: document.roundingMode,
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
              amountYen: totals.lines[index]?.rawAmountYen ?? 0,
              lineDiscountYen: line.lineDiscountYen,
            })),
            subtotalYen: totals.subtotalYen,
            taxYen: totals.taxYen,
            totalYen: totals.totalYen,
            taxBreakdown: totals.taxBreakdown,
            discountYen: document.discountYen,
            note: document.note,
            isDraftPreview: true,
            logoDataUrl,
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
      // 発行済みは発行時点のロゴ(スナップショットの参照)を使う。
      const issuedLogoDataUrl = await getImageAssetDataUrl(
        db,
        document.companySnapshot.logoAssetSha256,
      );
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
            amountYen: lineTotals.lines[index]?.rawAmountYen ?? 0,
            lineDiscountYen: line.lineDiscountYen,
          })),
          subtotalYen: document.subtotalYen,
          taxYen: document.taxYen,
          totalYen: document.totalYen,
          taxBreakdown: snapshot.taxBreakdown,
          discountYen: snapshot.discountYen,
          note: document.note,
          isDraftPreview: false,
          logoDataUrl: issuedLogoDataUrl,
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
          disabled={licenseStatus === null}
          onClick={() => {
            setPrintError(null);
            // 印刷ダイアログで「PDFとして保存」したときの既定のファイル名になる。
            window.document.title = printFileTitle(state.props);
            void printDocument().then((result) => {
              if (!result.ok) setPrintError(result.message);
            });
          }}
        >
          印刷する(PDFとして保存もこちらから)
        </button>
        <details className="print-pdf-guide">
          <summary>PDFとして保存するには</summary>
          <ul>
            <li>Mac: 印刷画面の左下にある「PDF」を押し、「PDFとして保存」を選びます。</li>
            <li>
              Windows: 「プリンター」で「Microsoft Print to
              PDF」を選び、「印刷」を押して保存先を選びます。
            </li>
            <li>ファイル名には書類番号が入ります。拡大縮小は「100%」のままにしてください。</li>
          </ul>
        </details>
      </div>
      {printError && <ErrorBanner message={printError} code="print_failed" />}
      <DocumentPrintLayout
        {...state.props}
        unlicensedWatermark={licenseStatus !== null && licenseStatus.state !== "valid"}
      />
    </div>
  );
}

function printFileTitle(props: DocumentPrintLayoutProps): string {
  const parts = [
    DOCUMENT_TYPE_LABELS[props.documentType],
    props.documentNumber ?? "下書き",
    props.client.name,
  ];
  // ファイル名に使えない文字を除く(macOS / Windows 共通)。
  return parts
    .join("_")
    .replace(/[\\/:*?"<>|\n\r\t]/g, "")
    .slice(0, 80);
}
