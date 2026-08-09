import { createBrowserRouter } from "react-router-dom";
import { RouteFallback } from "@client/components/ui/route-fallback";

export const router = createBrowserRouter([
  {
    path: "/",
    HydrateFallback: RouteFallback,
    lazy: () => import("@client/routes/home-route"),
  },
  {
    path: "*",
    HydrateFallback: RouteFallback,
    lazy: () => import("@client/routes/not-found-route"),
  },
]);
