// Dessin des quatre monuments. Chaque palier n est une bande horizontale (tierTop(n) → tierBottom(n)) ;
// le composant Column s'occupe des états, des libellés et des clics, ces renderers seulement du dessin.

import type { ReactNode } from "react";
import { CX, GROUND, HEIGHT, LAYOUT, seeded, type Tone, tierBottom, tierTop, tone } from "../lib/monument";

export interface Renderer {
  /** Dessin du palier n avec ses couleurs (acquis : couleur, sinon gris). */
  tier: (n: number, t: Tone, built: boolean, uid: string) => ReactNode;
  /** Couronnement, doré une fois le dernier palier acquis. */
  crown: (built: boolean, uid: string, grey: Tone) => ReactNode;
  /** Socle ou sol, toujours en couleur. */
  base: (uid: string) => ReactNode;
  /** Définitions communes (formes de découpe). */
  defs?: (uid: string) => ReactNode;
  crackX: (n: number) => number;
  /** Haut de la bande du palier n (le feuillage du dernier palier de l'arbre monte jusqu'en haut). */
  bandTop?: (n: number) => number;
  /** Le chiffre romain se lit sur le fond de la carte (monument ajouré) plutôt que sur la pierre. */
  numeralOnPanel?: boolean;
  /** Décor animé (page Monument seulement) : derrière le monument et devant lui. */
  ambient?: (uid: string, level: number) => { back?: ReactNode; front?: ReactNode };
}

const GOLD = tone("#d4a531");

/** Oiseau stylisé ; son vol est animé par GSAP autour de (x, y). */
export function Bird({ x, y, scale = 1, color = "#3b3f46" }: { x: number; y: number; scale?: number; color?: string }) {
  return (
    <g className="anim-bird" transform={`translate(${x},${y})`}>
      <path className="anim-wing" d={`M${-6 * scale},0 q${3 * scale},${-4 * scale} ${6 * scale},0 q${3 * scale},${-4 * scale} ${6 * scale},0`} fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </g>
  );
}

/** Petit nuage qui dérive. */
export function Cloud({ x, y, s = 1, fill = "#ffffff", opacity = 0.8 }: { x: number; y: number; s?: number; fill?: string; opacity?: number }) {
  return (
    <g className="anim-cloud" opacity={opacity}>
      <ellipse cx={x} cy={y} rx={22 * s} ry={8 * s} fill={fill} />
      <circle cx={x - 8 * s} cy={y - 5 * s} r={8 * s} fill={fill} />
      <circle cx={x + 6 * s} cy={y - 7 * s} r={10 * s} fill={fill} />
    </g>
  );
}

/** Étoile à quatre branches (éclat, scintillement). */
export function Sparkle({ x, y, size, className, fill = "#fff8d6" }: { x: number; y: number; size: number; className?: string; fill?: string }) {
  const k = size * 0.26;
  return (
    <path
      className={className}
      d={`M${x},${y - size} L${x + k},${y - k} L${x + size},${y} L${x + k},${y + k} L${x},${y + size} L${x - k},${y + k} L${x - size},${y} L${x - k},${y - k} Z`}
      fill={fill}
      opacity={className ? 0 : 1}
    />
  );
}

/** Dégradé horizontal qui donne du volume : ombre, reflet, teinte, ombre. */
export function Shade({ id, t }: { id: string; t: Tone }) {
  return (
    <linearGradient id={id} x1="0" x2="1">
      <stop offset="0" stopColor={t.dark} />
      <stop offset="0.3" stopColor={t.light} />
      <stop offset="0.65" stopColor={t.fill} />
      <stop offset="1" stopColor={t.dark} />
    </linearGradient>
  );
}

// ---------- Colonne romaine ----------

const colW = (n: number) => 150 - ((n - 1) / (LAYOUT.levels - 1)) * 28;

function mote(i: number) {
  const r = seeded(300 + i);
  return { x: 50 + r() * 160, y: 180 + r() * 300, r: 0.8 + r() * 1.4 };
}

