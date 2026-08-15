import { Menu } from "lucide-react";
import { Link } from "react-router-dom";
import { LogoMark } from "@client/components/ui/logo-mark";

export function SiteHeader({ paper = false }: { paper?: boolean }) {
  return (
    <header className={`site-header ${paper ? "site-header--paper" : ""}`}>
      <Link to="/" aria-label="返回 TP QR 首页">
        <LogoMark inverted={!paper} />
      </Link>
      <nav className="site-header__nav" aria-label="主导航">
        <a href="#product">产品</a>
        <a href="#templates">模板</a>
        <a href="#workflow">工作方式</a>
        <Link className="site-header__login" to="/login">登录</Link>
      </nav>
      <button className="site-header__menu" type="button" aria-label="打开导航菜单">
        <Menu size={24} />
      </button>
    </header>
  );
}
