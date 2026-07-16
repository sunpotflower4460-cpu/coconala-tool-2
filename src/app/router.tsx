import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppLayout } from "@/app/AppLayout";
import { HomePage } from "@/app/HomePage";
import { CatalogFormPage } from "@/features/catalog/CatalogFormPage";
import { CatalogListPage } from "@/features/catalog/CatalogListPage";
import { ClientFormPage } from "@/features/clients/ClientFormPage";
import { ClientListPage } from "@/features/clients/ClientListPage";
import { AiSettingsPage } from "@/features/ai-settings/AiSettingsPage";
import { CompanySettingsPage } from "@/features/companies/CompanySettingsPage";
import { DocumentDetailPage } from "@/features/document-preview/DocumentDetailPage";
import { DocumentPrintPage } from "@/features/document-preview/DocumentPrintPage";
import { DocumentListPage } from "@/features/documents/DocumentListPage";
import { EstimateEditorPage } from "@/features/estimates/EstimateEditorPage";
import { InquiryExtractionPage } from "@/features/inquiries/InquiryExtractionPage";
import { OnboardingWizard } from "@/features/onboarding/OnboardingWizard";
import { RequireDatabase } from "@/infrastructure/database/RequireDatabase";

const router = createBrowserRouter([
  {
    path: "/onboarding",
    element: (
      <RequireDatabase>
        <OnboardingWizard />
      </RequireDatabase>
    ),
  },
  {
    path: "/documents/:id/print",
    element: (
      <RequireDatabase>
        <DocumentPrintPage />
      </RequireDatabase>
    ),
  },
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "clients", element: <ClientListPage /> },
      { path: "clients/new", element: <ClientFormPage /> },
      { path: "clients/:id/edit", element: <ClientFormPage /> },
      { path: "catalog", element: <CatalogListPage /> },
      { path: "catalog/new", element: <CatalogFormPage /> },
      { path: "catalog/:id/edit", element: <CatalogFormPage /> },
      { path: "estimates", element: <DocumentListPage documentType="estimate" allowCreate /> },
      { path: "estimates/new", element: <EstimateEditorPage /> },
      { path: "estimates/:id", element: <EstimateEditorPage /> },
      { path: "invoices", element: <DocumentListPage documentType="invoice" /> },
      { path: "deliveries", element: <DocumentListPage documentType="delivery_note" /> },
      { path: "receipts", element: <DocumentListPage documentType="receipt" /> },
      { path: "documents/:id", element: <DocumentDetailPage /> },
      { path: "inquiries", element: <InquiryExtractionPage /> },
      { path: "settings/company", element: <CompanySettingsPage /> },
      { path: "settings/ai", element: <AiSettingsPage /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
