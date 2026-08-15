import { createBrowserRouter } from "react-router-dom";
import { RouteFallback } from "@client/components/ui/route-fallback";

export const router = createBrowserRouter([
  {
    path: "/",
    HydrateFallback: RouteFallback,
    lazy: () => import("@client/routes/home-route"),
  },
  {
    path: "/login",
    HydrateFallback: RouteFallback,
    lazy: () => import("@client/routes/login-route"),
  },
  {
    path: "/app",
    HydrateFallback: RouteFallback,
    lazy: () => import("@client/routes/dashboard-route"),
  },
  {
    path: "/app/projects/:projectId/qr",
    HydrateFallback: RouteFallback,
    lazy: () => import("@client/routes/qr-editor-route"),
  },
  {
    path: "/app/projects/:projectId/form",
    HydrateFallback: RouteFallback,
    lazy: () => import("@client/routes/form-builder-route"),
  },
  {
    path: "/app/projects/:projectId/batch",
    HydrateFallback: RouteFallback,
    lazy: () => import("@client/routes/batch-codes-route"),
  },
  {
    path: "/app/projects/:projectId/submissions",
    HydrateFallback: RouteFallback,
    lazy: () => import("@client/routes/submissions-route"),
  },
  {
    path: "/app/projects/:projectId/settings",
    HydrateFallback: RouteFallback,
    lazy: () => import("@client/routes/settings-route"),
  },
  {
    path: "/s/:slug",
    HydrateFallback: RouteFallback,
    lazy: () => import("@client/routes/public-scan-route"),
  },
  {
    path: "*",
    HydrateFallback: RouteFallback,
    lazy: () => import("@client/routes/not-found-route"),
  },
]);
