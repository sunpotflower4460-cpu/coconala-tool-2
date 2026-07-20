import type { DatabasePort } from "@/application/ports/database";
import { toAppError, type AppError } from "@/application/errors";
import { getCompany } from "@/application/queries/get-company.query";
import type { Company, CompanyInput } from "@/domain/shared/company";
import { err, ok, type Result } from "@/lib/result";

export async function saveCompany(
  db: DatabasePort,
  input: CompanyInput,
): Promise<Result<Company, AppError>> {
  try {
    const now = new Date().toISOString();
    await db.execute(
      `INSERT INTO companies (
         id, display_name, representative_name, postal_code, address, phone, email,
         invoice_registration_number, bank_name, bank_branch_name, bank_account_type,
         bank_account_number, bank_account_holder, logo_path, estimate_valid_days,
         payment_due_days, default_note, created_at, updated_at
       ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         display_name = excluded.display_name,
         representative_name = excluded.representative_name,
         postal_code = excluded.postal_code,
         address = excluded.address,
         phone = excluded.phone,
         email = excluded.email,
         invoice_registration_number = excluded.invoice_registration_number,
         bank_name = excluded.bank_name,
         bank_branch_name = excluded.bank_branch_name,
         bank_account_type = excluded.bank_account_type,
         bank_account_number = excluded.bank_account_number,
         bank_account_holder = excluded.bank_account_holder,
         logo_path = excluded.logo_path,
         estimate_valid_days = excluded.estimate_valid_days,
         payment_due_days = excluded.payment_due_days,
         default_note = excluded.default_note,
         updated_at = excluded.updated_at`,
      [
        input.displayName,
        input.representativeName,
        input.postalCode,
        input.address,
        input.phone,
        input.email,
        input.invoiceRegistrationNumber,
        input.bankName,
        input.bankBranchName,
        input.bankAccountType,
        input.bankAccountNumber,
        input.bankAccountHolder,
        input.logoPath,
        input.estimateValidDays,
        input.paymentDueDays,
        input.defaultNote,
        now,
        now,
      ],
    );
    const saved = await getCompany(db);
    if (!saved) {
      return err({ code: "save_failed", message: "会社情報の保存に失敗しました" });
    }
    return ok(saved);
  } catch (error) {
    return err(toAppError(error, "会社情報の保存に失敗しました"));
  }
}
