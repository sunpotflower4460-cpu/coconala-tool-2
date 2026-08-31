import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clickNav,
  confirmDangerDialog,
  createAppSession,
  ensureOnboarded,
  waitForRootText,
} from "../helpers/flows.mjs";

test("見積を発行し、請求書・納品書・領収書へ変換しても元見積のスナップショットは変わらない", async (t) => {
  const client = await createAppSession();
  t.after(async () => {
    await client.deleteSession().catch(() => {});
  });

  await ensureOnboarded(client);
  await clickNav(client, "見積書");
  await waitForRootText(client, /E2Eテスト株式会社/, 10000);
  await client.$("a=開く").click();
  await waitForRootText(client, /E2Eテスト株式会社/, 10000);

  const editorText = await client.$("#root").getText();
  if (editorText.includes("発行する")) {
    await client.$("button=発行する").click();
    await confirmDangerDialog(client, /発行しますか/);
    await waitForRootText(client, /発行済み/, 15000);
  } else {
    await waitForRootText(client, /発行済み/, 10000);
  }

  const issuedText = await client.$("#root").getText();
  assert.match(issuedText, /発行済み/, "発行後は発行済みと表示される");
  assert.match(issuedText, /E2Eテスト株式会社/, "発行先の顧客が残っている");
  assert.match(issuedText, /￥11,000/, "発行時の合計が残っている");

  await clickNav(client, "会社情報");
  await client.$("#company-name").waitForDisplayed({ timeout: 10000 });
  const nameInput = await client.$("#company-name");
  await nameInput.clearValue();
  await nameInput.setValue("変更後の工房名");
  await client.$("button=保存する").click();
  await waitForRootText(client, /保存しました/, 10000);

  await clickNav(client, "見積書");
  await waitForRootText(client, /発行済み/, 10000);
  await client.$("a=開く").click();
  await waitForRootText(client, /発行済み/, 10000);
  await client.$("a=印刷プレビューを開く").click();
  await waitForRootText(client, /E2Eテスト工房/, 10000);
  const previewText = await client.$("#root").getText();
  assert.match(previewText, /E2Eテスト工房/, "発行時の会社名スナップショットが残る");
  assert.doesNotMatch(previewText, /変更後の工房名/, "発行後の会社名変更は過去帳票に反映されない");
  assert.match(previewText, /￥11,000/, "発行時の合計が印刷プレビューでも残る");

  await client.$("button=ホームに戻る").click();
  await clickNav(client, "見積書");
  await waitForRootText(client, /発行済み/, 10000);
  await client.$("a=開く").click();
  await waitForRootText(client, /発行済み/, 10000);

  await client.$("button=納品書に変換").click();
  await waitForRootText(client, /納品書/, 15000);

  await clickNav(client, "見積書");
  await waitForRootText(client, /発行済み|請求済み/, 10000);
  await client.$("a=開く").click();
  await waitForRootText(client, /発行済み|請求済み/, 10000);

  await client.$("button=請求書に変換").click();
  await waitForRootText(client, /請求書/, 15000);
  const invoiceDraft = await client.$("#root").getText();
  assert.match(invoiceDraft, /請求書/, "請求書の下書きへ遷移する");

  await client.$("button=発行する").click();
  await confirmDangerDialog(client, /発行しますか/);
  await waitForRootText(client, /発行済み/, 15000);

  await client.$("button=領収書に変換").click();
  await waitForRootText(client, /領収書/, 15000);
  const receiptDraft = await client.$("#root").getText();
  assert.match(receiptDraft, /領収書/, "領収書の下書きへ遷移する");

  await clickNav(client, "見積書");
  await waitForRootText(client, /E2Eテスト株式会社/, 10000);
  await client.$("a=開く").click();
  await client.$("a=印刷プレビューを開く").waitForDisplayed({ timeout: 10000 });
  await client.$("a=印刷プレビューを開く").click();
  await waitForRootText(client, /E2Eテスト工房/, 10000);
  const originalAfter = await client.$("#root").getText();
  assert.match(
    originalAfter,
    /E2Eテスト工房/,
    "変換後も元見積の会社名スナップショットは変わらない",
  );
  assert.match(originalAfter, /￥11,000/, "変換後も元見積の合計は変わらない");
});
