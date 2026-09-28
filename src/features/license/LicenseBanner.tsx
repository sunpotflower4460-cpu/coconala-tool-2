import { Link } from "react-router-dom";
import { useLicense } from "@/features/license/license-context";

/** ライセンス未登録の案内。操作は妨げない(閉じる必要もない控えめな帯)。 */
export function LicenseBanner() {
  const { status } = useLicense();
  if (!status || status.state === "valid") return null;
  return (
    <div className="license-banner no-print" role="status">
      {status.state === "invalid"
        ? "登録されたライセンスキーを確認できません。"
        : "ライセンスキーが未登録です。"}
      印刷・PDFに「未認証版」と入ります(データの作成・保存はそのまま使えます)。{" "}
      <Link to="/version">ライセンスキーを登録する</Link>
    </div>
  );
}
