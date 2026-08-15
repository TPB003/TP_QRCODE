import type { HTMLAttributes, PropsWithChildren } from "react";

export function Paper({ className = "", children, ...props }: PropsWithChildren<HTMLAttributes<HTMLElement>>) {
  return <section className={`tp-paper ${className}`.trim()} {...props}>{children}</section>;
}

