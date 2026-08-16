import { useEffect, useState } from "react";
import { ArrowRight, Code2, Mail } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogoMark } from "@client/components/ui/logo-mark";
import { api } from "@client/lib/api";

function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/login") ? value : "/app";
}

export function Component() {
  const [email, setEmail] = useState("");
  const [requested, setRequested] = useState(false);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState({ google: false, github: false });
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let active = true;
    void api.me().then(() => {
      if (active) void navigate(safeNext(new URLSearchParams(location.search).get("next")), { replace: true });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [location.search, navigate]);

  useEffect(() => {
    void api.authProviders().then(setProviders).catch(() => undefined);
  }, [location.search]);

  async function handleSubmit() {
    setBusy(true);
    setNotice("");
    try {
      if (!requested) {
        const result = await api.requestCode(email);
        setRequested(true);
        setNotice(result.testCode ? `本地测试验证码：${result.testCode}` : "验证码已发送，请查收邮箱。");
      } else {
        await api.verifyCode(email, code);
        void navigate(safeNext(new URLSearchParams(location.search).get("next")), { replace: true });
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "请求失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-page">
    <Link to="/"><LogoMark inverted /></Link>
    <section>
      <span>CREATOR ACCESS / LOGIN</span>
      <h1>登录 TPQRCODE</h1>
      <p>保存活码、发布内容，并查看匿名访问统计。</p>
      <div className="oauth-actions" aria-label="第三方登录">
        <button type="button" className="oauth-button" disabled={!providers.google || busy} onClick={() => api.oauthStart("google")}><span className="google-mark">G</span>使用 Google 登录</button>
        <button type="button" className="oauth-button" disabled={!providers.github || busy} onClick={() => api.oauthStart("github")}><Code2 size={18} />使用 GitHub 登录</button>
      </div>
      <div className="login-divider"><span>或使用邮箱验证码</span></div>
      <label><Mail />邮箱地址<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" /></label>
      {requested ? <label>验证码<input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" maxLength={6} placeholder="6 位验证码" autoComplete="one-time-code" /></label> : null}
      <button type="button" disabled={busy || !email} onClick={() => void handleSubmit()}>{busy ? "处理中…" : requested ? "验证并登录" : "发送验证码"}<ArrowRight /></button>
      {notice || new URLSearchParams(location.search).has("oauth_error") ? <small role="status">{notice || "第三方登录未完成，请重试或使用邮箱验证码。"}</small> : null}
      <small>验证码仅用于本次登录，10 分钟内有效。</small>
    </section>
  </main>;
}
