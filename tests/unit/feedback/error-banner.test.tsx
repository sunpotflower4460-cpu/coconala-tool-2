import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErrorBanner } from "@/components/feedback/ErrorBanner";

describe("ErrorBanner", () => {
  it("開発用コードを出さず、診断情報をコピーできる", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <ErrorBanner
        message="データを保存できませんでした。少し時間を置いてもう一度お試しください。"
        code="unknown_error"
      />,
    );
    expect(screen.queryByText(/SQLITE_/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "診断情報をコピー" }));
    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0]?.[0] as string;
    expect(copied).toContain("code: unknown_error");
    expect(copied).toContain("データを保存できませんでした");
    expect(copied).not.toContain("sk-ant-");
    expect(await screen.findByRole("status")).toHaveTextContent("コピーしました");
  });
});
