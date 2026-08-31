#!/usr/bin/env bash
# 実際にビルドしたTauriアプリバイナリを、tauri-driver + WebKitWebDriver経由で
# 操作するE2Eテストを実行する。Linux専用(WebKitWebDriverを使うため)。
#
# 事前準備:
#   pnpm tauri build --no-bundle
#   sudo apt-get install -y webkit2gtk-driver xvfb
#   cargo install tauri-driver --locked
#
# 実行:
#   xvfb-run --auto-servernum pnpm test:e2e-tauri
#   (DISPLAYが既に使えるデスクトップ環境ではxvfb-runなしでも動く)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BINARY="$ROOT_DIR/src-tauri/target/release/mitsumori-desk"

if [ ! -x "$BINARY" ]; then
  echo "エラー: $BINARY が見つかりません。先に 'pnpm tauri build --no-bundle' を実行してください。" >&2
  exit 1
fi

if ! command -v tauri-driver >/dev/null 2>&1; then
  echo "エラー: tauri-driverが見つかりません。'cargo install tauri-driver --locked' でインストールしてください。" >&2
  exit 1
fi

# テストは初回設定からやり直せる状態を前提とするため、アプリの設定フォルダを
# 毎回リセットする(このスクリプトの外にあるデータには影響しない)。
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/com.mitsumoridesk.desktop"
rm -rf "$CONFIG_DIR"

TAURI_DRIVER_PORT="${TAURI_DRIVER_PORT:-4444}"
TAURI_DRIVER_NATIVE_PORT="${TAURI_DRIVER_NATIVE_PORT:-4445}"

tauri-driver --port "$TAURI_DRIVER_PORT" --native-port "$TAURI_DRIVER_NATIVE_PORT" &
DRIVER_PID=$!
trap 'kill "$DRIVER_PID" 2>/dev/null || true; wait "$DRIVER_PID" 2>/dev/null || true' EXIT

# tauri-driverがリクエストを受け付けるまで待つ(/statusはWebDriver仕様の標準エンドポイント)。
ready=0
for _ in $(seq 1 30); do
  if curl -sf "http://localhost:$TAURI_DRIVER_PORT/status" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 0.5
done
if [ "$ready" -ne 1 ]; then
  echo "エラー: tauri-driverが起動しませんでした" >&2
  exit 1
fi

E2E_TAURI_BINARY="$BINARY" \
E2E_TAURI_DRIVER_PORT="$TAURI_DRIVER_PORT" \
node --test --test-concurrency=1 "$ROOT_DIR"/tests/e2e-tauri/scenarios/*.test.mjs
