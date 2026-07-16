import { describe, expect, it } from "vitest";
import { canTransitionDocumentStatus, isEditableStatus } from "@/domain/documents";

describe("canTransitionDocumentStatus", () => {
  it("draftからissuedへ遷移できる", () => {
    expect(canTransitionDocumentStatus("draft", "issued")).toBe(true);
  });

  it("draftから承認済みへは直接遷移できない", () => {
    expect(canTransitionDocumentStatus("draft", "approved")).toBe(false);
  });

  it("issuedはapproved/rejected/cancelledへ遷移できる", () => {
    expect(canTransitionDocumentStatus("issued", "approved")).toBe(true);
    expect(canTransitionDocumentStatus("issued", "rejected")).toBe(true);
    expect(canTransitionDocumentStatus("issued", "cancelled")).toBe(true);
  });

  it("paid・cancelledは終端状態で遷移先を持たない", () => {
    expect(canTransitionDocumentStatus("paid", "draft")).toBe(false);
    expect(canTransitionDocumentStatus("cancelled", "draft")).toBe(false);
  });
});

describe("isEditableStatus", () => {
  it("draftのみ編集可能", () => {
    expect(isEditableStatus("draft")).toBe(true);
    expect(isEditableStatus("issued")).toBe(false);
  });
});
