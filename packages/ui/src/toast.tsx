import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Toast({ message, onDismiss, tone = "info" }: { message: ReactNode; onDismiss?: () => void; tone?: "info" | "success" | "error" }) {
  return <div className={`tp-toast tp-toast--${tone}`} role={tone === "error" ? "alert" : "status"}>
    <span>{message}</span>
    {onDismiss ? <button type="button" aria-label="关闭提示" onClick={onDismiss}><X size={16} /></button> : null}
  </div>;
}

