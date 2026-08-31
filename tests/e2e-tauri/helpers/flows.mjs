import { createAppSession, waitForAppReady, waitForRootText } from "./app-session.mjs";

export { createAppSession, waitForAppReady, waitForRootText };

export async function clickNav(client, label) {
  const link = await client.$(`a=${label}`);
  await link.waitForDisplayed({ timeout: 10000 });
  await link.click();
}

export async function openEstimateList(client) {
  await clickNav(client, "見積書");
  await waitForRootText(client, /見積書一覧/, 10000);
}

export async function convertToDraft(client, buttonLabel, draftHeading) {
  await client.$(`button=${buttonLabel}`).click();
  // 「納品書」だけだと変換ボタン「納品書に変換」に即マッチし、遷移前に次へ進む。
  await waitForRootText(client, draftHeading, 15000);
}

export async function confirmDangerDialog(client, titlePattern, timeout = 10000) {
  const title = await client.$("#confirm-dialog-title");
  await title.waitForDisplayed({ timeout });
  const text = await title.getText();
  if (titlePattern && !titlePattern.test(text)) {
    throw new Error(`確認ダイアログのタイトルが想定と違います: ${text}`);
  }
  await client.$(".dialog button.button-danger").click();
}

export async function completeOnboarding(client) {
  await waitForAppReady(client);
  await client.$("button=初回設定をはじめる").click();

  await client.$("#company-name").waitForDisplayed({ timeout: 10000 });
  await client.$("#company-name").setValue("E2Eテスト工房");
  await client.$("button=保存する").click();

  await client.$("#onboarding-rounding-mode").waitForDisplayed({ timeout: 10000 });
  await client.$("button=次へ").click();

  await client.$("#onboarding-client-name").waitForDisplayed({ timeout: 10000 });
  await client.$("#onboarding-client-name").setValue("E2Eテスト株式会社");
  await client.$("button=登録して次へ").click();

  await client.$("#onboarding-catalog-name").waitForDisplayed({ timeout: 10000 });
  await client.$("#onboarding-catalog-name").setValue("E2Eテスト作業");
  await client.$("#onboarding-catalog-price").setValue("10000");
  await client.$("button=登録して次へ").click();

  await client.$("button=練習用の見積を作る").waitForDisplayed({ timeout: 10000 });
  await client.$("button=練習用の見積を作る").click();

  await client.$("button=はじめる").waitForDisplayed({ timeout: 10000 });
  await client.$("button=はじめる").click();

  await waitForRootText(client, /E2Eテスト株式会社/, 10000);
}

export async function ensureOnboarded(client) {
  await waitForAppReady(client);
  const homeText = await client.$("#root").getText();
  if (homeText.includes("初回設定をはじめる")) {
    await completeOnboarding(client);
    await clickNav(client, "ホーム");
    await waitForAppReady(client);
  }
}
