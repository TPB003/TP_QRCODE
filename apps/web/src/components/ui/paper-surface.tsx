import type { CSSProperties, PropsWithChildren } from "react";
import { generatedAssets } from "@client/lib/assets";

interface PaperSurfaceProps extends PropsWithChildren {
  className?: string;
  clipped?: "none" | "top-right" | "both";
  style?: CSSProperties;
}

export function PaperSurface({ children, className = "", clipped = "none", style }: PaperSurfaceProps) {
  return (
    <div
      className={`paper-surface paper-surface--${clipped} ${className}`}
      style={{ "--paper-texture": `url(${generatedAssets.archivalPaperTexture})`, ...style } as CSSProperties}
    >
      {children}
    </div>
  );
}
