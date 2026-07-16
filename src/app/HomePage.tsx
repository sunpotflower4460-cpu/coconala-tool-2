import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAppSettings } from "@/application/queries/get-app-settings.query";
import { listDocuments } from "@/application/queries/list-documents.query";
import { useDatabase } from "@/infrastructure/database/use-database";

export function HomePage() {
  const db = useDatabase();
  const [version, setVersion] = useState<string | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [recentEstimateCount, setRecentEstimateCount] = useState<number | null>(null);

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion(null));
    void getAppSettings(db).then((settings) =>
      setOnboardingCompleted(settings.onboardingCompleted),
    );
    void listDocuments(db, { documentType: "estimate" }).then((docs) =>
      setRecentEstimateCount(docs.length),
    );
  }, [db]);

  return (
    <div>
      <h1>見積・請求書デスク</h1>
      <p>データはこのパソコンに保存されます。インターネットへ送信されません。</p>
      <p>バージョン: {version ?? "確認中..."}</p>

      {onboardingCompleted === false && (
        <div
          className="error-banner"
          role="status"
          style={{ background: "#eef6ff", color: "#1a5fb4", borderColor: "#1a5fb4" }}
        >
          <p>まだ初回設定が完了していません。</p>
          <Link to="/onboarding">
            <button type="button">初回設定をはじめる</button>
          </Link>
        </div>
      )}

      {onboardingCompleted && (
        <div>
          <p>見積書: {recentEstimateCount ?? "-"}件</p>
          <Link to="/estimates/new">
            <button type="button">新しい見積書を作る</button>
          </Link>
        </div>
      )}
    </div>
  );
}
