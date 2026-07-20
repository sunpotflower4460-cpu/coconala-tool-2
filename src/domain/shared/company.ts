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
  logoPath: string | null;
  estimateValidDays: number | null;
  paymentDueDays: number | null;
  defaultNote: string | null;
}

export type CompanyInput = Company;
