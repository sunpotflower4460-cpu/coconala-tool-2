import type { UpdateCheckPort, UpdateCheckResult } from "@/application/ports/update-check";

// 署名鍵・更新サーバーが未設定の間はこれを使う。docs/MANUAL_STEPS.mdのPhase5項目を参照。
export const notConfiguredUpdateCheck: UpdateCheckPort = {
  check(): Promise<UpdateCheckResult> {
    return Promise.resolve({ status: "not_configured" });
  },
};
