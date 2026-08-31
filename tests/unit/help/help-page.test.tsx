import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HelpPage } from "@/features/help/HelpPage";

const REQUIRED_HEADINGS = [
  "初回設定",
  "見積作成",
  "CSV取り込み",
  "PDF保存",
  "バックアップ",
  "復元",
  "AI設定",
  "データ保存場所",
  "アンインストール",
  "アップデート",
  "よくあるエラー",
  "サポート対象",
  "サポート対象外",
];

describe("HelpPage", () => {
  it("購入者が自己解決するための見出しをすべて表示する", () => {
    render(<HelpPage />);
    for (const heading of REQUIRED_HEADINGS) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
  });

  it("AIは任意であり、料金は購入者負担で、結果は最終決定ではないことを説明する", () => {
    render(<HelpPage />);
    expect(screen.getByText(/AI文章読み取りは任意です/)).toBeInTheDocument();
    expect(screen.getByText(/購入者のご負担です/)).toBeInTheDocument();
    expect(screen.getByText(/AIの結果は最終決定ではありません/)).toBeInTheDocument();
  });

  it("自動更新が未設定であることと、初回販売OSがmacOSであることを示す", () => {
    render(<HelpPage />);
    expect(screen.getByText(/自動更新は未設定です/)).toBeInTheDocument();
    expect(screen.getByText(/初回販売の対象OSは macOS/)).toBeInTheDocument();
  });
});
