import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@/application/commands/client.commands";
import { saveCompany } from "@/application/commands/save-company.command";
import { saveEstimateDraft } from "@/application/commands/save-estimate-draft.command";
import { convertDocument } from "@/application/commands/convert-document.command";
import { issueDocument } from "@/application/commands/issue-document.command";
import { getDocument } from "@/application/queries/get-document.query";
import { getDocumentDraft } from "@/application/queries/get-document-draft.query";
import type { DatabasePort } from "@/application/ports/database";
import { EstimateEditorPage } from "@/features/estimates/EstimateEditorPage";
import { DatabaseContext } from "@/infrastructure/database/use-database";
import { createTestDatabase } from "@/lib/test-utils/sqlite";

async function seed(db: DatabasePort) {
  await saveCompany(db, {
    displayName: "サンプル制作合同会社",
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
    estimateValidDays: 30,
    paymentDueDays: 30,
    defaultNote: null,
  });
  const client = await createClient(db, {
    name: "サンプル株式会社",
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
    validUntil: "2026-08-15",
    pricingType: "tax_exclusive",
    discountYen: 0,
    note: null,
    lines: [
      {
        catalogItemId: null,
        name: "動画編集",
        description: null,
        unit: "本",
        quantity: 1,
        unitPriceYen: 30000,
        taxCategory: "taxable_10",
        lineDiscountYen: 0,
      },
    ],
  });
  if (!draft.ok) throw new Error("unexpected");
  return draft.value.header.id!;
}

function renderEditor(db: DatabasePort, documentId: number) {
  const router = createMemoryRouter(
    [
      { path: "/estimates/:id", element: <EstimateEditorPage /> },
      { path: "/documents/:id", element: <p>書類詳細</p> },
    ],
    { initialEntries: [`/estimates/${documentId}`] },
  );
  render(
    <DatabaseContext.Provider value={{ status: "ready", db }}>
      <RouterProvider router={router} />
    </DatabaseContext.Provider>,
  );
}

describe("見積編集画面の発行", () => {
  let db: DatabasePort;

  beforeEach(() => {
    db = createTestDatabase();
  });

  it("保存せずに編集してから発行しても、画面上の最新の内容が発行される", async () => {
    const documentId = await seed(db);
    const user = userEvent.setup();
    renderEditor(db, documentId);

    const priceInput = await screen.findByDisplayValue("30000");
    await user.clear(priceInput);
    await user.type(priceInput, "50000");

    await user.click(screen.getByRole("button", { name: "発行する" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      Array.from(dialog.querySelectorAll("button")).find(
        (button) => button.textContent === "発行する",
      )!,
    );

    await screen.findByText("書類詳細");
    const issued = await getDocument(db, documentId);
    expect(issued?.status).toBe("issued");
    expect(issued?.subtotalYen).toBe(50000);
    expect(issued?.calculationSnapshot?.subtotalYen).toBe(50000);
  });

  it("請求書の下書きではお支払期限を編集でき、保存しても消えない", async () => {
    const estimateId = await seed(db);
    const issued = await issueDocument(db, estimateId);
    if (!issued.ok) throw new Error("unexpected");
    const invoice = await convertDocument(db, estimateId, "invoice");
    if (!invoice.ok) throw new Error("unexpected");
    const invoiceId = invoice.value.id;

    const user = userEvent.setup();
    renderEditor(db, invoiceId);
    const dueInput = await screen.findByLabelText("お支払期限");
    expect(screen.queryByLabelText("有効期限")).not.toBeInTheDocument();
    await user.type(dueInput, "2026-09-30");
    await user.click(screen.getByRole("button", { name: "下書きを保存" }));

    await waitFor(async () => {
      const draft = await getDocumentDraft(db, invoiceId);
      expect(draft?.header.dueDate).toBe("2026-09-30");
    });
  });
});
