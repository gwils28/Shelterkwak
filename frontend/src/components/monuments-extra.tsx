// Cocotier, mont Everest, totem, phare, chutes d'Iguazú, Burj Khalifa et panier de basket.
// Même contrat que les autres monuments (voir monuments.tsx) : chaque renderer dessine le monument
// entier aux couleurs du palier, Column découpe la bande. Les éléments animés portent une classe
// anim-* ; leur point de pivot, quand il compte, est donné par data-ox / data-oy (voir animations.ts).

import { builtTone, CX, GROUND, HEIGHT, LAYOUT, seeded, type Tone, tierBottom, tierTop, tone } from "../lib/monument";
import { Bird, Cloud, type Renderer, Shade, Sparkle } from "./monuments";

const GOLD = tone("#d4a531");
const W = LAYOUT.width;

function polyline(points: [number, number][]): string {
  return points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

/** Vagues qui ondulent au pied du monument. */
function Waves({ y0, color = "#ffffff", count = 3 }: { y0: number; color?: string; count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <path
          key={i}
          className="anim-wave"
          d={`M${-20 + i * 7},${y0 + i * 8} q10,-4 20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0`}
          fill="none"
          stroke={color}
          strokeWidth={1.3}
          opacity={0.75 - i * 0.15}
        />
      ))}
    </>
  );
}

// ---------- Cocotier : un stipe annelé, couronné de palmes ----------

const CT = 112; // haut du stipe, d'où partent les palmes
const ccx = (y: number) => CX + 9 * Math.sin((GROUND - y) / 120);
const chw = (y: number) => 17 - (6 * (GROUND - y)) / (GROUND - CT);
const PALM: [number, number] = [ccx(CT), CT];

const TRUNK = (() => {
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let y = GROUND; y >= CT; y -= 6) {
    left.push([ccx(y) - chw(y), y]);
    right.unshift([ccx(y) + chw(y), y]);
  }
  return `${polyline([...left, ...right])} Z`;
})();
const RINGS = (() => {
  const out: string[] = [];
  for (let y = GROUND - 10; y > CT + 4; y -= 13) {
    const x = ccx(y);
    const h = chw(y);
    out.push(`M${(x - h).toFixed(1)},${y} Q${x.toFixed(1)},${y + 5} ${(x + h).toFixed(1)},${y}`);
  }
  return out;
})();

/** Une palme : nervure arquée et folioles qui pendent de part et d'autre. */
const FRONDS = (
  [
    [-172, 96, 40],
    [-145, 86, 14],
    [-115, 64, -4],
    [-70, 64, -4],
    [-38, 86, 14],
    [-8, 96, 40],
    [158, 66, 14],
    [22, 66, 14],
  ] as const
).map(([deg, len, droop]) => {
  const a = (deg * Math.PI) / 180;
  const [px, py] = PALM;
  const tip: [number, number] = [px + Math.cos(a) * len, Math.min(py + Math.sin(a) * len + droop, 157)];
  const c: [number, number] = [px + (tip[0] - px) * 0.5, py + (tip[1] - py) * 0.5 - 24];
  const at = (t: number): [number, number] => [
    (1 - t) ** 2 * px + 2 * (1 - t) * t * c[0] + t * t * tip[0],
    (1 - t) ** 2 * py + 2 * (1 - t) * t * c[1] + t * t * tip[1],
  ];
  const leaves: string[] = [];
  for (let t = 0.14; t <= 0.96; t += 0.075) {
    const [x, y] = at(t);
    const [x2, y2] = at(t + 0.02);
    const dx = x2 - x;
    const dy = y2 - y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d;
    const ny = dx / d;
    const len = 14 * (1 - t * 0.55);
    // les deux folioles retombent : on tire chaque normale vers le bas
    for (const s of [-1, 1]) {
      const ex = x + (s * nx * 0.7) * len;
      const ey = y + (s * ny * 0.7 + 0.75) * len;
      leaves.push(`M${x.toFixed(1)},${y.toFixed(1)} L${ex.toFixed(1)},${Math.min(ey, 158).toFixed(1)}`);
    }
  }
  return { rib: `M${px.toFixed(1)},${py} Q${c[0].toFixed(1)},${c[1].toFixed(1)} ${tip[0].toFixed(1)},${tip[1].toFixed(1)}`, leaves: leaves.join(" ") };
});

