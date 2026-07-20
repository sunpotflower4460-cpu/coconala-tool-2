import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// サンドボックス環境ではプリインストール済みブラウザのバージョンとplaywrightパッケージの
// 期待バージョンがずれることがあるため、存在する場合のみ実行ファイルを直接指定する。
const sandboxChromePath = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath = existsSync(sandboxChromePath) ? sandboxChromePath : undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:1420",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: executablePath ? { executablePath } : {},
      },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:1420",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
