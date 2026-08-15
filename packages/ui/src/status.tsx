import type { HTMLAttributes } from "react";

type StatusTone = "blue" | "teal" | "red" | "muted";

export function Status({ tone = "blue", children, className = "", ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: StatusTone }) {
  return <span className={`tp-status tp-status--${tone} ${className}`.trim()} {...props}><i aria-hidden="true" />{children}</span>;
}

