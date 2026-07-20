import type { DatabasePort } from "@/application/ports/database";
import type { Company } from "@/domain/shared/company";

interface CompanyRow {
  display_name: string;
  representative_name: string | null;
  postal_code: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  invoice_registration_number: string | null;
  bank_name: string | null;
  bank_branch_name: string | null;
  bank_account_type: string | null;
  bank_account_number: string | null;
  bank_account_holder: string | null;
  logo_path: string | null;
  estimate_valid_days: number | null;
  payment_due_days: number | null;
  default_note: string | null;
}

export function mapCompanyRow(row: CompanyRow): Company {
  return {
    displayName: row.display_name,
    representativeName: row.representative_name,
    postalCode: row.postal_code,
    address: row.address,
    phone: row.phone,
    email: row.email,
    invoiceRegistrationNumber: row.invoice_registration_number,
    bankName: row.bank_name,
    bankBranchName: row.bank_branch_name,
    bankAccountType: row.bank_account_type,
    bankAccountNumber: row.bank_account_number,
    bankAccountHolder: row.bank_account_holder,
    logoPath: row.logo_path,
    estimateValidDays: row.estimate_valid_days,
    paymentDueDays: row.payment_due_days,
    defaultNote: row.default_note,
  };
}

export async function getCompany(db: DatabasePort): Promise<Company | null> {
  const rows = await db.select<CompanyRow>(
    `SELECT display_name, representative_name, postal_code, address, phone, email,
            invoice_registration_number, bank_name, bank_branch_name, bank_account_type,
            bank_account_number, bank_account_holder, logo_path, estimate_valid_days,
            payment_due_days, default_note
     FROM companies WHERE id = 1`,
  );
  return rows[0] ? mapCompanyRow(rows[0]) : null;
}
