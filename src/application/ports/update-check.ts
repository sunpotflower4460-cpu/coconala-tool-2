/**
 * 更新確認の抽象境界。
 *
 * 署名鍵・更新ファイル配置先が未設定の間は`notConfiguredUpdateCheck`(常に`not_configured`)を使う。
 * 人間が署名鍵を生成し更新サーバーを用意した後、tauri-plugin-updaterベースの実装へ差し替える。
 * 更新確認の失敗は、既存の帳票データの読み書きに一切影響してはならない。
 */
export type UpdateCheckResult =
  | { status: "not_configured" }
  | { status: "up_to_date" }
  | { status: "available"; version: string; notes: string | null }
  | { status: "error"; message: string };

export interface UpdateCheckPort {
  check(): Promise<UpdateCheckResult>;
}
