import { useState } from "react";

interface ErrorBannerProps {
  message: string;
  code?: string;
}

function buildDiagnosticsText(message: string, code: string): string {
  return [
    "見積・請求書デスク 診断情報",
    `code: ${code}`,
    `time: ${new Date().toISOString()}`,
    `message: ${message}`,
    "※バージョン番号は「バージョン情報」画面で確認してください。",
  ].join("\n");
}

export function ErrorBanner({ message, code = "unknown_error" }: ErrorBannerProps) {
  const [copied, setCopied] = useState(false);

  async function copyDiagnostics() {
    const text = buildDiagnosticsText(message, code);
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return;
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }

  return (
    <div role="alert" className="error-banner">
      <p style={{ margin: 0 }}>{message}</p>
      <p style={{ margin: "0.5rem 0 0" }}>
        <button type="button" onClick={() => void copyDiagnostics()}>
          診断情報をコピー
        </button>
        {copied ? <span role="status"> コピーしました</span> : null}
      </p>
    </div>
  );
}
