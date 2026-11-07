import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { animateMonument } from "../lib/animations";
import type { Tier } from "../model";
import { LevelInfoText } from "./LevelInfo";
import { CLASSIC, type Renderer } from "./monuments";
import { MORE } from "./monuments-more";
import { WORLD } from "./monuments-world";
import { MAX_LEVEL } from "../engine/types";
import { builtTone, GREY, HEIGHT, LAYOUT, type MonumentStyle, MONUMENTS, crackPath, tierBottom, tierTop } from "../lib/monument";

const RENDERERS: Record<MonumentStyle, Renderer> = { ...CLASSIC, ...WORLD, ...MORE };

interface Props {
  tiers: Tier[];
  level: number;
  goalLevel?: number | null;
  onSelect?: (n: number) => void;
  compact?: boolean;
  monument?: MonumentStyle;
  /** Décor et animations d'ambiance (page Monument). */
  animated?: boolean;
}

/** Monument de résilience : 9 paliers empilés. Acquis en couleur, en cours et à venir en gris. */
export function Column({ tiers, level, goalLevel, onSelect, compact, monument = "colonne", animated = false }: Props) {
  const r = RENDERERS[monument];
  const W = LAYOUT.width;
  const labelX = W + 8;
  const uid = `m${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const crownBuilt = level >= MAX_LEVEL;
  const [info, setInfo] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const infoTier = tiers.find((t) => t.n === info);
  const toggleInfo = (n: number) => setInfo((cur) => (cur === n ? null : n));
  const name = MONUMENTS.find((m) => m.id === monument)?.name ?? "Monument";
  const svgRef = useRef<SVGSVGElement>(null);
  const ambient = animated ? r.ambient?.(uid, level) : undefined;

  useLayoutEffect(() => {
    if (!animated || !svgRef.current) return;
    return animateMonument(svgRef.current, monument, level);
  }, [animated, monument, level]);

  useEffect(() => {
    if (info === null) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setInfo(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setInfo(null);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [info]);

  return (
    <div className="column-wrap" ref={wrap}>
      <svg
        ref={svgRef}
        className={`column-svg monument-${monument}${animated ? " animated" : ""}`}
        viewBox={`0 0 ${compact ? W : W + 170} ${HEIGHT}`}
        role="img"
        aria-label={`${name} : niveau ${level} sur ${MAX_LEVEL}`}
      >
        <defs>
          {r.defs?.(uid)}
          {tiers.map((t) => {
            const top = r.bandTop?.(t.n) ?? tierTop(t.n);
            return (
              <clipPath key={t.n} id={`${uid}-band-${t.n}`}>
                <rect x={-20} y={top} width={W + 40} height={tierBottom(t.n) - top} />
              </clipPath>
            );
          })}
        </defs>
        {r.base(uid)}
        {ambient?.back && <g className="ambient ambient-back">{ambient.back}</g>}

        {tiers.map((t) => {
          const built = t.state === "built";
          const tn = built ? builtTone(monument, t.n) : t.state === "current" ? GREY.current : GREY.future;
          const top = tierTop(t.n);
          const mid = top + LAYOUT.tier / 2;
          const isGoal = goalLevel === t.n;
          return (
            <g
              key={t.n}
              className={`drum ${t.state}${onSelect ? " clickable" : ""}`}
              data-n={t.n}
              onClick={onSelect ? () => onSelect(t.n) : undefined}
              role={onSelect ? "button" : undefined}
              aria-label={`Niveau ${t.n} ${t.name}`}
            >
              <title>
                {`Niveau ${t.n} · ${t.name} — ${t.required_done}/${t.required_total} objectifs requis`}
                {t.cracked ? " — des validations expirent bientôt" : ""}
              </title>
              <g className="tier-art" clipPath={`url(#${uid}-band-${t.n})`}>
                {r.tier(t.n, tn, built, uid)}
              </g>
              {t.cracked && <path className="crack" d={crackPath(t.n, r.crackX(t.n))} />}
              <text
                className="drum-number"
                x={LAYOUT.width / 2}
                y={mid + 5}
                textAnchor="middle"
                fill={r.numeralOnPanel ? (built ? "var(--ink)" : "var(--muted)") : tn.ink}
                fontSize={monument === "pyramide" && t.n >= 8 ? 11 : 15}
              >
                {romanNumeral(t.n)}
              </text>
              <rect className="tier-hit" x={0} y={top} width={W} height={LAYOUT.tier} />
              {!compact && (
                <g className="drum-label">
                  <g
                    className="drum-info"
                    role="button"
                    tabIndex={0}
                    aria-label={`Ce que représente le niveau ${t.name}`}
                    aria-expanded={info === t.n}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleInfo(t.n);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      e.stopPropagation();
                      toggleInfo(t.n);
                    }}
                  >
                    <circle cx={labelX + 7} cy={mid - 7} r={7} />
                    <text x={labelX + 7} y={mid - 3} textAnchor="middle">
                      i
                    </text>
                  </g>
                  {built && <circle className="built-dot" cx={labelX + 20} cy={mid - 6} r={4} fill={builtTone(monument, t.n).fill} />}
                  <text x={labelX + (built ? 28 : 20)} y={mid - 2}>
                    {t.name}
                    {isGoal ? "  ◎" : ""}
                  </text>
                  <text className="sub" x={labelX + 20} y={mid + 14}>
                    {built
                      ? t.cracked
                        ? "acquis · fissuré"
                        : "acquis"
                      : t.required_total === 0
                        ? "rien d'applicable"
                        : `${t.required_done}/${t.required_total} · ${Math.round(t.progress * 100)} %`}
                  </text>
                  {t.state === "current" && t.required_total > 0 && (
                    <g className="tier-progress">
                      <rect x={labelX + 20} y={mid + 19} width={120} height={4} rx={2} />
                      <rect className="done" x={labelX + 20} y={mid + 19} width={120 * t.progress} height={4} rx={2} />
                    </g>
                  )}
                </g>
              )}
            </g>
          );
        })}

        {r.crown(crownBuilt, uid, GREY.future)}
        {ambient?.front && <g className="ambient ambient-front">{ambient.front}</g>}
      </svg>
      {infoTier && (
        <div className="level-info-pop column-info-pop" role="note" style={{ top: `${(tierBottom(infoTier.n) / HEIGHT) * 100}%` }}>
          <LevelInfoText level={infoTier} />
        </div>
      )}
    </div>
  );
}

export function romanNumeral(n: number): string {
  return ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"][n] ?? String(n);
}
