import { useState } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { LogoMark } from "@client/components/ui/logo-mark";
import { api } from "@client/lib/api";

export function Component() {
  const [email, setEmail] = useState("");
  const [requested, setRequested] = useState(false);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit() {
    setBusy(true);
    setNotice("");
    try {
      if (!requested) {
        const result = await api.requestCode(email);
        setRequested(true);
        setNotice(result.testCode ? `本地测试验证码：${result.testCode}` : "验证码已发送，请查收邮箱");
      } else {
        await api.verifyCode(email, code);
        void navigate("/app");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "请求失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-page"><Link to="/"><LogoMark inverted /></Link><section><span>CREATOR ACCESS / OTP</span><h1>邮箱验证码登录</h1><p>登录后保存项目、发布更新并管理提交数据。</p><label><Mail />邮箱地址<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></label>{requested ? <label>验证码<input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" maxLength={6} placeholder="6 位验证码" /></label> : null}<button type="button" disabled={busy || !email} onClick={() => void handleSubmit()}>{busy ? "处理中…" : requested ? "验证并登录" : "发送验证码"}<ArrowRight /></button>{notice ? <small role="status">{notice}</small> : null}<small>验证码仅用于本次登录，10 分钟内有效。</small></section></main>;
}
