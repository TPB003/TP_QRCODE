import { RouterProvider } from "react-router-dom";
import { AppProviders } from "@client/app/providers";
import { router } from "@client/app/router";

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
