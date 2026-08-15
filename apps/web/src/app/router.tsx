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
    path: "/app/codes/:projectId/qr",
    HydrateFallback: RouteFallback,
    lazy: () => import("@client/routes/qr-editor-route"),
  },
  {
    path: "/app/codes/:projectId/analytics",
    HydrateFallback: RouteFallback,
    lazy: () => import("@client/routes/code-analytics-route"),
  },
  {
    path: "/app/codes/:projectId/versions",
    HydrateFallback: RouteFallback,
    lazy: () => import("@client/routes/code-versions-route"),
  },
  {
    path: "/app/codes/:projectId/settings",
    HydrateFallback: RouteFallback,
    lazy: () => import("@client/routes/code-settings-route"),
  },
  {
    path: "/decoder",
    HydrateFallback: RouteFallback,
    lazy: () => import("@client/routes/decoder-route"),
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