const colonne: Renderer = {
  crackX: () => CX + 18,
  ambient: (uid, level) => ({
    front: (
      <>
        <defs>
          <clipPath id={`${uid}-shaft`}>
            {Array.from({ length: LAYOUT.levels }, (_, i) => {
              const n = i + 1;
              return <rect key={n} x={CX - colW(n) / 2} y={tierTop(n) + 4} width={colW(n)} height={LAYOUT.tier - 6} />;
            })}
          </clipPath>
          <linearGradient id={`${uid}-sheen`} x1="0" x2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity={0} />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity={0.55} />
            <stop offset="1" stopColor="#ffffff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <g clipPath={`url(#${uid}-shaft)`}>
          <rect className="anim-sheen" x={CX - 20} y={LAYOUT.crown} width={40} height={GROUND - LAYOUT.crown} fill={`url(#${uid}-sheen)`} transform={`skewX(-12)`} />
        </g>
        {Array.from({ length: 10 }, (_, i) => {
          const m = mote(i);
          return <circle key={i} className="anim-mote" cx={m.x} cy={m.y} r={m.r} fill="#fff6d8" opacity={0} />;
        })}
        {level >= LAYOUT.levels && <Sparkle className="anim-glint" x={CX + 52} y={14} size={9} />}
      </>
    ),
  }),
  tier: (n, t, _built, uid) => {
    const w = colW(n);
    const x = CX - w / 2;
    const y = tierTop(n) + 4;
    const h = LAYOUT.tier - 6;
    const id = `${uid}-shade-${n}`;
    return (
      <>
        <defs>
          <Shade id={id} t={t} />
        </defs>
        <rect x={x} y={y} width={w} height={h} rx={2} fill={`url(#${id})`} stroke={t.dark} strokeWidth={0.8} />
        {Array.from({ length: 8 }, (_, i) => {
          const fx = x + (w * (i + 0.5)) / 8;
          return (
            <g key={i}>
              <rect x={fx - w * 0.022} y={y + 8} width={w * 0.044} height={h - 12} rx={w * 0.022} fill={t.dark} opacity={0.3} />
              <line x1={fx + w * 0.03} x2={fx + w * 0.03} y1={y + 9} y2={y + h - 5} stroke={t.light} strokeWidth={1} opacity={0.7} />
            </g>
          );
        })}
        {/* astragale : l'anneau qui marque le joint entre deux tambours */}
        <rect x={x - 3} y={y - 3} width={w + 6} height={5} rx={2.5} fill={t.light} stroke={t.dark} strokeWidth={0.6} />
      </>
    );
  },
  crown: (built, uid, grey) => {
    const t = built ? GOLD : grey;
    const w = colW(LAYOUT.levels);
    const id = `${uid}-crown`;
    const volute = (cx: number) => (
      <g>
        <circle cx={cx} cy={34} r={11} fill={`url(#${id})`} stroke={t.dark} strokeWidth={0.8} />
        <path
          d={`M${cx},34 m-6,0 a6,6 0 1,0 12,0 a4.5,4.5 0 1,0 -9,0 a3,3 0 1,0 6,0`}
          fill="none"
          stroke={t.dark}
          strokeWidth={1}
        />
      </g>
    );
    return (
      <g className={built ? "crown built" : "crown"}>
        <defs>
          <Shade id={id} t={t} />
        </defs>
        {/* abaque */}
        <rect x={CX - w / 2 - 30} y={10} width={w + 60} height={10} rx={1.5} fill={`url(#${id})`} stroke={t.dark} strokeWidth={0.8} />
        {/* échine ornée d'oves */}
        <path
          d={`M${CX - w / 2 - 20},22 L${CX + w / 2 + 20},22 Q${CX + w / 2 + 6},44 ${CX + w / 2 + 2},54 L${CX - w / 2 - 2},54 Q${CX - w / 2 - 6},44 ${CX - w / 2 - 20},22 Z`}
          fill={`url(#${id})`}
          stroke={t.dark}
          strokeWidth={0.8}
        />
        {Array.from({ length: 9 }, (_, i) => (
          <ellipse key={i} cx={CX - w / 2 + 2 + ((w - 4) * (i + 0.5)) / 9} cy={31} rx={5} ry={6} fill={t.dark} opacity={0.35} />
        ))}
        {volute(CX - w / 2 - 17)}
        {volute(CX + w / 2 + 17)}
        <rect x={CX - w / 2 - 2} y={54} width={w + 4} height={6} rx={2} fill={t.light} stroke={t.dark} strokeWidth={0.6} />
      </g>
    );
  },
  base: (uid) => {
    const t = tone("#d9cfba");
    const w = colW(1);
    const id = `${uid}-base`;
    return (
      <g>
        <defs>
          <Shade id={id} t={t} />
        </defs>
        <rect x={CX - w / 2 - 8} y={GROUND} width={w + 16} height={8} rx={4} fill={`url(#${id})`} stroke={t.dark} strokeWidth={0.7} />
        <rect x={CX - w / 2 - 22} y={GROUND + 8} width={w + 44} height={12} rx={1.5} fill={`url(#${id})`} stroke={t.dark} strokeWidth={0.7} />
        <rect x={CX - w / 2 - 44} y={GROUND + 20} width={w + 88} height={13} rx={1.5} fill={`url(#${id})`} stroke={t.dark} strokeWidth={0.7} />
      </g>
    );
  },
};

