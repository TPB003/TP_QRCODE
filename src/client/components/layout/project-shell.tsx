import { useEffect, useState, type CSSProperties, type PropsWithChildren } from "react";
import { BarChart3, ClipboardList, FileText, Layers3, QrCode, Settings } from "lucide-react";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import { LogoMark } from "@client/components/ui/logo-mark";
import { generatedAssets } from "@client/lib/assets";
import { api } from "@client/lib/api";
import "./shell.css";

export function ProjectShell({ children }: PropsWithChildren) {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let active = true;
    void api.me().then(() => {
      if (active) setAuthChecked(true);
    }).catch(() => navigate("/login", { replace: true }));
    return () => { active = false; };
  }, [navigate]);

  if (!authChecked) return <div className="route-loading" role="status">正在检查登录状态…</div>;

  const projectNavigation = [
    { to: `/app/projects/${projectId}/qr`, label: "二维码编辑", icon: QrCode },
    { to: `/app/projects/${projectId}/form`, label: "内容与表单", icon: FileText },
    { to: `/app/projects/${projectId}/batch`, label: "批量二维码", icon: Layers3 },
    { to: `/app/projects/${projectId}/submissions`, label: "提交记录", icon: ClipboardList },
    { to: `/app/projects/${projectId}/submissions?tab=analytics`, label: "扫码统计", icon: BarChart3 },
    { to: `/app/projects/${projectId}/settings`, label: "项目设置", icon: Settings },
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
      </header>
      <aside className="project-sidebar">
        <nav aria-label="项目导航">
          {projectNavigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={label} to={to}><Icon />{label}</NavLink>
          ))}
        </nav>
      </aside>
      <main className="project-shell__content">{children}</main>
    </div>
  );
}
