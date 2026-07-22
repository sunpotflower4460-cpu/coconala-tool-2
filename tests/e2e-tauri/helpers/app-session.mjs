import { remote } from "webdriverio";

// tests/e2e-tauri/run.shがtauri-driverを起動し、実行ファイルのパスとポートを
// 環境変数で渡す。単体でこのファイルをimportして使う場合は、事前にrun.shを
// 経由するか、同じ環境変数を自分で設定すること。
export async function createAppSession() {
  const binary = process.env.E2E_TAURI_BINARY;
  if (!binary) {
    throw new Error(
      "E2E_TAURI_BINARY環境変数が設定されていません。tests/e2e-tauri/run.sh経由で実行してください。",
    );
  }
  const port = Number(process.env.E2E_TAURI_DRIVER_PORT ?? 4444);

  return remote({
    hostname: "localhost",
    port,
    path: "/",
    capabilities: {
      "tauri:options": { application: binary },
    },
    logLevel: "error",
  });
}

// #root配下に、DB接続中のプレースホルダーではない実際の画面が描画されるまで待つ。
// 「データベースを準備しています…」等の読み込み中表示だけでも文字列としては
// 非空になるため、それだけで判定すると早すぎるタイミングで先へ進んでしまう。
export async function waitForAppReady(client, timeout = 15000) {
  const root = await client.$("#root");
  await client.waitUntil(
    async () => {
      const text = (await root.getText()).trim();
      return text.length > 0 && !text.includes("準備しています");
    },
    {
      timeout,
      timeoutMsg: "#root に実際の画面が描画されませんでした(DB接続に失敗した可能性があります)",
    },
  );
  return root;
}

// 指定した文言が#rootのテキストに含まれるまで待つ。一覧・詳細画面はデータ取得が
// 非同期のため、画面遷移直後は一時的に空表示になることがある。
export async function waitForRootText(client, pattern, timeout = 10000) {
  await client.waitUntil(async () => pattern.test(await client.$("#root").getText()), {
    timeout,
    timeoutMsg: `#root のテキストが条件(${pattern})を満たしませんでした`,
  });
}
