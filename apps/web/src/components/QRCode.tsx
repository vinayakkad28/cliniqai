"use client";

import { useEffect, useRef } from "react";
import * as QRCodeLib from "qrcode";

interface QRCodeProps {
  data: string;
  size?: number;
  className?: string;
}

/**
 * Renders a scannable QR code as an SVG using the `qrcode` library.
 * Accepts `data` (the string to encode) and optional `size` / `className` props.
 */
export function QRCode({ data, size = 120, className = "" }: QRCodeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    QRCodeLib.toString(data, {
      type: "svg",
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((svgString) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = svgString;
          // Apply size attributes to the generated SVG element
          const svg = containerRef.current.querySelector("svg");
          if (svg) {
            svg.setAttribute("width", String(size));
            svg.setAttribute("height", String(size));
            svg.setAttribute("role", "img");
            svg.setAttribute("aria-label", "QR Code");
          }
        }
      })
      .catch((err) => {
        console.error("QR code generation failed:", err);
      });
  }, [data, size]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: size, height: size, lineHeight: 0 }}
    />
  );
}

export default QRCode;
