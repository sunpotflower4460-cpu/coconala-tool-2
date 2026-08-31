import type { ExtractedInquiry } from "@/domain/inquiries/types";
import type { Result } from "@/lib/result";

export interface ConnectionStatus {
  ok: boolean;
  message: string;
}

export type AiErrorCode =
  | "network"
  | "timeout"
  | "cancelled"
  | "invalid_api_key"
  | "forbidden"
  | "rate_limited"
  | "server_error"
  | "invalid_response"
  | "unknown";

export interface AiError {
  code: AiErrorCode;
  message: string;
}

export interface CatalogItemForExtraction {
  id: number;
  name: string;
  aliases: string[];
  unit: string | null;
}

export interface InquiryExtractionInput {
  text: string;
  catalogItems: CatalogItemForExtraction[];
}

export interface AiCallOptions {
  signal?: AbortSignal;
}

/**
 * AIサービスへの接続を抽象化する。APIキーは呼び出しごとに渡し、Provider自身は保持しない
 * (キーを保持する状態を持たないほうが、ログ・診断への混入経路を減らせる)。
 */
export interface AiProvider {
  readonly id: string;
  readonly displayName: string;
  testConnection(
    apiKey: string,
    options?: AiCallOptions,
  ): Promise<Result<ConnectionStatus, AiError>>;
  extractInquiry(
    input: InquiryExtractionInput,
    apiKey: string,
    options?: AiCallOptions,
  ): Promise<Result<ExtractedInquiry, AiError>>;
}
