import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { createClient } from "@/application/commands/client.commands";
import { convertDocument } from "@/application/commands/convert-document.command";
import { issueDocument } from "@/application/commands/issue-document.command";
import { saveCompany } from "@/application/commands/save-company.command";
import { saveEstimateDraft } from "@/application/commands/save-estimate-draft.command";
import type { DatabasePort } from "@/application/ports/database";
import { DocumentDetailPage } from "@/features/document-preview/DocumentDetailPage";
import { DatabaseContext } from "@/infrastructure/database/use-database";
import { createTestDatabase } from "@/lib/test-utils/sqlite";

async function issuedEstimate(db: DatabasePort): Promise<number> {
  await saveCompany(db, {
    displayName: "自社",
    representativeName: null,
    postalCode: null,
    address: null,
    phone: null,
    email: null,
    invoiceRegistrationNumber: null,
    bankName: null,
    bankBranchName: null,
    bankAccountType: null,
    bankAccountNumber: null,
    bankAccountHolder: null,
    logoPath: null,
    estimateValidDays: null,
    paymentDueDays: null,
    defaultNote: null,
  });
  const client = await createClient(db, {
    name: "顧客",
    contactName: null,
    postalCode: null,
    address: null,
    phone: null,
    email: null,
    note: null,
  });
  if (!client.ok) throw new Error("unexpected");
  const draft = await saveEstimateDraft(db, {
    id: null,
    clientId: client.value.id,
    issueDate: "2026-07-16",
    dueDate: null,
    validUntil: null,
    pricingType: "tax_exclusive",
    discountYen: 0,
    note: null,
    lines: [
      {
        catalogItemId: null,
        name: "作業",
        description: null,
        unit: null,
        quantity: 1,
        unitPriceYen: 1000,
        taxCategory: "taxable_10",
        lineDiscountYen: 0,
      },
    ],
  });
  if (!draft.ok) throw new Error("unexpected");
  const id = draft.value.header.id!;
  const issued = await issueDocument(db, id);
  if (!issued.ok) throw new Error("unexpected");
  return id;
}

describe("同じ書類からの二重変換の注意(CONC-CONVERT-01)", () => {
  it("既に請求書を作っていれば確認を出し、キャンセルすれば増えない", async () => {
    const db = createTestDatabase();
    const estimateId = await issuedEstimate(db);
    const first = await convertDocument(db, estimateId, "invoice");
    if (!first.ok) throw new Error("unexpected");

    const router = createMemoryRouter(
      [
        { path: "/documents/:id", element: <DocumentDetailPage /> },
        { path: "/estimates/:id", element: <p>編集画面</p> },
      ],
      { initialEntries: [`/documents/${estimateId}`] },
    );
    render(
      <DatabaseContext.Provider value={{ status: "ready", db }}>
        <RouterProvider router={router} />
      </DatabaseContext.Provider>,
    );
    const user = userEvent.setup();

    expect(await screen.findByText("この書類から作成した書類")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "請求書に変換" }));
    expect(await screen.findByText("この書類から作成した請求書が既にあります")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    const rows = await db.select<{ n: number }>(
      "SELECT COUNT(*) AS n FROM documents WHERE source_document_id = ?",
      [estimateId],
    );
    expect(rows[0]?.n).toBe(1);
  });
});
