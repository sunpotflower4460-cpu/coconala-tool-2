import { beforeEach, describe, expect, it } from "vitest";
import { createClient, deleteClient, updateClient } from "@/application/commands/client.commands";
import { getClient, listClients } from "@/application/queries/list-clients.query";
import type { DatabasePort } from "@/application/ports/database";
import { createTestDatabase } from "@/lib/test-utils/sqlite";
import type { ClientInput } from "@/domain/clients/types";

const sample: ClientInput = {
  name: "サンプル株式会社",
  contactName: "鈴木一郎",
  postalCode: "100-0001",
  address: "東京都千代田区1-1-1",
  phone: "03-0000-0000",
  email: "contact@example.com",
  note: null,
};

describe("clients", () => {
  let db: DatabasePort;

  beforeEach(() => {
    db = createTestDatabase();
  });

  it("顧客を登録・取得できる", async () => {
    const created = await createClient(db, sample);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.id).toBeGreaterThan(0);

    const fetched = await getClient(db, created.value.id);
    expect(fetched?.name).toBe("サンプル株式会社");
  });

  it("顧客一覧を名前順で取得できる", async () => {
    await createClient(db, { ...sample, name: "b社" });
    await createClient(db, { ...sample, name: "a社" });
    const list = await listClients(db);
    expect(list.map((c) => c.name)).toEqual(["a社", "b社"]);
  });

  it("名前で検索できる", async () => {
    await createClient(db, { ...sample, name: "動画編集の田中商店" });
    await createClient(db, { ...sample, name: "印刷の佐藤工房" });
    const result = await listClients(db, { search: "田中" });
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("動画編集の田中商店");
  });

  it("顧客情報を更新できる", async () => {
    const created = await createClient(db, sample);
    if (!created.ok) throw new Error("unexpected");
    const updated = await updateClient(db, created.value.id, { ...sample, name: "更新後の名前" });
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.value.name).toBe("更新後の名前");
    }
  });

  it("顧客を削除できる", async () => {
    const created = await createClient(db, sample);
    if (!created.ok) throw new Error("unexpected");
    await deleteClient(db, created.value.id);
    expect(await getClient(db, created.value.id)).toBeNull();
  });
});
