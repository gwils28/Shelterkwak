// Géométrie de la colonne : 8 tambours empilés, légère entasis (le fût s'affine vers le haut).

export interface DrumGeometry {
  n: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const COLUMN = {
  width: 240,
  drumHeight: 50,
  baseWidth: 132,
  topWidth: 112,
  plinthHeight: 26,
  capitalHeight: 44,
  levels: 8,
} as const;

export function drumGeometry(n: number): DrumGeometry {
  const { width, drumHeight, baseWidth, topWidth, plinthHeight, capitalHeight, levels } = COLUMN;
  const t = (n - 1) / (levels - 1);
  const w = baseWidth + (topWidth - baseWidth) * t;
  const totalHeight = capitalHeight + levels * drumHeight + plinthHeight;
  const y = totalHeight - plinthHeight - n * drumHeight;
  return { n, x: (width - w) / 2, y, width: w, height: drumHeight };
}

export function columnHeight(): number {
  return COLUMN.capitalHeight + COLUMN.levels * COLUMN.drumHeight + COLUMN.plinthHeight;
}

/** Zigzag de fissure, déterministe pour un tambour donné. */
export function crackPath(d: DrumGeometry): string {
  const steps = 6;
  const x0 = d.x + d.width * 0.62;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const y = d.y + (d.height * i) / steps;
    const x = x0 + (i % 2 === 0 ? -1 : 1) * (4 + ((d.n * 7 + i * 3) % 5));
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(" ");
}
