import type { HTMLAttributes, PropsWithChildren } from "react";

export function Torn({ className = "", children, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return <div className={`tp-torn ${className}`.trim()} {...props}>{children}</div>;
}

