// 診断ファイルとして保存する前の最終防衛ライン。
// APIキーらしき文字列やメールアドレスが混入していないかを機械的に検査する。
const SECRET_LIKE_PATTERNS: RegExp[] = [
  /sk-ant-[a-zA-Z0-9_-]{10,}/, // Anthropic APIキー
  /sk-[a-zA-Z0-9_-]{20,}/, // 一般的なAPIキー形式
  /[A-Za-z0-9+/]{40,}={0,2}/, // 長いbase64文字列
  /[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/, // メールアドレス
];

export function containsSecretLikeContent(text: string): boolean {
  return SECRET_LIKE_PATTERNS.some((pattern) => pattern.test(text));
}
