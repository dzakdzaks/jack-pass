import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import { VaultEmptyDetail, VaultPage } from "@/features/credentials/VaultPage";
import { CredentialDetailScreen } from "@/features/credentials/CredentialDetailScreen";
import { CredentialFormScreen } from "@/features/credentials/CredentialFormScreen";
import { GeneratorScreen } from "@/features/generator/GeneratorScreen";
import { SettingsScreen } from "@/features/settings/SettingsScreen";

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      {
        path: "/",
        element: <VaultPage />,
        children: [
          { index: true, element: <VaultEmptyDetail /> },
          { path: "credentials/new", element: <CredentialFormScreen /> },
          { path: "credentials/:id", element: <CredentialDetailScreen /> },
          { path: "credentials/:id/edit", element: <CredentialFormScreen /> },
        ],
      },
      { path: "/generator", element: <GeneratorScreen /> },
      { path: "/settings", element: <SettingsScreen /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
