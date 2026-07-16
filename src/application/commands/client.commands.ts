import type { DatabasePort } from "@/application/ports/database";
import { toAppError, type AppError } from "@/application/errors";
import { getClient } from "@/application/queries/list-clients.query";
import type { Client, ClientInput } from "@/domain/clients/types";
import { err, ok, type Result } from "@/lib/result";

export async function createClient(
  db: DatabasePort,
  input: ClientInput,
): Promise<Result<Client, AppError>> {
  try {
    const now = new Date().toISOString();
    const result = await db.execute(
      `INSERT INTO clients (name, contact_name, postal_code, address, phone, email, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.name,
        input.contactName,
        input.postalCode,
        input.address,
        input.phone,
        input.email,
        input.note,
        now,
        now,
      ],
    );
    const created = await getClient(db, result.lastInsertId);
    if (!created) {
      return err({ code: "save_failed", message: "顧客の登録に失敗しました" });
    }
    return ok(created);
  } catch (error) {
    return err(toAppError(error, "顧客の登録に失敗しました"));
  }
}

export async function updateClient(
  db: DatabasePort,
  id: number,
  input: ClientInput,
): Promise<Result<Client, AppError>> {
  try {
    const now = new Date().toISOString();
    await db.execute(
      `UPDATE clients SET name = ?, contact_name = ?, postal_code = ?, address = ?, phone = ?,
         email = ?, note = ?, updated_at = ? WHERE id = ?`,
      [
        input.name,
        input.contactName,
        input.postalCode,
        input.address,
        input.phone,
        input.email,
        input.note,
        now,
        id,
      ],
    );
    const updated = await getClient(db, id);
    if (!updated) {
      return err({ code: "not_found", message: "対象の顧客が見つかりません" });
    }
    return ok(updated);
  } catch (error) {
    return err(toAppError(error, "顧客の更新に失敗しました"));
  }
}

export async function deleteClient(db: DatabasePort, id: number): Promise<Result<void, AppError>> {
  try {
    await db.execute(`DELETE FROM clients WHERE id = ?`, [id]);
    return ok(undefined);
  } catch (error) {
    return err(
      toAppError(
        error,
        "この顧客は書類から参照されているため削除できません。書類を先に整理してください。",
      ),
    );
  }
}
