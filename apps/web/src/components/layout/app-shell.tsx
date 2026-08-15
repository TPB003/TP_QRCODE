import { useEffect, useState, type CSSProperties, type PropsWithChildren } from "react";
import { BarChart3, FolderKanban, LayoutDashboard, LogOut, PanelsTopLeft, UserCircle2 } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { LogoMark } from "@client/components/ui/logo-mark";
import { generatedAssets } from "@client/lib/assets";
import { api } from "@client/lib/api";
import "./shell.css";

const globalNavigation = [
  { to: "/app", label: "工作台", icon: LayoutDashboard },
  { to: "/app?view=codes", label: "我的活码", icon: FolderKanban },
  { to: "/#templates", label: "内容类型", icon: PanelsTopLeft },
  { to: "/app?view=analytics", label: "扫码统计", icon: BarChart3 },
];

export function AppShell({ children }: PropsWithChildren) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  async function handleLogout() {
    await api.logout().catch(() => undefined);
    window.location.assign("/login");
  }

  return (
    <div
      className="app-shell"
      style={{ "--paper-texture": `url(${generatedAssets.archivalPaperTexture})` } as CSSProperties}
    >
      <header className="app-topbar">
        <Link to="/"><LogoMark inverted /></Link>
        <div className="app-topbar__account"><UserCircle2 /><span>个人账号</span><button type="button" onClick={() => void handleLogout()}><LogOut />退出登录</button></div>
        <button className="shell-menu-button" type="button" aria-label="打开工作台导航" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
          <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
        </button>
      </header>
      {menuOpen ? <button className="shell-drawer-backdrop" type="button" aria-label="关闭导航" onClick={() => setMenuOpen(false)} /> : null}
      <aside className={`app-sidebar ${menuOpen ? "is-open" : ""}`}>
        <nav aria-label="工作台导航">
          {globalNavigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={label} to={to} end={label === "工作台"} onClick={() => setMenuOpen(false)}><Icon /><span>{label}</span></NavLink>
          ))}
        </nav>
      </aside>
      <main className="app-shell__content">{children}</main>
    </div>
  );
}