// ---------- Pyramide d'Égypte ----------

const APEX = 6;
const pyrHalf = (y: number) => (126 * (y - APEX)) / (GROUND - APEX);
const SPLIT = CX + 30; // arête vue légèrement de côté : deux faces, l'une au soleil, l'autre à l'ombre

const pyramide: Renderer = {
  crackX: () => CX + 5,
  ambient: () => ({
    front: (
      <>
        {[6, 13, 20, 26, 31].map((dy, i) => (
          <line key={dy} className="anim-sand" x1={0} x2={18 + (i % 3) * 8} y1={GROUND + dy} y2={GROUND + dy} stroke="#fff4d6" strokeWidth={1.2} strokeLinecap="round" opacity={0} />
        ))}
        <Sparkle className="anim-glint" x={CX} y={APEX + 6} size={10} />
      </>
    ),
  }),
  defs: (uid) => (
    <clipPath id={`${uid}-pyr`}>
      <path d={`M${CX},${APEX} L4,${GROUND} L256,${GROUND} Z`} />
    </clipPath>
  ),
  tier: (n, t, _built, uid) => {
    const top = tierTop(n);
    const course = LAYOUT.tier / 4;
    const lines: ReactNode[] = [];
    for (let k = 0; k < 4; k++) {
      const y = top + k * course;
      const offset = ((k + n * 4) % 2) * 9;
      lines.push(<line key={`c${k}`} x1={0} x2={LAYOUT.width} y1={y} y2={y} stroke={t.dark} strokeWidth={k === 0 ? 1.4 : 0.8} opacity={k === 0 ? 0.9 : 0.5} />);
      for (let x = offset; x < LAYOUT.width; x += 18) {
        lines.push(<line key={`j${k}-${x}`} x1={x} x2={x} y1={y} y2={y + course} stroke={t.dark} strokeWidth={0.7} opacity={0.35} />);
      }
    }
    return (
      <g clipPath={`url(#${uid}-pyr)`}>
        <path d={`M${CX},${APEX} L4,${GROUND} L${SPLIT},${GROUND} Z`} fill={t.fill} />
        <path d={`M${CX},${APEX} L${SPLIT},${GROUND} L256,${GROUND} Z`} fill={t.dark} />
        <path d={`M${CX},${APEX} L4,${GROUND} L${(4 + SPLIT) / 2},${GROUND} Z`} fill={t.light} opacity={0.35} />
        {lines}
        <line x1={CX} y1={APEX} x2={SPLIT} y2={GROUND} stroke={t.light} strokeWidth={1} opacity={0.6} />
      </g>
    );
  },
  crown: (built, _uid, grey) => {
    const t = built ? GOLD : grey;
    const h = pyrHalf(LAYOUT.crown);
    const split = CX + (SPLIT - CX) * ((LAYOUT.crown - APEX) / (GROUND - APEX));
    return (
      <g className={built ? "crown built" : "crown"}>
        {built && (
          <g>
            <circle className="anim-sun" cx={212} cy={36} r={30} fill={GOLD.light} opacity={0.25} />
            <circle cx={212} cy={36} r={17} fill={GOLD.light} />
          </g>
        )}
        <path d={`M${CX},${APEX} L${CX - h},${LAYOUT.crown} L${split},${LAYOUT.crown} Z`} fill={t.light} stroke={t.dark} strokeWidth={0.6} />
        <path d={`M${CX},${APEX} L${split},${LAYOUT.crown} L${CX + h},${LAYOUT.crown} Z`} fill={t.fill} stroke={t.dark} strokeWidth={0.6} />
      </g>
    );
  },
  base: () => {
    const sand = tone("#e2c58c");
    return (
      <g>
        <path
          d={`M0,${GROUND - 2} Q60,${GROUND - 9} 130,${GROUND - 1} T260,${GROUND - 3} L260,${HEIGHT} L0,${HEIGHT} Z`}
          fill={sand.fill}
        />
        <path d={`M0,${GROUND + 14} Q80,${GROUND + 6} 150,${GROUND + 16} T260,${GROUND + 12} L260,${HEIGHT} L0,${HEIGHT} Z`} fill={sand.dark} opacity={0.35} />
      </g>
    );
  },
};

