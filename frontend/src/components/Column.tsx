import type { Tier } from "../model";
import { COLUMN, columnHeight, crackPath, drumGeometry } from "../lib/column";

interface Props {
  tiers: Tier[];
  level: number;
  goalLevel?: number | null;
  onSelect?: (n: number) => void;
  compact?: boolean;
}

/** Colonne romaine : socle, 8 tambours (bâtis, en chantier, à venir), chapiteau doré au niveau 8. */
export function Column({ tiers, level, goalLevel, onSelect, compact }: Props) {
  const H = columnHeight();
  const W = COLUMN.width;
  const labelX = W + 8;
  const top = drumGeometry(8);
  const bottom = drumGeometry(1);
  const capitalBuilt = level >= 8;

  return (
    <svg
      className="column-svg"
      viewBox={`0 0 ${compact ? W : W + 170} ${H}`}
      role="img"
      aria-label={`Colonne de résilience : niveau ${level} sur 8`}
    >
      <defs>
        <linearGradient id="stone" x1="0" x2="1">
          <stop offset="0" stopColor="var(--stone-dark)" />
          <stop offset="0.35" stopColor="var(--stone-light)" />
          <stop offset="0.7" stopColor="var(--stone)" />
          <stop offset="1" stopColor="var(--stone-dark)" />
        </linearGradient>
        <linearGradient id="gold" x1="0" x2="1">
          <stop offset="0" stopColor="var(--gold-dark)" />
          <stop offset="0.45" stopColor="var(--gold-light)" />
          <stop offset="1" stopColor="var(--gold-dark)" />
        </linearGradient>
      </defs>

      {/* Chapiteau */}
      <g className={capitalBuilt ? "capital built" : "capital"}>
        <rect x={top.x - 18} y={6} width={top.width + 36} height={12} rx={3} fill={capitalBuilt ? "url(#gold)" : "none"} />
        <path
          d={`M${top.x - 6},${COLUMN.capitalHeight} L${top.x + top.width + 6},${COLUMN.capitalHeight} L${top.x + top.width + 14},18 L${top.x - 14},18 Z`}
          fill={capitalBuilt ? "url(#gold)" : "none"}
        />
        <circle cx={top.x - 10} cy={28} r={9} fill={capitalBuilt ? "url(#gold)" : "none"} />
        <circle cx={top.x + top.width + 10} cy={28} r={9} fill={capitalBuilt ? "url(#gold)" : "none"} />
      </g>

      {tiers.map((t) => {
        const d = drumGeometry(t.n);
        const fillH = t.state === "built" ? d.height : t.state === "current" ? d.height * t.progress : 0;
        const clipId = `clip-${t.n}`;
        const isGoal = goalLevel === t.n;
        return (
          <g
            key={t.n}
            className={`drum ${t.state}${onSelect ? " clickable" : ""}`}
            onClick={onSelect ? () => onSelect(t.n) : undefined}
            role={onSelect ? "button" : undefined}
            aria-label={`Niveau ${t.n} ${t.name}`}
          >
            <title>
              {`Niveau ${t.n} · ${t.name} — ${t.required_done}/${t.required_total} objectifs requis`}
              {t.cracked ? " — des validations expirent bientôt" : ""}
            </title>
            <clipPath id={clipId}>
              <rect x={d.x} y={d.y + d.height - fillH} width={d.width} height={fillH} />
            </clipPath>
            <rect className="drum-outline" x={d.x} y={d.y + 1} width={d.width} height={d.height - 2} rx={3} />
            <rect
              className="drum-fill"
              x={d.x}
              y={d.y + 1}
              width={d.width}
              height={d.height - 2}
              rx={3}
              clipPath={`url(#${clipId})`}
              fill="url(#stone)"
            />
            {/* Cannelures */}
            {[0.2, 0.35, 0.5, 0.65, 0.8].map((f) => (
              <line key={f} className="flute" x1={d.x + d.width * f} x2={d.x + d.width * f} y1={d.y + 5} y2={d.y + d.height - 5} />
            ))}
            {t.cracked && <path className="crack" d={crackPath(d)} />}
            <text className="drum-number" x={d.x + d.width / 2} y={d.y + d.height / 2 + 6} textAnchor="middle">
              {romanNumeral(t.n)}
            </text>
            {!compact && (
              <g className="drum-label">
                <text x={labelX} y={d.y + d.height / 2 - 2}>
                  {t.name}
                  {isGoal ? "  ◎" : ""}
                </text>
                <text className="sub" x={labelX} y={d.y + d.height / 2 + 14}>
                  {t.state === "built"
                    ? t.cracked
                      ? "bâti · fissuré"
                      : "bâti"
                    : t.required_total === 0
                      ? "rien d'applicable"
                      : `${t.required_done}/${t.required_total} · ${Math.round(t.progress * 100)} %`}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Socle */}
      <rect className="plinth" x={bottom.x - 22} y={bottom.y + bottom.height + 2} width={bottom.width + 44} height={COLUMN.plinthHeight - 4} rx={2} fill="url(#stone)" />
    </svg>
  );
}

export function romanNumeral(n: number): string {
  return ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"][n] ?? String(n);
}
