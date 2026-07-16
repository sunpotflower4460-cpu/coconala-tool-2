import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppLayout } from "@/app/AppLayout";
import { HomePage } from "@/app/HomePage";
import { CatalogFormPage } from "@/features/catalog/CatalogFormPage";
import { CatalogListPage } from "@/features/catalog/CatalogListPage";
import { ClientFormPage } from "@/features/clients/ClientFormPage";
import { ClientListPage } from "@/features/clients/ClientListPage";
import { CompanySettingsPage } from "@/features/companies/CompanySettingsPage";
import { EstimateEditorPage } from "@/features/estimates/EstimateEditorPage";
import { EstimateListPage } from "@/features/estimates/EstimateListPage";
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
      { path: "estimates", element: <EstimateListPage /> },
      { path: "estimates/new", element: <EstimateEditorPage /> },
      { path: "estimates/:id", element: <EstimateEditorPage /> },
      { path: "settings/company", element: <CompanySettingsPage /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
