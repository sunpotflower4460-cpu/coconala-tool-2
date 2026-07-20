# 0001 — Tauri 2でデスクトップアプリを構築する

## ステータス

採用

## コンテキスト

購入者のPC上で完結する買い切りデスクトップツールを、macOS / Windows向けに1つのコードベースで提供する必要がある。顧客情報・価格表・帳票データはローカル保存が原則であり、常時クラウド接続を前提にできない。

候補は Electron、Tauri、ネイティブ別実装(Swift/​C#)の3系統だった。

## 決定

Tauri 2 + React + TypeScript を採用する。

理由:

- Rustで書かれたバックエンドにより、配布サイズと常駐メモリがElectronより小さい。
- WebViewはOS標準のものを利用するため、Chromiumを同梱するElectronよりバイナリが軽い。
- Tauriの権限(Capabilities)モデルにより、Shell実行や任意ファイルアクセスを既定で禁止でき、「Tauriの権限は最小限にする」という商品要件に合致する。
- ネイティブ別実装はmacOS/Windowsで別コードベースになり、開発・保守コストが増える。

## 影響

- WebView描画差異(macOSのWebKit / WindowsのWebView2)を帳票プレビューで確認する必要がある。
- Rust側のビルド環境(webkit2gtk等)をCI・開発環境双方に用意する必要がある。
- Tauriの安定版アップデートに追従する運用コストが発生する。