// ---------- Arbre ----------

const CANOPY: [number, number, number][] = [
  [130, 300, 58],
  [72, 288, 40],
  [188, 288, 40],
  [130, 225, 76],
  [58, 220, 48],
  [202, 220, 48],
  [130, 165, 72],
  [88, 140, 56],
  [172, 140, 56],
  [130, 84, 62],
];
const inCanopy = (x: number, y: number, margin = 0) => CANOPY.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= (r - margin) ** 2);

const SPECKS = (() => {
  const rnd = seeded(42);
  const out: { x: number; y: number; r: number; light: boolean }[] = [];
  while (out.length < 140) {
    const x = 10 + rnd() * 240;
    const y = 20 + rnd() * 340;
    if (inCanopy(x, y, 5)) out.push({ x, y, r: 3 + rnd() * 5, light: rnd() < 0.55 });
  }
  return out;
})();
const FRUITS = (() => {
  const rnd = seeded(7);
  const out: { x: number; y: number }[] = [];
  while (out.length < 26) {
    const x = 20 + rnd() * 220;
    const y = 30 + rnd() * 320;
    if (inCanopy(x, y, 9)) out.push({ x, y });
  }
  return out;
})();

const TRUNK = `M${CX - 40},${GROUND} C${CX - 20},${GROUND - 8} ${CX - 18},${GROUND - 40} ${CX - 16},400 L${CX - 11},240 L${CX + 11},240 L${CX + 16},400 C${CX + 18},${GROUND - 40} ${CX + 20},${GROUND - 8} ${CX + 40},${GROUND} Z`;
const BRANCHES = [
  `M${CX - 8},398 C${CX - 30},380 ${CX - 50},360 ${CX - 64},318`,
  `M${CX + 8},392 C${CX + 30},372 ${CX + 52},356 ${CX + 66},316`,
  `M${CX - 4},350 C${CX - 18},320 ${CX - 30},300 ${CX - 36},270`,
];
const BARK_TONE = tone("#7d5633");

