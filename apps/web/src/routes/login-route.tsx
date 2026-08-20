import { useEffect, useState } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogoMark } from "@client/components/ui/logo-mark";
import { api } from "@client/lib/api";

function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/login") ? value : "/app";
}

function GithubMark() {
  return <svg aria-hidden="true" className="github-mark" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M12 .297a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.04c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.74.08-.74 1.2.09 1.83 1.24 1.83 1.24 1.07 1.83 2.8 1.3 3.48.99.11-.77.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.94 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.61-2.8 5.63-5.48 5.93.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .297" />
  </svg>;
}

export function Component() {
  // Google OAuth remains implemented in the Worker/API; the UI is temporarily hidden in base.css.
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
        <button type="button" className="oauth-button" disabled={!providers.github || busy} onClick={() => api.oauthStart("github")}><GithubMark />使用 GitHub 登录</button>
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
