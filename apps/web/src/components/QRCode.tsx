"use client";

/**
 * Simple QR Code renderer using SVG.
 * Generates a QR-like visual from data using a deterministic bit matrix.
 * For production, replace with a proper QR encoding library (e.g., qrcode).
 */

interface QRCodeProps {
  data: string;
  size?: number;
  className?: string;
}

function generateQRMatrix(data: string, modules: number = 25): boolean[][] {
  // Simple hash-based matrix generation for visual representation
  // In production, use proper QR encoding (ISO/IEC 18004)
  const matrix: boolean[][] = Array.from({ length: modules }, () =>
    Array(modules).fill(false)
  );

  // Finder patterns (top-left, top-right, bottom-left)
  const drawFinder = (startR: number, startC: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isOuter = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        matrix[startR + r][startC + c] = isOuter || isInner;
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, modules - 7);
  drawFinder(modules - 7, 0);

  // Timing patterns
  for (let i = 8; i < modules - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Data area - fill with hash of input data
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
  }

  // Fill data modules based on the hash and data characters
  for (let r = 8; r < modules - 8; r++) {
    for (let c = 8; c < modules - 8; c++) {
      if (c === 6 || r === 6) continue;
      const idx = (r * modules + c) % data.length;
      const charVal = data.charCodeAt(idx);
      const seed = (hash ^ (charVal * (r + 1) * (c + 1))) & 0xffffffff;
      matrix[r][c] = (seed % 3) === 0;
    }
  }

  return matrix;
}

export function QRCode({ data, size = 120, className = "" }: QRCodeProps) {
  const modules = 25;
  const matrix = generateQRMatrix(data, modules);
  const cellSize = size / modules;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label="QR Code"
    >
      <rect width={size} height={size} fill="white" />
      {matrix.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize}
              height={cellSize}
              fill="black"
            />
          ) : null
        )
      )}
    </svg>
  );
}

export default QRCode;
