import { invoke, isTauri } from "@tauri-apps/api/core";

/**
 * OSの印刷ダイアログを開く。Tauri上ではRustコマンド経由(macOSで確実に開くため)、
 * ブラウザ(開発・テスト)では window.print() を使う。
 * 失敗しても例外は投げず、画面に出せる日本語メッセージを返す。
 */
export async function printDocument(): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    if (isTauri()) {
      await invoke("print_current_webview");
    } else {
      window.print();
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "印刷ダイアログを開けませんでした。アプリを再起動してからもう一度お試しください。",
    };
  }
}
