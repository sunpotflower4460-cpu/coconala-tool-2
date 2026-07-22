import { describe, expect, it } from "vitest";
import { createBackup } from "@/application/commands/create-backup.command";
import { exportBackup } from "@/application/commands/export-backup.command";
import { importBackup } from "@/application/commands/import-backup.command";
import { restoreBackup } from "@/application/commands/restore-backup.command";
import { createFakeBackupStore } from "@/lib/test-utils/fake-backup-store";

describe("createBackup", () => {
  it("日時からラベルを生成してバックアップを作成する", async () => {
    const store = createFakeBackupStore();
    const result = await createBackup(store, new Date(2026, 6, 16, 15, 30, 0));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.fileName).toBe("mitsumori-desk-backup-20260716-153000.db");
  });

  it("失敗した場合は日本語のエラーメッセージを返す", async () => {
    const store = createFakeBackupStore();
    const now = new Date(2026, 6, 16, 15, 30, 0);
    await createBackup(store, now);
    const result = await createBackup(store, now);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("バックアップの作成に失敗しました");
  });
});

describe("restoreBackup", () => {
  it("存在するバックアップから復元前退避ラベルを付けて復元する", async () => {
    const store = createFakeBackupStore();
    const created = await createBackup(store, new Date(2026, 6, 16, 15, 30, 0));
    if (!created.ok) throw new Error("unexpected");
    const result = await restoreBackup(
      store,
      created.value.fileName,
      new Date(2026, 6, 16, 16, 0, 0),
    );
    expect(result.ok).toBe(true);
  });

  it("存在しないバックアップの復元は失敗する", async () => {
    const store = createFakeBackupStore();
    const result = await restoreBackup(store, "mitsumori-desk-backup-not-found.db");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("復元に失敗しました");
  });
});

describe("exportBackup", () => {
  it("存在するバックアップを外部へ書き出し、保存先パスを返す", async () => {
    const store = createFakeBackupStore();
    const created = await createBackup(store, new Date(2026, 6, 16, 15, 30, 0));
    if (!created.ok) throw new Error("unexpected");

    const result = await exportBackup(store, created.value.fileName);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(`/exported/${created.value.fileName}`);
  });

  it("保存先の選択をキャンセルした場合はnullを返す", async () => {
    const store = createFakeBackupStore();
    const created = await createBackup(store, new Date(2026, 6, 16, 15, 30, 0));
    if (!created.ok) throw new Error("unexpected");
    store.nextExportCancelled = true;

    const result = await exportBackup(store, created.value.fileName);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeNull();
  });

  it("存在しないバックアップの書き出しは失敗する", async () => {
    const store = createFakeBackupStore();
    const result = await exportBackup(store, "mitsumori-desk-backup-not-found.db");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("バックアップの書き出しに失敗しました");
  });
});

describe("importBackup", () => {
  it("取り込んだバックアップを一覧へ追加する", async () => {
    const store = createFakeBackupStore();

    const result = await importBackup(store, new Date(2026, 6, 16, 15, 30, 0));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.fileName).toBe("mitsumori-desk-backup-imported-20260716-153000.db");
    expect(await store.list()).toHaveLength(1);
  });

  it("取り込み元の選択をキャンセルした場合はnullを返し、一覧も増えない", async () => {
    const store = createFakeBackupStore();
    store.nextImportCancelled = true;

    const result = await importBackup(store, new Date(2026, 6, 16, 15, 30, 0));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeNull();
    expect(await store.list()).toHaveLength(0);
  });
});
