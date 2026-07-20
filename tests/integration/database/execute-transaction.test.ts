import { beforeEach, describe, expect, it } from "vitest";
import { refPreviousInsertId } from "@/application/ports/database";
import type { DatabasePort } from "@/application/ports/database";
import { createTestDatabase } from "@/lib/test-utils/sqlite";

describe("DatabasePort.executeTransaction", () => {
  let db: DatabasePort;

  beforeEach(() => {
    db = createTestDatabase();
  });

  it("複数文が成功した場合はすべて反映される", async () => {
    const results = await db.executeTransaction([
      {
        sql: `INSERT INTO clients (name, created_at, updated_at) VALUES (?, ?, ?)`,
        params: ["顧客A", "2026-07-16T00:00:00.000Z", "2026-07-16T00:00:00.000Z"],
      },
      {
        sql: `INSERT INTO clients (name, created_at, updated_at) VALUES (?, ?, ?)`,
        params: ["顧客B", "2026-07-16T00:00:00.000Z", "2026-07-16T00:00:00.000Z"],
      },
    ]);
    expect(results).toHaveLength(2);

    const rows = await db.select<{ count: number }>(`SELECT COUNT(*) as count FROM clients`);
    expect(rows[0]?.count).toBe(2);
  });

  it("途中の文が失敗した場合、それ以前の変更もロールバックされる(原子性)", async () => {
    await expect(
      db.executeTransaction([
        {
          sql: `INSERT INTO clients (name, created_at, updated_at) VALUES (?, ?, ?)`,
          params: ["ロールバック確認用", "2026-07-16T00:00:00.000Z", "2026-07-16T00:00:00.000Z"],
        },
        // name はNOT NULLのため、2文目は失敗する
        {
          sql: `INSERT INTO clients (name, created_at, updated_at) VALUES (?, ?, ?)`,
          params: [null, "2026-07-16T00:00:00.000Z", "2026-07-16T00:00:00.000Z"],
        },
      ]),
    ).rejects.toThrow();

    const rows = await db.select<{ count: number }>(`SELECT COUNT(*) as count FROM clients`);
    expect(rows[0]?.count).toBe(0);
  });

  it("$ref参照で直前のINSERTのIDを後続の文へ渡せる", async () => {
    const results = await db.executeTransaction([
      {
        sql: `INSERT INTO clients (name, created_at, updated_at) VALUES (?, ?, ?)`,
        params: ["参照元", "2026-07-16T00:00:00.000Z", "2026-07-16T00:00:00.000Z"],
      },
      {
        sql: `UPDATE clients SET note = ? WHERE id = ?`,
        params: ["自己参照テスト", refPreviousInsertId(0)],
      },
    ]);
    const clientId = results[0]?.lastInsertId;
    const rows = await db.select<{ note: string | null }>(`SELECT note FROM clients WHERE id = ?`, [
      clientId,
    ]);
    expect(rows[0]?.note).toBe("自己参照テスト");
  });
});
