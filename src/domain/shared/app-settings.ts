import type { RoundingMode } from "@/domain/tax/types";

export interface AppSettings {
  roundingMode: RoundingMode;
  documentNumberPrefixEstimate: string;
  documentNumberPrefixInvoice: string;
  documentNumberPrefixDelivery: string;
  documentNumberPrefixReceipt: string;
  theme: "system" | "light" | "dark";
  aiEnabled: boolean;
  aiModel: string;
  onboardingCompleted: boolean;
}

export type AppSettingsInput = Partial<AppSettings>;