const cocotier: Renderer = {
  crackX: (n) => ccx(tierTop(n) + 25) + 8,
  bandTop: (n) => (n === LAYOUT.levels ? 0 : tierTop(n)),
  ambient: () => ({
    back: (
      <>
        <Cloud x={52} y={210} s={1.1} />
        <Cloud x={214} y={250} s={0.85} opacity={0.65} />
      </>
    ),
    front: (
      <>
        <Waves y0={HEIGHT - 16} />
        <Bird x={44} y={200} />
        <Bird x={70} y={184} scale={0.8} />
      </>
    ),
  }),
  tier: (n, t, built, uid) => {
    const id = `${uid}-coc-${n}`;
    const bark = n >= 8 && built ? builtTone("cocotier", 7) : t;
    const barkId = `${id}-bark`;
    return (
      <>
        <defs>
          <Shade id={barkId} t={bark} />
        </defs>
        <path d={TRUNK} fill={`url(#${barkId})`} stroke={bark.dark} strokeWidth={0.9} />
        <g fill="none" stroke={bark.dark} strokeWidth={1.3} opacity={0.65}>
          {RINGS.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        <path d={`M${ccx(GROUND) + 7},${GROUND - 4} Q${ccx(300) + 9},300 ${ccx(CT) + 5},${CT + 8}`} fill="none" stroke={bark.light} strokeWidth={2} opacity={0.45} />
        {n >= 8 && (
          <g className="anim-frond" data-ox={PALM[0]} data-oy={PALM[1]} strokeLinecap="round" fill="none">
            {FRONDS.map((f, i) => (
              <g key={i}>
                <path d={f.leaves} stroke={i % 2 ? t.fill : t.light} strokeWidth={2.4} />
                <path d={f.rib} stroke={t.dark} strokeWidth={2.2} />
              </g>
            ))}
          </g>
        )}
      </>
    );
  },
  crown: (built, _uid, grey) => {
    const c = built ? tone("#8a6326") : grey;
    const [x, y] = PALM;
    return (
      <g className={built ? "crown built" : "crown"}>
        {[
          [x - 7, y + 8],
          [x + 7, y + 9],
          [x, y + 15],
        ].map(([cx, cy]) => (
          <g key={`${cx}-${cy}`}>
            <circle cx={cx} cy={cy} r={6.5} fill={c.fill} stroke={c.dark} strokeWidth={0.8} />
            <circle cx={cx - 2} cy={cy - 2} r={2.2} fill={c.light} opacity={0.7} />
          </g>
        ))}
        {built && (
          <>
            <circle cx={214} cy={34} r={15} fill={GOLD.light} opacity={0.9} />
            <Sparkle x={x + 22} y={y - 4} size={6} />
          </>
        )}
      </g>
    );
  },
  base: () => (
    <g>
      <rect x={0} y={GROUND} width={W} height={HEIGHT - GROUND} fill="#ead49c" />
      <ellipse cx={ccx(GROUND)} cy={GROUND + 3} rx={44} ry={6} fill="#d8bd7c" />
      <rect x={0} y={HEIGHT - 18} width={W} height={18} fill="#4fa7c9" />
      <path d={`M210,${GROUND + 9} l3,-6 l3,6 l6,1 l-5,4 l2,6 l-6,-3 l-6,3 l2,-6 l-5,-4 Z`} fill="#e07a52" />
    </g>
  ),
};

// ---------- Mont Everest : de la forêt du camp de base aux neiges du sommet ----------

const PEAK: [number, number] = [CX + 6, 66];
const RIDGE = (() => {
  const rnd = seeded(8848);
  const N = 18;
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const f = i / N;
    const jitter = i === 0 || i === N ? 0 : (rnd() - 0.5) * 16 * (1 - f * 0.7);
    left.push([f * PEAK[0], GROUND - 4 - (GROUND - 4 - PEAK[1]) * Math.pow(f, 1.7) + jitter]);
  }
  for (let i = N; i >= 0; i--) {
    const f = i / N;
    const jitter = i === 0 || i === N ? 0 : (rnd() - 0.5) * 18 * (1 - f * 0.7);
    right.push([W - f * (W - PEAK[0]), GROUND - 2 - (GROUND - 2 - PEAK[1]) * Math.pow(f, 1.35) + jitter]);
  }
  return { left, right };
})();
const MOUNTAIN = `${polyline([[0, GROUND], ...RIDGE.left, ...RIDGE.right.slice(1), [W, GROUND]])} Z`;
const FACE = `${polyline([PEAK, ...RIDGE.right.slice(1), [W, GROUND], [CX + 34, GROUND], [CX + 8, 360], [CX + 22, 220], [CX + 10, 130]])} Z`;
const ROCKS = (() => {
  const rnd = seeded(29);
  return Array.from({ length: 34 }, () => {
    const y = 110 + rnd() * 380;
    const f = (GROUND - y) / (GROUND - PEAK[1]);
    const half = 128 * (1 - f) * 0.85;
    const x = PEAK[0] + (rnd() * 2 - 1) * half;
    const len = 6 + rnd() * 12;
    return `M${x.toFixed(1)},${y.toFixed(1)} l${(len * 0.8).toFixed(1)},${(len * 0.45).toFixed(1)}`;
  });
})();
const SNOWLINES = [
  `M${PEAK[0]},${PEAK[1]} L${PEAK[0] - 18},112 L${PEAK[0] - 10},150 L${PEAK[0] - 34},210`,
  `M${PEAK[0] - 26},120 L${PEAK[0] - 48},176 L${PEAK[0] - 40},214`,
  `M${PEAK[0] + 14},104 L${PEAK[0] + 36},160 L${PEAK[0] + 30},206 L${PEAK[0] + 52},260`,
];
const FLAG_COLORS = ["#2f6fb8", "#f4f4f4", "#c8372d", "#3f9a4a", "#e8c23a"];
function flagLine(end: [number, number], sag: number) {
  const [x0, y0] = PEAK;
  const c: [number, number] = [(x0 + end[0]) / 2, (y0 + end[1]) / 2 + sag];
  const at = (t: number): [number, number] => [
    (1 - t) ** 2 * x0 + 2 * (1 - t) * t * c[0] + t * t * end[0],
    (1 - t) ** 2 * y0 + 2 * (1 - t) * t * c[1] + t * t * end[1],
  ];
  return { d: `M${x0},${y0} Q${c[0]},${c[1]} ${end[0]},${end[1]}`, flags: Array.from({ length: 7 }, (_, i) => at(0.1 + i * 0.13)) };
}
const FLAG_LINES = [flagLine([24, 34], 18), flagLine([238, 44], 16)];

