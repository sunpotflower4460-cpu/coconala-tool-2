import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DocumentPrintLayout } from "@/components/documents/DocumentPrintLayout";
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
      screen.getByText(`合計金額: ${formatYen(visualCase.props.totalYen)}`),
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
    expect(screen.getByText("消費税(8%(軽減税率))")).toBeInTheDocument();
    expect(screen.getByText("消費税(非課税)")).toBeInTheDocument();
  });
});
