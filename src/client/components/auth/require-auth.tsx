import { useEffect, useState, type PropsWithChildren } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "@client/lib/api";

function safeNextPath(location: ReturnType<typeof useLocation>): string {
  const next = `${location.pathname}${location.search}${location.hash}`;
  return next.startsWith("/") && !next.startsWith("//") ? next : "/app";
}

export function RequireAuth({ children }: PropsWithChildren) {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "authorized">("checking");

  useEffect(() => {
    let active = true;
    void api.me().then(() => {
      if (active) setStatus("authorized");
    }).catch(() => {
      if (!active) return;
      const next = encodeURIComponent(safeNextPath(location));
      void navigate(`/login?next=${next}`, { replace: true });
    });
    return () => { active = false; };
  }, [location, navigate]);

  if (status === "checking") return <div className="route-loading" role="status">正在检查登录状态…</div>;
  return <>{children}</>;
}
