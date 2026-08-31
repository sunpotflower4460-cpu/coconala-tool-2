import { DomainError } from "@/domain/shared/errors";

export interface AppError {
  code: string;
  message: string;
}

const ENGINE_LEAK_PATTERN = /SQLITE_|rusqlite|sqlx::|panic occurred|os error \d+/i;

function sanitizeMessage(message: string, fallbackMessage: string): string {
  if (ENGINE_LEAK_PATTERN.test(message)) {
    return fallbackMessage;
  }
  return message;
}

export function toAppError(error: unknown, fallbackMessage: string): AppError {
  if (error instanceof DomainError) {
    return { code: error.code, message: sanitizeMessage(error.message, fallbackMessage) };
  }
  return { code: "unknown_error", message: fallbackMessage };
}
