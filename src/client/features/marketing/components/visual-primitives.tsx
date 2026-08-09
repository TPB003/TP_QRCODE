import type { PropsWithChildren, ReactNode } from "react";

export function CalibrationMark({ className = "" }: { className?: string }) {
  return <span className={`calibration-mark ${className}`} aria-hidden="true" />;
}

export function SectionIndex({ children }: PropsWithChildren) {
  return <span className="section-index">{children}</span>;
}

interface ArchiveCardProps extends PropsWithChildren {
  accent?: "blue" | "red" | "teal";
  className?: string;
  title: string;
  trailing?: ReactNode;
}

export function ArchiveCard({ accent = "blue", children, className = "", title, trailing }: ArchiveCardProps) {
  return (
    <article className={`archive-card archive-card--${accent} ${className}`}>
      <header className="archive-card__header">
        <strong>{title}</strong>
        {trailing}
      </header>
      {children}
    </article>
  );
}

export function StatusDot({ tone = "teal" }: { tone?: "blue" | "red" | "teal" }) {
  return <span className={`status-dot status-dot--${tone}`} aria-hidden="true" />;
}
