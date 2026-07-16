import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";

export function HomePage() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion(null));
  }, []);

  return (
    <main style={{ padding: "2rem", maxWidth: 640, margin: "0 auto" }}>
      <h1>見積・請求書デスク</h1>
      <p>データはこのパソコンに保存されます。インターネットへ送信されません。</p>
      <p>バージョン: {version ?? "確認中..."}</p>
    </main>
  );
}
