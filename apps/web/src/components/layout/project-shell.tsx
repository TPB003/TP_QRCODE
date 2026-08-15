import { useEffect, useState, type CSSProperties, type PropsWithChildren } from "react";
import { ArrowLeft, BarChart3, History, QrCode, Settings, ScanLine } from "lucide-react";
import { Link, NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { LogoMark } from "@client/components/ui/logo-mark";
import { generatedAssets } from "@client/lib/assets";
import { api } from "@client/lib/api";
import "./shell.css";

export function ProjectShell({ children }: PropsWithChildren) {
  const { projectId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void api.me().then(() => {
      if (active) setAuthChecked(true);
    }).catch(() => navigate(`/login?next=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`, { replace: true }));
    return () => { active = false; };
  }, [location, navigate]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  if (!authChecked) return <div className="route-loading" role="status">正在检查登录状态…</div>;

  const projectNavigation = [
    { to: `/app/codes/${projectId}/qr`, label: "二维码编辑", icon: QrCode },
    { to: `/app/codes/${projectId}/versions`, label: "版本记录", icon: History },
    { to: `/app/codes/${projectId}/analytics`, label: "扫码统计", icon: BarChart3 },
    { to: `/app/codes/${projectId}/settings`, label: "活码设置", icon: Settings },
    { to: "/decoder", label: "解码器", icon: ScanLine },
    { to: "/app", label: "返回工作台", icon: ArrowLeft },
  ];

  return (
    <div
      className="project-shell"
      style={{ "--paper-texture": `url(${generatedAssets.archivalPaperTexture})` } as CSSProperties}
    >
      <header className="project-topbar">
        <Link to="/"><LogoMark inverted compact /></Link>
        <strong>项目工作台</strong>
        <span>TP QR PAPER WORKBENCH</span>
        <button className="shell-menu-button" type="button" aria-label="打开项目导航" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
          <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
        </button>
      </header>
      {menuOpen ? <button className="shell-drawer-backdrop" type="button" aria-label="关闭导航" onClick={() => setMenuOpen(false)} /> : null}
      <aside className={`project-sidebar ${menuOpen ? "is-open" : ""}`}>
        <nav aria-label="项目导航">
          {projectNavigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={label} to={to} onClick={() => setMenuOpen(false)}><Icon /><span>{label}</span></NavLink>
          ))}
        </nav>
      </aside>
      <main className="project-shell__content">{children}</main>
    </div>
  );
}
