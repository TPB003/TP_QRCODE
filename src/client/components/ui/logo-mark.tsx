interface LogoMarkProps {
  compact?: boolean;
  inverted?: boolean;
}

export function LogoMark({ compact = false, inverted = false }: LogoMarkProps) {
  const color = inverted ? "#F2EFE8" : "#080B0D";

  return (
    <span className="logo-mark" aria-label="TP QR">
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <path d="M2 2h12v4H6v8H2V2Zm20 0h12v12h-4V6h-8V2ZM2 22h4v8h8v4H2V22Zm28 0h4v12H22v-4h8v-8Z" fill={color} />
        <path d="M10 10h16v16H10V10Zm4 4v8h8v-8h-8Z" fill="#2563EB" />
      </svg>
      {compact ? null : <strong style={{ color }}>TP QR</strong>}
    </span>
  );
}
