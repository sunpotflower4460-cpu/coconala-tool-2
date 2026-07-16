import { expect, test } from "@playwright/test";

test("ホーム画面が表示される", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "見積・請求書デスク" })).toBeVisible();
  await expect(page.getByText("データはこのパソコンに保存されます")).toBeVisible();
});
