import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clickNav,
  completeOnboarding,
  createAppSession,
  waitForAppReady,
  waitForRootText,
} from "../helpers/flows.mjs";

test("初回設定を完了すると、顧客・価格表・練習見積が作成され金額計算も反映される", async (t) => {
  const client = await createAppSession();
  t.after(async () => {
    await client.deleteSession().catch(() => {});
  });

  await waitForAppReady(client);
  const homeText = await client.$("#root").getText();
  assert.match(
    homeText,
    /初回設定をはじめる/,
    "初回起動時は初回設定への案内が表示される(このファイルを先頭に、設定フォルダをリセットした状態で実行すること)",
  );
  await completeOnboarding(client);

  const draftText = await client.$("#root").getText();
  assert.match(draftText, /E2Eテスト株式会社/, "選択した顧客が表示される");
  assert.match(draftText, /E2Eテスト作業/, "登録した価格表の商品名が表示される");
  assert.match(draftText, /小計: ￥10,000/, "税抜小計が正しく計算される");
  assert.match(draftText, /消費税: ￥1,000/, "消費税(10%)が正しく計算される");
  assert.match(draftText, /合計: ￥11,000/, "合計金額が正しく計算される");
});

test("アプリを再起動しても、顧客・価格表・見積・会社情報・設定が保持される", async (t) => {
  const client = await createAppSession();
  t.after(async () => {
    await client.deleteSession().catch(() => {});
  });

  await waitForAppReady(client);
  const homeText = await client.$("#root").getText();
  assert.doesNotMatch(homeText, /初回設定をはじめる/, "再起動後は初回設定完了状態が保持されている");

  await clickNav(client, "顧客");
  await waitForRootText(client, /E2Eテスト株式会社/, 10000);

  await clickNav(client, "価格表");
  await waitForRootText(client, /E2Eテスト作業/, 10000);

  await clickNav(client, "見積書");
  await waitForRootText(client, /E2Eテスト株式会社/, 10000);
  const listText = await client.$("#root").getText();
  assert.match(listText, /E2Eテスト株式会社/, "作成した見積の顧客が一覧に残っている");
  assert.match(listText, /￥11,000/, "作成した見積の合計金額が一覧に残っている");

  await clickNav(client, "会社情報");
  await client.$("#company-name").waitForDisplayed({ timeout: 10000 });
  const companyName = await client.$("#company-name").getValue();
  assert.match(companyName, /E2Eテスト工房|変更後の工房名/, "会社名が再起動後も残る");

  await clickNav(client, "AI設定");
  await waitForRootText(client, /未設定|設定済み/, 10000);
});
