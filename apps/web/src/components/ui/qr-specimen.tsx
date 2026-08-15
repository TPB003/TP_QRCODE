import { useEffect, useRef } from "react";
import QRCodeStyling, { type CornerSquareType, type DotType } from "qr-code-styling";

interface QrSpecimenProps {
  background?: string;
  className?: string;
  color?: string;
  data: string;
  dotType?: DotType;
  finderType?: CornerSquareType;
  label?: string;
  logo?: boolean;
  size?: number;
}

export function QrSpecimen({
  background = "#f2efe8",
  className = "",
  color = "#080b0d",
  data,
  dotType = "square",
  finderType = "square",
  label = "动态二维码预览",
  logo = false,
  size = 180,
}: QrSpecimenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);

  useEffect(() => {
    const qrCode = new QRCodeStyling({
      type: "svg",
      width: size,
      height: size,
      margin: 8,
      data,
      qrOptions: { errorCorrectionLevel: logo ? "H" : "Q" },
      dotsOptions: { type: dotType, color },
      cornersSquareOptions: { type: finderType, color },
      cornersDotOptions: { type: dotType === "dots" ? "dot" : "square", color },
      backgroundOptions: { color: background },
    });

    qrRef.current = qrCode;
    const container = containerRef.current;
    if (container) {
      container.replaceChildren();
      qrCode.append(container);
    }

    return () => {
      qrRef.current = null;
      container?.replaceChildren();
    };
  }, [background, color, data, dotType, finderType, logo, size]);

  return (
    <div className={`qr-specimen ${className}`} role="img" aria-label={label}>
      <div ref={containerRef} className="qr-specimen__canvas" />
      {logo ? <span className="qr-specimen__logo" aria-hidden="true">TP</span> : null}
    </div>
  );
}
