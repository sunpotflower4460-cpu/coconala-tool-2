import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { HomePage } from "@/app/HomePage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
