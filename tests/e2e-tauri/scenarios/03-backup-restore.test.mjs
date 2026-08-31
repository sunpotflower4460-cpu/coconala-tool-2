import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clickNav,
  confirmDangerDialog,
  createAppSession,
  ensureOnboarded,
  waitForAppReady,
  waitForRootText,
} from "../helpers/flows.mjs";

test("バックアップ作成後にデータを変えても、復元と再起動で元に戻る", async (t) => {
  const client = await createAppSession();
  t.after(async () => {
    await client.deleteSession().catch(() => {});
  });

  await ensureOnboarded(client);

  await clickNav(client, "データ管理");
  await waitForRootText(client, /バックアップ/, 10000);
  await client.$("button=バックアップを作成").click();
  await waitForRootText(client, /mitsumori-desk-backup-/, 15000);

  await clickNav(client, "顧客");
  await waitForRootText(client, /顧客一覧/, 10000);
  await client.$("button=新しい顧客を登録").click();
  await client.$("#client-name").waitForDisplayed({ timeout: 10000 });
  await client.$("#client-name").setValue("復元前に追加した顧客");
  await client.$("button=保存する").click();
  await waitForRootText(client, /復元前に追加した顧客/, 10000);

  await clickNav(client, "データ管理");
  await waitForRootText(client, /mitsumori-desk-backup-/, 10000);
  await client.$("button=復元").click();
  await confirmDangerDialog(client, /復元しますか/);
  await waitForRootText(client, /復元が完了しました/, 20000);

  await client.deleteSession().catch(() => {});

  const restarted = await createAppSession();
  t.after(async () => {
    await restarted.deleteSession().catch(() => {});
  });
  await waitForAppReady(restarted);
  await clickNav(restarted, "顧客");
  await waitForRootText(restarted, /E2Eテスト株式会社/, 10000);
  const listText = await restarted.$("#root").getText();
  assert.match(listText, /E2Eテスト株式会社/, "復元後も元の顧客が残る");
  assert.doesNotMatch(
    listText,
    /復元前に追加した顧客/,
    "バックアップ後に追加した顧客は復元で消える",
  );
});
