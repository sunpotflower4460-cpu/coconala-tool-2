import assert from "node:assert/strict";
import { test } from "node:test";
import { createAppSession, waitForAppReady, waitForRootText } from "../helpers/app-session.mjs";

// 実際にビルドしたTauriアプリを起動し、初回設定→顧客・価格表登録→練習見積作成の
// 一連の流れと、アプリ再起動後もデータが残ることを検証する。
// tests/e2e-tauri/run.sh経由での実行を前提とする(アプリ設定フォルダをテスト前に
// リセットし、tauri-driverを起動してから呼び出す)。

test("初回設定を完了すると、顧客・価格表・練習見積が作成され金額計算も反映される", async (t) => {
  const client = await createAppSession();
  t.after(async () => {
    await client.deleteSession().catch(() => {});
  });

  await waitForAppReady(client);
  const homeText = await client.$("#root").getText();
  assert.match(homeText, /初回設定をはじめる/, "初回起動時は初回設定への案内が表示される");

  await client.$("button=初回設定をはじめる").click();

  // 1. 会社情報
  await client.$("#company-name").waitForDisplayed({ timeout: 10000 });
  await client.$("#company-name").setValue("E2Eテスト工房");
  await client.$("button=保存する").click();

  // 2. 税設定(既定値のまま次へ)
  await client.$("#onboarding-rounding-mode").waitForDisplayed({ timeout: 10000 });
  await client.$("button=次へ").click();

  // 3. 顧客登録
  await client.$("#onboarding-client-name").waitForDisplayed({ timeout: 10000 });
  await client.$("#onboarding-client-name").setValue("E2Eテスト株式会社");
  await client.$("button=登録して次へ").click();

  // 4. 価格表登録
  await client.$("#onboarding-catalog-name").waitForDisplayed({ timeout: 10000 });
  await client.$("#onboarding-catalog-name").setValue("E2Eテスト作業");
  await client.$("#onboarding-catalog-price").setValue("10000");
  await client.$("button=登録して次へ").click();

  // 5. 練習見積作成
  await client.$("button=練習用の見積を作る").waitForDisplayed({ timeout: 10000 });
  await client.$("button=練習用の見積を作る").click();

  // 6. 完了
  await client.$("button=はじめる").waitForDisplayed({ timeout: 10000 });
  await client.$("button=はじめる").click();

  // 練習見積の編集画面が表示され、入力した顧客・価格表・税計算結果が反映されていること
  await client.waitUntil(
    async () => (await client.$("#root").getText()).includes("E2Eテスト株式会社"),
    { timeout: 10000, timeoutMsg: "練習見積の編集画面が表示されませんでした" },
  );
  const draftText = await client.$("#root").getText();
  assert.match(draftText, /E2Eテスト株式会社/, "選択した顧客が表示される");
  assert.match(draftText, /E2Eテスト作業/, "登録した価格表の商品名が表示される");
  assert.match(draftText, /小計: ￥10,000/, "税抜小計が正しく計算される");
  assert.match(draftText, /消費税: ￥1,000/, "消費税(10%)が正しく計算される");
  assert.match(draftText, /合計: ￥11,000/, "合計金額が正しく計算される");
});

test("アプリを再起動しても、初回設定完了・作成した見積が保持される", async (t) => {
  const client = await createAppSession();
  t.after(async () => {
    await client.deleteSession().catch(() => {});
  });

  await waitForAppReady(client);
  const homeText = await client.$("#root").getText();
  assert.doesNotMatch(homeText, /初回設定をはじめる/, "再起動後は初回設定完了状態が保持されている");

  await client.$("a=見積書").click();
  // 一覧のデータ取得は非同期のため、「まだ見積書がありません」の空状態を
  // 経由してから内容が反映されることがある。目的の文言が出るまで待つ。
  await waitForRootText(client, /E2Eテスト株式会社/, 10000);
  const listText = await client.$("#root").getText();
  assert.match(listText, /E2Eテスト株式会社/, "作成した見積の顧客が一覧に残っている");
  assert.match(listText, /￥11,000/, "作成した見積の合計金額が一覧に残っている");
});
