import type { DatabasePort } from "@/application/ports/database";
import type { Client } from "@/domain/clients/types";

interface ClientRow {
  id: number;
  name: string;
  contact_name: string | null;
  postal_code: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
}

export function mapClientRow(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contact_name,
    postalCode: row.postal_code,
    address: row.address,
    phone: row.phone,
    email: row.email,
    note: row.note,
  };
}

export interface ListClientsOptions {
  search?: string;
}

export async function listClients(
  db: DatabasePort,
  options: ListClientsOptions = {},
): Promise<Client[]> {
  const search = options.search?.trim();
  if (search) {
    const like = `%${search}%`;
    const rows = await db.select<ClientRow>(
      `SELECT id, name, contact_name, postal_code, address, phone, email, note
       FROM clients WHERE name LIKE ? OR contact_name LIKE ? ORDER BY name ASC`,
      [like, like],
    );
    return rows.map(mapClientRow);
  }

  const rows = await db.select<ClientRow>(
    `SELECT id, name, contact_name, postal_code, address, phone, email, note
     FROM clients ORDER BY name ASC`,
  );
  return rows.map(mapClientRow);
}

export async function getClient(db: DatabasePort, id: number): Promise<Client | null> {
  const rows = await db.select<ClientRow>(
    `SELECT id, name, contact_name, postal_code, address, phone, email, note
     FROM clients WHERE id = ?`,
    [id],
  );
  return rows[0] ? mapClientRow(rows[0]) : null;
}
