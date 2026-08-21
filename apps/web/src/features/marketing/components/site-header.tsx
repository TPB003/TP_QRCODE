import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { LogoMark } from "@client/components/ui/logo-mark";
import { api } from "@client/lib/api";

export function SiteHeader({ paper = false }: { paper?: boolean }) {
  const [open, setOpen] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  useEffect(() => {
    let active = true;
    void api.me().then((user) => {
      if (active) setAccountEmail(user.email);
    }).catch(() => {
      if (active) setAccountEmail(null);
    }).finally(() => {
      if (active) setAuthChecked(true);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  async function handleLogout() {
    await api.logout().catch(() => undefined);
    setAccountEmail(null);
    setOpen(false);
  }
  return (
    <header className={`site-header ${paper ? "site-header--paper" : ""} ${open ? "is-open" : ""}`}>
      <Link to="/" aria-label="返回 TP QR 首页">
        <LogoMark inverted={!paper} />
      </Link>
      <nav className="site-header__nav" aria-label="主导航">
        <a href="#product" onClick={() => setOpen(false)}>产品</a>
        <a href="#templates" onClick={() => setOpen(false)}>七类活码</a>
        <a href="#workflow" onClick={() => setOpen(false)}>工作方式</a>
        <Link className="site-header__decoder" to="/decoder" onClick={() => setOpen(false)}>解码器</Link>
        {authChecked && accountEmail ? <span className="site-header__account"><Link className="site-header__account-link" to="/app" onClick={() => setOpen(false)} title={accountEmail}>{accountEmail}</Link><button type="button" className="site-header__logout" onClick={() => void handleLogout()}>退出</button></span> : <Link className="site-header__login" to="/login" onClick={() => setOpen(false)}>登录</Link>}
      </nav>
      <button className="site-header__menu" type="button" aria-label={open ? "关闭导航菜单" : "打开导航菜单"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? <X size={24} /> : <Menu size={24} />}
      </button>
      {open ? <button className="site-header__backdrop" type="button" aria-label="关闭导航菜单" onClick={() => setOpen(false)} /> : null}
    </header>
  );
}
