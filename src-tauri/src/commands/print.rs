// 帳票の印刷。WebViewの `window.print()` は、macOS(WKWebView)ではTauri側の許可設定に
// 依存して無反応になることがあるため、Rust側からネイティブの印刷ダイアログを開く。
// PDF保存は、この印刷ダイアログの「PDFとして保存」(macOS) / 「Microsoft Print to PDF」(Windows)を使う
// (ADR 0005)。
#[tauri::command]
pub fn print_current_webview(webview: tauri::Webview) -> Result<(), String> {
    webview
        .print()
        .map_err(|_| "印刷ダイアログを開けませんでした。もう一度お試しください。".to_string())
}
