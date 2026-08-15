import type { HTMLAttributes } from "react";

export function Calibration({ className = "", ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span aria-hidden="true" className={`tp-calibration ${className}`.trim()} {...props} />;
}

