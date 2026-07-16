import type { FeatureFlags } from "@/domain/shared/feature-flags";
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
  onboardingStep: string;
  featureFlags: FeatureFlags;
}

export type AppSettingsInput = Partial<AppSettings>;