const arbre: Renderer = {
  crackX: () => CX + 6,
  ambient: (_uid, level) => ({
    front: (
      <>
        {[
          [66, 318],
          [196, 300],
          [118, 348],
        ].map(([x, y], i) => (
          <path
            key={i}
            className="anim-leaf"
            data-fall={GROUND + 6 - y}
            d={`M${x},${y} q5,-6 10,0 q-5,6 -10,0 Z`}
            fill={level >= 4 ? ["#7cb342", "#c9a227", "#d0742c"][i] : "#b9b5ad"}
            opacity={0}
          />
        ))}
      </>
    ),
  }),
  bandTop: (n) => (n === LAYOUT.levels ? 0 : tierTop(n)),
  tier: (n, t, built, uid) => {
    const bark = n <= 3 ? t : built ? BARK_TONE : t;
    const leaf = t;
    const grad = `${uid}-leaf-${n}`;
    return (
      <g>
        <defs>
          <radialGradient id={grad} cx="0.35" cy="0.3" r="0.9">
            <stop offset="0" stopColor={leaf.light} />
            <stop offset="0.55" stopColor={leaf.fill} />
            <stop offset="1" stopColor={leaf.dark} />
          </radialGradient>
        </defs>
        <path d={TRUNK} fill={bark.fill} stroke={bark.dark} strokeWidth={1} />
        {[-9, -2, 6].map((dx) => (
          <path key={dx} d={`M${CX + dx},${GROUND - 4} C${CX + dx + 3},450 ${CX + dx - 3},420 ${CX + dx * 0.6},360`} fill="none" stroke={bark.dark} strokeWidth={1.2} opacity={0.6} />
        ))}
        {BRANCHES.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={bark.fill} strokeWidth={i === 2 ? 7 : 10} strokeLinecap="round" />
        ))}
        {n >= 3 && (
          <g className="anim-sway">
            {CANOPY.map(([cx, cy, r], i) => (
              <circle key={`o${i}`} cx={cx} cy={cy} r={r + 1.5} fill={leaf.dark} />
            ))}
            {CANOPY.map(([cx, cy, r], i) => (
              <circle key={`f${i}`} cx={cx} cy={cy} r={r} fill={`url(#${grad})`} />
            ))}
            {SPECKS.map((s, i) => (
              <circle key={`s${i}`} cx={s.x} cy={s.y} r={s.r} fill={s.light ? leaf.light : leaf.dark} opacity={s.light ? 0.4 : 0.3} />
            ))}
            {built && n >= 6 && FRUITS.map((f, i) => <circle key={`r${i}`} cx={f.x} cy={f.y} r={4} fill={n === LAYOUT.levels ? "#e0a526" : "#c8452f"} stroke="#7a2418" strokeWidth={0.6} />)}
          </g>
        )}
      </g>
    );
  },
  crown: (built) =>
    built ? (
      <g className="crown built">
        <circle cx={CX} cy={30} r={26} fill={GOLD.light} opacity={0.35} />
        <path d={`M${CX},12 l5,11 12,1 -9,8 3,12 -11,-6 -11,6 3,-12 -9,-8 12,-1 Z`} fill={GOLD.fill} stroke={GOLD.dark} strokeWidth={0.8} />
      </g>
    ) : null,
  base: () => (
    <g>
      {[
        `M${CX - 30},${GROUND} C${CX - 50},${GROUND + 10} ${CX - 80},${GROUND + 12} ${CX - 104},${GROUND + 26}`,
        `M${CX - 14},${GROUND} C${CX - 22},${GROUND + 14} ${CX - 34},${GROUND + 22} ${CX - 44},${HEIGHT - 2}`,
        `M${CX + 14},${GROUND} C${CX + 24},${GROUND + 14} ${CX + 36},${GROUND + 20} ${CX + 50},${HEIGHT - 2}`,
        `M${CX + 30},${GROUND} C${CX + 52},${GROUND + 8} ${CX + 82},${GROUND + 14} ${CX + 108},${GROUND + 24}`,
      ].map((d, i) => (
        <path key={`root${i}`} d={d} fill="none" stroke="#5e3f26" strokeWidth={5 - (i % 2)} strokeLinecap="round" opacity={0.55} />
      ))}
      <path d={`M0,${GROUND} Q${CX},${GROUND - 10} 260,${GROUND} L260,${GROUND + 5} Q${CX},${GROUND - 4} 0,${GROUND + 5} Z`} fill="#6f9a44" />
    </g>
  ),
};

// ---------- Pyramide aztèque ----------

const aztW = (n: number) => 238 - (n - 1) * 17;

