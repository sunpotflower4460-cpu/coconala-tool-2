import { expect, test } from "@playwright/test";

// このE2Eは`pnpm dev`(ブラウザのみ、Tauriの実行環境なし)で動かすため、
// SQLiteへ接続できず案内メッセージが表示される。実際の画面遷移は
// `pnpm tauri dev`を使った手動確認、またはOS付きCI環境でのE2Eで検証する。
test("Tauri実行環境がない場合はデータベース接続エラーを案内する", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByText("データベースに接続できません。デスクトップアプリとして起動してください。"),
  ).toBeVisible();
});
