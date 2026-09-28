import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DocumentPrintLayout } from "@/components/documents/DocumentPrintLayout";
import {
  buildTotalsSummaryRows,
  isTotalsSummaryConsistent,
} from "@/domain/documents/totals-summary";
import { formatYen } from "@/lib/formatting/money";
import { PDF_VISUAL_CASES } from "../../fixtures/pdf-visual/cases";

describe("PDF販売品質 fixture A〜M（見た目の最終判定は人間）", () => {
  it("A〜Mの13ケースが揃っている", () => {
    expect(PDF_VISUAL_CASES.map((item) => item.id).join("")).toBe("ABCDEFGHIJKLM");
  });

  it.each(PDF_VISUAL_CASES)("$id $title を描画でき、識別文字列と合計が出る", (visualCase) => {
    render(<DocumentPrintLayout {...visualCase.props} />);
    expect(screen.getByRole("heading", { name: "見積書" })).toBeInTheDocument();
    expect(document.body.textContent).toContain(visualCase.distinctiveText);
    expect(
      screen.getByText(`合計金額(税込): ${formatYen(visualCase.props.totalYen)}`),
    ).toBeInTheDocument();
    expect(visualCase.props.lines.length).toBeGreaterThan(0);
  });

  it("B/C/D はページ数の目安となる明細件数を持つ", () => {
    const counts = Object.fromEntries(
      PDF_VISUAL_CASES.filter((item) => ["B", "C", "D"].includes(item.id)).map((item) => [
        item.id,
        item.props.lines.length,
      ]),
    );
    expect(counts.B).toBe(35);
    expect(counts.C).toBe(90);
    expect(counts.D).toBe(180);
  });

  it("I は大きな金額を桁区切り付きで表示する", () => {
    const visualCase = PDF_VISUAL_CASES.find((item) => item.id === "I");
    if (!visualCase) throw new Error("missing I");
    render(<DocumentPrintLayout {...visualCase.props} />);
    expect(screen.getAllByText(formatYen(99_999_999)).length).toBeGreaterThan(0);
  });

  it("J は0円項目を表示する", () => {
    const visualCase = PDF_VISUAL_CASES.find((item) => item.id === "J");
    if (!visualCase) throw new Error("missing J");
    render(<DocumentPrintLayout {...visualCase.props} />);
    expect(screen.getByText("無償サンプル")).toBeInTheDocument();
    expect(screen.getAllByText(formatYen(0)).length).toBeGreaterThan(0);
  });

  it("K は値引きをマイナス表記する", () => {
    const visualCase = PDF_VISUAL_CASES.find((item) => item.id === "K");
    if (!visualCase) throw new Error("missing K");
    render(<DocumentPrintLayout {...visualCase.props} />);
    expect(screen.getByText(`-${formatYen(3000)}`)).toBeInTheDocument();
  });

  it("L は複数税率の内訳を表示する", () => {
    const visualCase = PDF_VISUAL_CASES.find((item) => item.id === "L");
    if (!visualCase) throw new Error("missing L");
    render(<DocumentPrintLayout {...visualCase.props} />);
    expect(screen.getByText("消費税(10%)")).toBeInTheDocument();
    expect(screen.getByText("消費税(8%※)")).toBeInTheDocument();
    expect(screen.getByText("10%対象(税抜)")).toBeInTheDocument();
    expect(screen.getByText("8%※対象(税抜)")).toBeInTheDocument();
    expect(screen.getByText("非課税対象")).toBeInTheDocument();
    expect(screen.getByText("※は軽減税率(8%)対象")).toBeInTheDocument();
  });

  it("K は値引き前の明細合計・値引き・値引き後の小計を上から順に表示する", () => {
    const visualCase = PDF_VISUAL_CASES.find((item) => item.id === "K");
    if (!visualCase) throw new Error("missing K");
    render(<DocumentPrintLayout {...visualCase.props} />);
    const { subtotalYen, discountYen } = visualCase.props;
    expect(screen.getByText("明細合計")).toBeInTheDocument();
    expect(screen.getByText("小計(値引き後)")).toBeInTheDocument();
    const labels = Array.from(document.querySelectorAll(".print-totals th")).map(
      (th) => th.textContent,
    );
    expect(labels.indexOf("明細合計")).toBeLessThan(labels.indexOf("値引き"));
    expect(labels.indexOf("値引き")).toBeLessThan(labels.indexOf("小計(値引き後)"));
    expect(screen.getAllByText(formatYen(subtotalYen + discountYen)).length).toBeGreaterThan(0);
  });

  it.each(PDF_VISUAL_CASES)(
    "$id 合計欄の数字は上から足し引きすると合計(税込)になる",
    (visualCase) => {
      const rows = buildTotalsSummaryRows(visualCase.props);
      expect(isTotalsSummaryConsistent(rows)).toBe(true);
    },
  );

  it("明細の金額は全体値引きを按分する前の額で印字する(K)", () => {
    const visualCase = PDF_VISUAL_CASES.find((item) => item.id === "K");
    if (!visualCase) throw new Error("missing K");
    const lineSum = visualCase.props.lines.reduce((sum, line) => sum + line.amountYen, 0);
    expect(lineSum).toBe(visualCase.props.subtotalYen + visualCase.props.discountYen);
  });
});
