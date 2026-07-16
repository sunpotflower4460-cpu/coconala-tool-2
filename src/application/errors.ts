import { DomainError } from "@/domain/shared/errors";

export interface AppError {
  code: string;
  message: string;
}

export function toAppError(error: unknown, fallbackMessage: string): AppError {
  if (error instanceof DomainError) {
    return { code: error.code, message: error.message };
  }
  return { code: "unknown_error", message: fallbackMessage };
}
