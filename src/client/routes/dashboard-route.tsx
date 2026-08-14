import { DashboardView } from "@client/features/dashboard";
import { RequireAuth } from "@client/components/auth/require-auth";

export function Component() {
  return <RequireAuth><DashboardView /></RequireAuth>;
}