const everest: Renderer = {
  crackX: () => CX + 26,
  ambient: () => ({
    back: (
      <>
        <Cloud x={46} y={300} s={1.2} opacity={0.7} />
        <Cloud x={216} y={380} s={1} opacity={0.6} />
      </>
    ),
    front: (
      <>
        <Cloud x={204} y={170} s={1.3} opacity={0.75} />
        {Array.from({ length: 10 }, (_, i) => (
          <circle key={i} className="anim-spin" cx={PEAK[0] + 2} cy={PEAK[1] + 4 + (i % 3) * 3} r={1.2 + (i % 3) * 0.7} fill="#ffffff" opacity={0} />
        ))}
      </>
    ),
  }),
  tier: (n, t, _built, uid) => {
    const id = `${uid}-eve-${n}`;
    return (
      <>
        <defs>
          <linearGradient id={id} x1="0" x2="1">
            <stop offset="0" stopColor={t.light} />
            <stop offset="0.5" stopColor={t.fill} />
            <stop offset="1" stopColor={t.fill} />
          </linearGradient>
        </defs>
        <path d={MOUNTAIN} fill={`url(#${id})`} stroke={t.dark} strokeWidth={1} />
        <path d={FACE} fill={t.dark} opacity={0.3} />
        <g fill="none" stroke={t.dark} strokeWidth={1.2} opacity={0.4} strokeLinecap="round">
          {ROCKS.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        <g fill="none" stroke={t.light} strokeWidth={2.2} opacity={0.6} strokeLinejoin="round">
          {SNOWLINES.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      </>
    );
  },
  crown: (built, _uid, grey) => (
    <g className={built ? "crown built" : "crown"}>
      {FLAG_LINES.map((line, k) => (
        <g key={k}>
          <path d={line.d} fill="none" stroke={built ? "#6b5a48" : grey.dark} strokeWidth={0.8} />
          {line.flags.map(([x, y], i) => (
            <rect
              key={i}
              className="anim-flag"
              x={x - 3.5}
              y={y}
              width={7}
              height={8}
              fill={built ? FLAG_COLORS[(i + k) % FLAG_COLORS.length] : grey.fill}
              stroke={built ? "#00000022" : grey.dark}
              strokeWidth={0.4}
              style={{ transformOrigin: `${x}px ${y}px` }}
            />
          ))}
        </g>
      ))}
      {built && <Sparkle x={PEAK[0]} y={PEAK[1] - 10} size={8} fill={GOLD.light} />}
    </g>
  ),
  base: () => {
    const rnd = seeded(54);
    return (
      <g>
        <rect x={0} y={GROUND} width={W} height={HEIGHT - GROUND} fill="#8b8576" />
        {Array.from({ length: 14 }, (_, i) => (
          <ellipse key={i} cx={8 + rnd() * 244} cy={GROUND + 6 + rnd() * 24} rx={3 + rnd() * 5} ry={2 + rnd() * 2.5} fill="#6c665a" />
        ))}
        {/* camp de base */}
        {[
          [40, "#e8a43a"],
          [62, "#d0502f"],
          [196, "#e8c23a"],
          [218, "#3f7fc0"],
        ].map(([x, c]) => (
          <path key={x} d={`M${Number(x) - 10},${GROUND + 22} L${x},${GROUND + 8} L${Number(x) + 10},${GROUND + 22} Z`} fill={String(c)} stroke="#3d3a33" strokeWidth={0.6} />
        ))}
      </g>
    );
  },
};

// ---------- Totem : une figure sculptée par palier, l'oiseau-tonnerre au sommet ----------

const TH = 42; // demi-largeur du mât
const INK = "#1f1a17";

function totemFace(n: number, t: Tone) {
  const top = tierTop(n);
  const bottom = tierBottom(n);
  const eyes = (y: number, rx: number) =>
    [-1, 1].map((s) => (
      <g key={s}>
        <path d={`M${CX + s * 4},${y - 7} Q${CX + s * 16},${y - 13} ${CX + s * 30},${y - 6}`} fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" opacity={0.8} />
        <ellipse cx={CX + s * 16} cy={y} rx={rx} ry={5.5} fill={t.light} stroke={INK} strokeWidth={1.6} />
        <circle cx={CX + s * 16} cy={y} r={2.6} fill={INK} />
      </g>
    ));
  switch (n % 3) {
    case 0: // aigle : bec crochu et ailes repliées
      return (
        <>
          {[-1, 1].map((s) => (
            <path key={s} d={`M${CX + s * TH},${top + 14} L${CX + s * (TH + 14)},${top + 22} L${CX + s * (TH + 10)},${top + 32} L${CX + s * (TH + 14)},${top + 40} L${CX + s * TH},${bottom - 4} Z`} fill={t.dark} stroke={INK} strokeWidth={1} />
          ))}
          {eyes(top + 11, 9)}
          <path d={`M${CX - 7},${top + 15} L${CX + 7},${top + 15} Q${CX + 6},${top + 24} ${CX},${top + 27} Q${CX - 5},${top + 22} ${CX - 7},${top + 15} Z`} fill={t.dark} stroke={INK} strokeWidth={1.2} />
          <path d={`M${CX - 30},${bottom - 8} L${CX + 30},${bottom - 8}`} stroke={INK} strokeWidth={2} opacity={0.7} />
        </>
      );
    case 1: // ours : oreilles, gueule et dents, pattes
      return (
        <>
          {[-1, 1].map((s) => (
            <g key={s}>
              <circle cx={CX + s * (TH + 3)} cy={top + 9} r={7} fill={t.fill} stroke={INK} strokeWidth={1.2} />
              <circle cx={CX + s * (TH + 3)} cy={top + 9} r={3} fill={t.dark} />
              <ellipse cx={CX + s * 30} cy={bottom - 9} rx={10} ry={6} fill={t.dark} stroke={INK} strokeWidth={1} />
            </g>
          ))}
          {eyes(top + 11, 8)}
          <rect x={CX - 24} y={top + 35} width={48} height={10} rx={4} fill={INK} opacity={0.85} />
          {[-18, -9, 0, 9, 18].map((dx) => (
            <rect key={dx} x={CX + dx - 3} y={top + 35} width={6} height={4} fill={t.light} />
          ))}
        </>
      );
    default: // baleine : grands yeux ronds, sourire, nageoires
      return (
        <>
          {[-1, 1].map((s) => (
            <path key={s} d={`M${CX + s * TH},${top + 18} Q${CX + s * (TH + 20)},${top + 20} ${CX + s * (TH + 16)},${top + 38} Q${CX + s * (TH + 6)},${top + 32} ${CX + s * TH},${top + 36} Z`} fill={t.dark} stroke={INK} strokeWidth={1} />
          ))}
          {eyes(top + 12, 7)}
          <path d={`M${CX - 28},${top + 36} Q${CX},${top + 50} ${CX + 28},${top + 36}`} fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
          <path d={`M${CX - 22},${top + 39} Q${CX},${top + 47} ${CX + 22},${top + 39}`} fill="none" stroke={t.light} strokeWidth={1.4} strokeLinecap="round" />
        </>
      );
  }
}

const PINES: [number, number][] = [
  [14, 1],
  [34, 0.8],
  [222, 0.9],
  [244, 1.1],
];

const totem: Renderer = {
  crackX: () => CX + 26,
  ambient: () => ({
    back: (
      <>
        {PINES.map(([x, s]) => (
          <path key={x} d={`M${x},${GROUND - 120 * s} L${x + 18 * s},${GROUND} L${x - 18 * s},${GROUND} Z`} fill="#4f6f4a" opacity={0.55} />
        ))}
      </>
    ),
    front: (
      <>
        {[0, 1, 2, 3].map((i) => (
          <circle key={i} className="anim-smoke" cx={36} cy={GROUND - 4} r={5} fill="#c9c4bb" opacity={0} />
        ))}
        <g>
          <path d={`M24,${GROUND + 8} L48,${GROUND + 2} M24,${GROUND + 2} L48,${GROUND + 8}`} stroke="#5e3f26" strokeWidth={3.4} strokeLinecap="round" />
          <path className="anim-fire" d={`M28,${GROUND + 4} Q26,${GROUND - 8} 33,${GROUND - 16} Q34,${GROUND - 8} 37,${GROUND - 10} Q38,${GROUND - 20} 42,${GROUND - 22} Q46,${GROUND - 8} 44,${GROUND + 4} Z`} fill="#f08a2a" style={{ transformOrigin: `36px ${GROUND + 4}px` }} />
          <path className="anim-fire" d={`M32,${GROUND + 4} Q31,${GROUND - 4} 36,${GROUND - 10} Q40,${GROUND - 4} 40,${GROUND + 4} Z`} fill="#fde58a" style={{ transformOrigin: `36px ${GROUND + 4}px` }} />
        </g>
      </>
    ),
  }),
  tier: (n, t, _built, uid) => {
    const id = `${uid}-tot-${n}`;
    const top = tierTop(n);
    return (
      <>
        <defs>
          <Shade id={id} t={t} />
        </defs>
        <rect x={CX - TH} y={top} width={TH * 2} height={LAYOUT.tier} fill={`url(#${id})`} stroke={INK} strokeWidth={0.8} />
        <line x1={CX - TH} x2={CX + TH} y1={top + 1} y2={top + 1} stroke={INK} strokeWidth={1.4} opacity={0.6} />
        {totemFace(n, t)}
      </>
    );
  },
  crown: (built, _uid, grey) => {
    const c = built ? GOLD : grey;
    const red = built ? "#b8432f" : grey.dark;
    const teal = built ? "#2f7f83" : grey.light;
    const wing = (s: number) => (
      <g className="anim-tbwing" data-ox={CX + s * 12} data-oy={44} data-dir={s}>
        <path
          d={`M${CX + s * 12},${50} Q${CX + s * 50},${16} ${CX + s * 108},${12} L${CX + s * 100},${24} L${CX + s * 106},${30} L${CX + s * 94},${38} L${CX + s * 98},${46} L${CX + s * 80},${50} L${CX + s * 82},${58} Z`}
          fill={c.fill}
          stroke={INK}
          strokeWidth={1}
        />
        <path d={`M${CX + s * 26},${44} Q${CX + s * 56},${26} ${CX + s * 94},${22}`} fill="none" stroke={red} strokeWidth={3} strokeLinecap="round" />
        {[40, 56, 72].map((dx) => (
          <ellipse key={dx} cx={CX + s * dx} cy={42 - dx * 0.12} rx={5} ry={3} fill={teal} stroke={INK} strokeWidth={0.7} />
        ))}
      </g>
    );
    return (
      <g className={built ? "crown built" : "crown"}>
        {wing(-1)}
        {wing(1)}
        <rect x={CX - 16} y={34} width={32} height={26} fill={c.fill} stroke={INK} strokeWidth={1} />
        <path d={`M${CX - 12},${8} L${CX - 18},${2} L${CX - 6},${10} M${CX + 12},${8} L${CX + 18},${2} L${CX + 6},${10}`} fill="none" stroke={INK} strokeWidth={1.6} />
        <circle cx={CX} cy={22} r={13} fill={c.fill} stroke={INK} strokeWidth={1} />
        {[-1, 1].map((s) => (
          <circle key={s} cx={CX + s * 5.5} cy={19} r={2.4} fill={INK} />
        ))}
        <path d={`M${CX - 5},${25} L${CX + 5},${25} Q${CX + 4},${36} ${CX},${40} Q${CX - 2},${32} ${CX - 5},${25} Z`} fill={red} stroke={INK} strokeWidth={1} />
      </g>
    );
  },
  base: () => (
    <g>
      <rect x={0} y={GROUND} width={W} height={HEIGHT - GROUND} fill="#6f8f4f" />
      <rect x={0} y={GROUND + 12} width={W} height={HEIGHT - GROUND - 12} fill="#5b7a40" opacity={0.6} />
      <rect x={CX - TH - 6} y={GROUND} width={TH * 2 + 12} height={8} fill="#7a6a54" stroke="#4f4436" strokeWidth={0.7} />
    </g>
  ),
};

// ---------- Phare : bandes rouges et blanches, lanterne au sommet ----------

const phw = (y: number) => 26 + (20 * (y - 70)) / (GROUND - 70);
const LIGHT: [number, number] = [CX, 40];

const phare: Renderer = {
  crackX: (n) => CX + phw(tierTop(n) + 25) - 10,
  ambient: (uid, level) => ({
    back: (
      <>
        <Cloud x={46} y={150} s={1} />
        <Cloud x={212} y={240} s={0.9} opacity={0.6} />
      </>
    ),
    front: (
      <>
        {level >= LAYOUT.levels && (
          <>
            <defs>
              <linearGradient id={`${uid}-lbeam`} x1="0" x2="1">
                <stop offset="0" stopColor="#fff3b0" stopOpacity={0.85} />
                <stop offset="1" stopColor="#fff3b0" stopOpacity={0} />
              </linearGradient>
            </defs>
            <g className="anim-lbeam" data-ox={LIGHT[0]} data-oy={LIGHT[1]}>
              <path d={`M${CX},${LIGHT[1]} L${CX + 150},${LIGHT[1] - 18} L${CX + 150},${LIGHT[1] + 18} Z`} fill={`url(#${uid}-lbeam)`} />
              <path d={`M${CX},${LIGHT[1]} L${CX - 150},${LIGHT[1] - 18} L${CX - 150},${LIGHT[1] + 18} Z`} fill={`url(#${uid}-lbeam)`} opacity={0.4} />
            </g>
          </>
        )}
        <Waves y0={HEIGHT - 14} />
        <Bird x={52} y={110} />
        <Bird x={204} y={150} scale={0.85} />
      </>
    ),
  }),
  tier: (n, t, _built, uid) => {
    const id = `${uid}-pha-${n}`;
    const top = tierTop(n);
    const bottom = tierBottom(n);
    const a = phw(top);
    const b = phw(bottom);
    return (
      <>
        <defs>
          <Shade id={id} t={t} />
        </defs>
        <path d={`M${CX - a},${top} L${CX + a},${top} L${CX + b},${bottom} L${CX - b},${bottom} Z`} fill={`url(#${id})`} stroke={t.dark} strokeWidth={0.8} />
        {[3, 5, 7].includes(n) && <path d={`M${CX - 4},${top + 16} V${top + 10} Q${CX},${top + 5} ${CX + 4},${top + 10} V${top + 16} Z`} fill="#2f3b4a" stroke={t.dark} strokeWidth={0.6} />}
        {n === 1 && <path d={`M${CX - 8},${bottom} V${bottom - 14} Q${CX},${bottom - 22} ${CX + 8},${bottom - 14} V${bottom} Z`} fill="#3d2f22" stroke={t.dark} strokeWidth={0.7} />}
      </>
    );
  },
  crown: (built, _uid, grey) => {
    const red = built ? tone("#b8322a") : grey;
    const metal = built ? "#2f3036" : grey.dark;
    return (
      <g className={built ? "crown built" : "crown"}>
        <rect x={CX - 36} y={54} width={72} height={6} fill={metal} />
        <line x1={CX - 34} x2={CX + 34} y1={45} y2={45} stroke={metal} strokeWidth={1.2} />
        {Array.from({ length: 9 }, (_, i) => (
          <line key={i} x1={CX - 34 + i * 8.5} x2={CX - 34 + i * 8.5} y1={45} y2={54} stroke={metal} strokeWidth={1} />
        ))}
        <rect className={built ? "anim-glow" : undefined} x={CX - 15} y={26} width={30} height={28} fill={built ? "#ffe58a" : grey.light} stroke={metal} strokeWidth={1} />
        {[-5, 5].map((dx) => (
          <line key={dx} x1={CX + dx} x2={CX + dx} y1={26} y2={54} stroke={metal} strokeWidth={1} />
        ))}
        <path d={`M${CX - 19},26 Q${CX},2 ${CX + 19},26 Z`} fill={red.fill} stroke={red.dark} strokeWidth={0.8} />
        <line x1={CX} x2={CX} y1={10} y2={3} stroke={metal} strokeWidth={1.4} />
        <circle cx={CX} cy={3} r={2} fill={metal} />
      </g>
    );
  },
  base: () => (
    <g>
      <rect x={0} y={GROUND + 10} width={W} height={HEIGHT - GROUND - 10} fill="#3f8fb4" />
      <path d={`M14,${GROUND + 20} Q30,${GROUND - 6} ${CX - 40},${GROUND} L${CX + 44},${GROUND} Q${CX + 90},${GROUND - 4} ${W - 16},${GROUND + 22} Z`} fill="#6d6a66" stroke="#4a4744" strokeWidth={0.8} />
      {[
        [40, 8, 6],
        [70, 12, 7],
        [200, 10, 6],
        [228, 7, 5],
      ].map(([x, rx, ry]) => (
        <ellipse key={x} cx={x} cy={GROUND + 12} rx={rx} ry={ry} fill="#8a8580" stroke="#4a4744" strokeWidth={0.6} />
      ))}
    </g>
  ),
};

// ---------- Chutes d'Iguazú : cascades en gradins dans la forêt ----------

const icw = (n: number) => 240 - (n - 1) * 16;
const BUSHES = (() => {
  const rnd = seeded(1541);
  return Array.from({ length: LAYOUT.levels }, () => Array.from({ length: 4 }, () => ({ dy: 12 + rnd() * 30, r: 6 + rnd() * 4, dx: rnd() * 6 })));
})();

const iguazu: Renderer = {
  crackX: (n) => CX + icw(n) / 2 - 30,
  ambient: () => ({
    front: (
      <>
        {Array.from({ length: 9 }, (_, i) => (
          <circle key={i} className="anim-mist" data-rise={60 + (i % 3) * 20} cx={18 + i * 28} cy={GROUND - 2} r={9 + (i % 3) * 3} fill="#ffffff" opacity={0} />
        ))}
        <Bird x={36} y={260} scale={0.8} color="#2b2b30" />
        <Bird x={220} y={200} scale={0.7} color="#2b2b30" />
        <Bird x={190} y={320} scale={0.6} color="#2b2b30" />
      </>
    ),
  }),
  tier: (n, t, built, uid) => {
    const id = `${uid}-igu-${n}`;
    const top = tierTop(n);
    const bottom = tierBottom(n);
    const w = icw(n);
    const L = CX - w / 2;
    const rock = built ? tone("#6b4a34") : t;
    const green = built ? tone("#3f7d3a") : tone("#9c968b");
    const foam = built ? "#f4fbff" : t.light;
    const streaks = Array.from({ length: 9 }, (_, i) => L + 18 + ((w - 36) * i) / 8);
    return (
      <>
        <defs>
          <linearGradient id={id} x1="0" x2="1">
            <stop offset="0" stopColor={t.dark} />
            <stop offset="0.25" stopColor={t.fill} />
            <stop offset="0.5" stopColor={t.light} />
            <stop offset="0.75" stopColor={t.fill} />
            <stop offset="1" stopColor={t.dark} />
          </linearGradient>
        </defs>
        <rect x={L} y={top} width={w} height={LAYOUT.tier} fill={rock.dark} />
        <rect x={L + 12} y={top + 8} width={w - 24} height={bottom - top - 8} fill={`url(#${id})`} />
        <g fill="none" stroke={foam} strokeWidth={1.5} strokeLinecap="round" opacity={0.7}>
          {streaks.map((x, i) => (
            <path key={i} className="anim-water" d={`M${x},${top + 9} L${x + (i % 2 ? 1 : -1)},${bottom}`} />
          ))}
        </g>
        <rect x={L - 4} y={top} width={w + 8} height={9} rx={3} fill={rock.fill} stroke={rock.dark} strokeWidth={0.8} />
        <path d={`M${L + 12},${top + 9.5} H${L + w - 12}`} stroke={foam} strokeWidth={2.2} />
        {Array.from({ length: Math.floor((w - 24) / 14) }, (_, i) => (
          <ellipse key={i} cx={L + 19 + i * 14} cy={bottom - 1} rx={8} ry={3} fill={foam} opacity={0.75} />
        ))}
        {[-1, 1].map((s) =>
          BUSHES[n - 1].map((b, i) => {
            const x = s < 0 ? L + 6 + b.dx : L + w - 6 - b.dx;
            return (
              <g key={`${s}${i}`}>
                <circle cx={x} cy={top + b.dy} r={b.r} fill={green.fill} />
                <circle cx={x - 2} cy={top + b.dy - 2} r={b.r * 0.5} fill={green.light} opacity={0.6} />
              </g>
            );
          }),
        )}
      </>
    );
  },
  crown: (built, _uid, grey) => {
    const colors = built ? ["#e5484d", "#f08a2a", "#f2c94c", "#4fae5a", "#3f86c8", "#7a5ac0"] : [grey.dark, grey.fill, grey.light];
    const green = built ? tone("#3f7d3a") : grey;
    const w = icw(LAYOUT.levels);
    return (
      <g className={built ? "crown built" : "crown"}>
        {Array.from({ length: 9 }, (_, i) => (
          <circle key={i} cx={CX - w / 2 + 6 + (i * (w - 12)) / 8} cy={56 - (i % 2) * 4} r={9 + (i % 3) * 2} fill={green.fill} stroke={green.dark} strokeWidth={0.6} />
        ))}
        <g className={built ? "anim-rainbow" : undefined} fill="none" opacity={built ? 0.6 : 0.35}>
          {colors.map((c, i) => (
            <path key={i} d={`M${CX - 116 + i * 3.5},120 A${116 - i * 3.5},${100 - i * 3.5} 0 0 1 ${CX + 116 - i * 3.5},120`} stroke={c} strokeWidth={3.5} />
          ))}
        </g>
        {built && <circle cx={226} cy={22} r={12} fill={GOLD.light} />}
      </g>
    );
  },
  base: () => (
    <g>
      <rect x={0} y={GROUND} width={W} height={HEIGHT - GROUND} fill="#3a86a8" />
      {[GROUND + 8, GROUND + 18, GROUND + 27].map((y, i) => (
        <path key={y} d={`M${i * 6},${y} q10,-3 20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0`} fill="none" stroke="#e8f6fb" strokeWidth={1} opacity={0.6} />
      ))}
    </g>
  ),
};

// ---------- Burj Khalifa : retraits en spirale, flèche au sommet ----------

const bhw = (n: number) => 64 - (n - 1) * 5.5;
const bcore = (n: number) => Math.max(14, bhw(n) * 0.6);

function Floors({ x, y, w, h, t }: { x: number; y: number; w: number; h: number; t: Tone }) {
  const lines: number[] = [];
  for (let k = y + 5; k < y + h; k += 5) lines.push(k);
  return (
    <g stroke={t.dark} strokeWidth={0.6} opacity={0.35}>
      {lines.map((k) => (
        <line key={k} x1={x + 1} x2={x + w - 1} y1={k} y2={k} />
      ))}
    </g>
  );
}

const burj: Renderer = {
  crackX: (n) => CX + bcore(n) - 6,
  ambient: () => ({
    back: (
      <>
        <Cloud x={50} y={230} s={1} opacity={0.7} />
        <Cloud x={210} y={150} s={1.2} opacity={0.6} />
      </>
    ),
    front: (
      <>
        <Cloud x={70} y={330} s={0.9} opacity={0.75} />
        {[-80, -62, 62, 80].map((dx, i) => (
          <line key={dx} className="anim-jet" x1={CX + dx} x2={CX + dx} y1={GROUND + 18} y2={GROUND - 10 - (i % 2 ? 30 : 18)} stroke="#d8f0fb" strokeWidth={2} strokeLinecap="round" opacity={0.85} />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <circle key={i} className="anim-sand" cx={0} cy={GROUND + 4 + i * 6} r={1.4} fill="#c9a86a" opacity={0} />
        ))}
      </>
    ),
  }),
  tier: (n, t, _built, uid) => {
    const id = `${uid}-bur-${n}`;
    const top = tierTop(n);
    const bottom = tierBottom(n);
    const hw = bhw(n);
    const c = bcore(n);
    const wing = hw - c + 2;
    return (
      <>
        <defs>
          <Shade id={id} t={t} />
        </defs>
        {/* aile gauche, aile droite en retrait plus bas : la spirale des retraits */}
        <rect x={CX - hw} y={top + 12} width={wing} height={bottom - top - 12} fill={`url(#${id})`} stroke={t.dark} strokeWidth={0.6} />
        <Floors x={CX - hw} y={top + 12} w={wing} h={bottom - top - 12} t={t} />
        <rect x={CX + c - 2} y={top + 30} width={wing} height={bottom - top - 30} fill={`url(#${id})`} stroke={t.dark} strokeWidth={0.6} />
        <Floors x={CX + c - 2} y={top + 30} w={wing} h={bottom - top - 30} t={t} />
        <rect x={CX - c} y={top} width={c * 2} height={LAYOUT.tier} fill={`url(#${id})`} stroke={t.dark} strokeWidth={0.7} />
        <Floors x={CX - c} y={top} w={c * 2} h={LAYOUT.tier} t={t} />
        <line x1={CX - c + 3} x2={CX - c + 3} y1={top} y2={bottom} stroke={t.light} strokeWidth={1.4} opacity={0.8} />
      </>
    );
  },
  crown: (built, _uid, grey) => {
    const s = built ? tone("#c9d3dc") : grey;
    return (
      <g className={built ? "crown built" : "crown"}>
        <path d={`M${CX - 12},60 L${CX + 12},60 L${CX + 1.4},8 L${CX - 1.4},8 Z`} fill={s.fill} stroke={s.dark} strokeWidth={0.7} />
        {[52, 44, 36, 28].map((y) => {
          const h = 1.4 + ((y - 8) / 52) * 10.6;
          return <line key={y} x1={CX - h} x2={CX + h} y1={y} y2={y} stroke={s.dark} strokeWidth={0.7} opacity={0.6} />;
        })}
        <line x1={CX} x2={CX} y1={8} y2={2} stroke={s.dark} strokeWidth={1} />
        <circle className={built ? "anim-blink" : undefined} cx={CX} cy={3} r={2.6} fill={built ? "#e5484d" : grey.dark} />
        {built && <Sparkle x={CX + 24} y={16} size={7} fill={GOLD.light} />}
      </g>
    );
  },
  base: () => (
    <g>
      <rect x={0} y={GROUND} width={W} height={HEIGHT - GROUND} fill="#e2c48e" />
      <rect x={CX - 78} y={GROUND} width={156} height={6} fill="#cdbfa8" />
      <ellipse cx={CX} cy={GROUND + 20} rx={92} ry={9} fill="#4fa7c9" stroke="#3a86a8" strokeWidth={0.8} />
    </g>
  ),
};

// ---------- Panier de basket : du poteau au panneau, jusqu'au panier marqué ----------

const RIM_Y = 154;
const BOARD = { x: CX - 82, y: 64, w: 164, h: 86 };
const NET = (() => {
  const top = RIM_Y + 1;
  const bot = RIM_Y + 26;
  const xs = Array.from({ length: 7 }, (_, i) => i / 6);
  const atTop = (f: number) => CX - 24 + 48 * f;
  const atBot = (f: number) => CX - 15 + 30 * f;
  const lines = xs.map((f) => `M${atTop(f)},${top} L${atBot(f)},${bot}`);
  const cross = xs.slice(0, -1).map((f, i) => `M${atTop(f)},${top} L${atBot(xs[i + 1])},${bot} M${atTop(xs[i + 1])},${top} L${atBot(f)},${bot}`);
  return [...lines, ...cross, `M${CX - 20},${top + 9} L${CX + 20},${top + 9}`, `M${CX - 17},${top + 18} L${CX + 17},${top + 18}`].join(" ");
})();
const BALL: [number, number] = [CX, 30];

function Ball({ x, y, r, fill, line }: { x: number; y: number; r: number; fill: string; line: string }) {
  return (
    <>
      <circle cx={x} cy={y} r={r} fill={fill} stroke={line} strokeWidth={1} />
      <path d={`M${x - r},${y} H${x + r} M${x},${y - r} V${y + r} M${x - r * 0.7},${y - r * 0.7} Q${x - r * 0.2},${y} ${x - r * 0.7},${y + r * 0.7} M${x + r * 0.7},${y - r * 0.7} Q${x + r * 0.2},${y} ${x + r * 0.7},${y + r * 0.7}`} fill="none" stroke={line} strokeWidth={0.9} />
    </>
  );
}

const panier: Renderer = {
  crackX: () => CX + 8,
  ambient: () => ({
    front: (
      <g className="anim-dribble" style={{ transformOrigin: `40px ${GROUND + 12}px` }}>
        <Ball x={40} y={GROUND + 3} r={9} fill="#e0702a" line="#3a2416" />
      </g>
    ),
  }),
  tier: (n, t, built, uid) => {
    const id = `${uid}-pan-${n}`;
    const orange = built ? "#e0622a" : t.dark;
    const net = built ? "#b9c0c8" : t.dark;
    return (
      <>
        <defs>
          <Shade id={id} t={t} />
        </defs>
        {/* poteau, manchon de protection en bas */}
        <rect x={CX - 16} y={BOARD.y + BOARD.h - 4} width={32} height={GROUND - BOARD.y - BOARD.h + 4} fill={`url(#${id})`} stroke={t.dark} strokeWidth={0.8} />
        <rect x={CX - 21} y={GROUND - 84} width={42} height={84} rx={4} fill={t.light} opacity={0.35} stroke={t.dark} strokeWidth={0.6} />
        {/* panneau, carré de visée */}
        <rect x={BOARD.x} y={BOARD.y} width={BOARD.w} height={BOARD.h} rx={3} fill={t.fill} stroke={t.dark} strokeWidth={2.4} />
        <rect x={BOARD.x + 5} y={BOARD.y + 5} width={BOARD.w - 10} height={BOARD.h - 10} rx={2} fill="none" stroke={orange} strokeWidth={2.2} />
        <rect x={CX - 22} y={BOARD.y + 50} width={44} height={30} fill="none" stroke={orange} strokeWidth={2.4} />
        {/* cercle et filet */}
        <rect x={CX - 5} y={RIM_Y - 6} width={10} height={6} fill={t.dark} />
        <g className="anim-net" style={{ transformOrigin: `${CX}px ${RIM_Y}px` }}>
          <path d={NET} fill="none" stroke={net} strokeWidth={1.1} />
        </g>
        <ellipse cx={CX} cy={RIM_Y} rx={25} ry={4.5} fill="none" stroke={orange} strokeWidth={3} />
      </>
    );
  },
  crown: (built, _uid, grey) => (
    <g className={built ? "crown built" : "crown"}>
      <g className={built ? "anim-ball" : undefined} data-rim={RIM_Y - BALL[1]} data-floor={GROUND + 3 - BALL[1]}>
        <Ball x={BALL[0]} y={BALL[1]} r={13} fill={built ? "#e0702a" : grey.fill} line={built ? "#3a2416" : grey.dark} />
      </g>
      {built && (
        <>
          <Sparkle className="anim-star" x={CX - 40} y={18} size={6} fill={GOLD.light} />
          <Sparkle className="anim-star" x={CX + 44} y={26} size={5} fill={GOLD.light} />
        </>
      )}
    </g>
  ),
  base: () => (
    <g>
      <rect x={0} y={GROUND} width={W} height={HEIGHT - GROUND} fill="#d9a066" />
      {Array.from({ length: 6 }, (_, i) => (
        <line key={i} x1={i * 46 + 12} x2={i * 46 + 12} y1={GROUND} y2={HEIGHT} stroke="#b9824d" strokeWidth={0.8} opacity={0.6} />
      ))}
      <path d={`M0,${GROUND + 22} H${W}`} stroke="#ffffff" strokeWidth={2} opacity={0.85} />
      <rect x={CX - 26} y={GROUND} width={52} height={8} fill="#4a4f57" />
    </g>
  ),
};

export const EXTRA: Record<"cocotier" | "everest" | "totem" | "phare" | "iguazu" | "burj" | "panier", Renderer> = {
  cocotier,
  everest,
  totem,
  phare,
  iguazu,
  burj,
  panier,
};
