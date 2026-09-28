export interface Company {
  displayName: string;
  representativeName: string | null;
  postalCode: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  invoiceRegistrationNumber: string | null;
  bankName: string | null;
  bankBranchName: string | null;
  bankAccountType: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  /** 旧フィールド(未使用)。ロゴは logoAssetSha256 を使う。 */
  logoPath: string | null;
  /**
   * ロゴ画像(app_assets)のSHA-256。発行済み書類の会社スナップショットにもこの値が入る。
   * 旧版で発行したスナップショットには無いため省略可能。保存時に省略すると既存のロゴを保つ。
   */
  logoAssetSha256?: string | null;
  estimateValidDays: number | null;
  paymentDueDays: number | null;
  defaultNote: string | null;
}

export type CompanyInput = Company;
