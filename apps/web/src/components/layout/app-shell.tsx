import type { CSSProperties, PropsWithChildren } from "react";
import { BarChart3, FolderKanban, LayoutDashboard, LogOut, PanelsTopLeft, UserCircle2 } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { LogoMark } from "@client/components/ui/logo-mark";
import { generatedAssets } from "@client/lib/assets";
import { api } from "@client/lib/api";
import "./shell.css";

const globalNavigation = [
  { to: "/app", label: "工作台", icon: LayoutDashboard },
  { to: "/app", label: "我的项目", icon: FolderKanban },
  { to: "/#templates", label: "模板中心", icon: PanelsTopLeft },
  { to: "/app", label: "数据统计", icon: BarChart3 },
];

export function AppShell({ children }: PropsWithChildren) {
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
        <div><UserCircle2 /><span>个人账号</span><button type="button" onClick={() => void handleLogout()}><LogOut />退出登录</button></div>
      </header>
      <aside className="app-sidebar">
        <nav aria-label="工作台导航">
          {globalNavigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={label} to={to} end={label === "工作台"}><Icon />{label}</NavLink>
          ))}
        </nav>
      </aside>
      <main className="app-shell__content">{children}</main>
    </div>
  );
}