const azteque: Renderer = {
  crackX: () => CX + 34,
  ambient: (_uid, level) => ({
    back: (
      <g className="anim-rays" opacity={level >= LAYOUT.levels ? 0.28 : 0.12}>
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2;
          return <line key={i} x1={CX} y1={30} x2={CX + Math.cos(a) * 170} y2={30 + Math.sin(a) * 170} stroke="#e0a526" strokeWidth={6} />;
        })}
      </g>
    ),
    front: (
      <>
        {[0, 1, 2, 3].map((i) => (
          <circle key={i} className="anim-smoke" cx={CX + (i % 2 ? 4 : -4)} cy={4} r={6} fill="#d9d4cc" opacity={0} />
        ))}
      </>
    ),
  }),
  tier: (n, t, _built, uid) => {
    const w = aztW(n);
    const top = tierTop(n);
    const bottom = tierBottom(n);
    const x = CX - w / 2;
    const id = `${uid}-shade-${n}`;
    const tab = { x: x + 6, y: top + 2, w: w - 12, h: 26 };
    const frets: ReactNode[] = [];
    for (let fx = tab.x + 9, i = 0; fx < tab.x + tab.w - 12; fx += 12, i++) {
      if (Math.abs(fx + 3 - CX) < 24) continue;
      frets.push(<rect key={i} x={fx} y={tab.y + (i % 2 ? 7 : 13)} width={6} height={6} fill={t.light} opacity={0.85} />);
    }
    return (
      <>
        <defs>
          <Shade id={id} t={t} />
        </defs>
        {/* talus incliné puis tablero orné (style talud-tablero) */}
        <path d={`M${x},${bottom} L${x + w},${bottom} L${x + w - 7},${bottom - 21} L${x + 7},${bottom - 21} Z`} fill={`url(#${id})`} stroke={t.dark} strokeWidth={0.8} />
        <rect x={tab.x} y={tab.y} width={tab.w} height={tab.h} fill={t.fill} stroke={t.dark} strokeWidth={0.8} />
        <rect x={tab.x + 3} y={tab.y + 3} width={tab.w - 6} height={tab.h - 6} fill="none" stroke={t.light} strokeWidth={1.2} />
        {frets}
        {/* escalier central et rampes */}
        <rect x={CX - 17} y={top} width={34} height={LAYOUT.tier} fill={t.light} />
        {Array.from({ length: 10 }, (_, i) => (
          <line key={i} x1={CX - 17} x2={CX + 17} y1={top + 5 * i} y2={top + 5 * i} stroke={t.dark} strokeWidth={0.8} opacity={0.45} />
        ))}
        <rect x={CX - 22} y={top} width={5} height={LAYOUT.tier} fill={t.dark} />
        <rect x={CX + 17} y={top} width={5} height={LAYOUT.tier} fill={t.dark} />
      </>
    );
  },
  crown: (built, _uid, grey) => {
    const body = built ? tone("#b5452f") : grey;
    const roof = built ? tone("#2a8c9d") : grey;
    const crest = built ? GOLD : grey;
    return (
      <g className={built ? "crown built" : "crown"}>
        <rect x={CX - 46} y={50} width={92} height={10} fill={body.light} stroke={body.dark} strokeWidth={0.8} />
        <rect x={CX - 32} y={25} width={64} height={25} fill={body.fill} stroke={body.dark} strokeWidth={0.8} />
        <rect x={CX - 8} y={33} width={16} height={17} fill={body.dark} />
        <rect x={CX - 37} y={15} width={74} height={10} fill={roof.fill} stroke={roof.dark} strokeWidth={0.8} />
        {[-28, -14, 0, 14, 28].map((dx) => (
          <rect key={dx} x={CX + dx - 4} y={7} width={8} height={8} fill={crest.fill} stroke={crest.dark} strokeWidth={0.6} />
        ))}
      </g>
    );
  },
  base: () => {
    const t = tone("#cdb68c");
    return (
      <g>
        <rect x={0} y={GROUND} width={LAYOUT.width} height={LAYOUT.base} fill={t.fill} />
        {[0, 1, 2].map((i) => (
          <line key={i} x1={0} x2={LAYOUT.width} y1={GROUND + 8 + i * 9} y2={GROUND + 8 + i * 9} stroke={t.dark} strokeWidth={0.6} opacity={0.5} />
        ))}
        <rect x={CX - 22} y={GROUND} width={44} height={10} fill={t.light} stroke={t.dark} strokeWidth={0.6} />
      </g>
    );
  },
};

export const CLASSIC = { colonne, pyramide, arbre, azteque };

