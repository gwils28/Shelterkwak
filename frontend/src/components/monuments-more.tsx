// Pagode, bouddha assis et fusée. Même contrat que les autres monuments (voir monuments.tsx).

import { CX, GROUND, HEIGHT, LAYOUT, seeded, tierBottom, tierTop, tone } from "../lib/monument";
import { type Renderer, Shade } from "./monuments";

const GOLD = tone("#d4a531");
const W = LAYOUT.width;

// ---------- Pagode : un étage et son toit relevé par palier ----------

const pbw = (n: number) => 112 - (n - 1) * 8; // largeur du corps
const prw = (n: number) => pbw(n) + 58; // largeur du toit, avant-toits compris

const pagode: Renderer = {
  crackX: (n) => CX + pbw(n) / 2 - 12,
  tier: (n, t, _built, uid) => {
    const top = tierTop(n);
    const bottom = tierBottom(n);
    const bw = pbw(n);
    const rw = prw(n);
    const id = `${uid}-pag-${n}`;
    const L = CX - rw / 2;
    const R = CX + rw / 2;
    const roof = `M${CX - bw / 2 + 4},${top + 3} L${CX + bw / 2 - 4},${top + 3} Q${R - 12},${top + 12} ${R + 3},${top + 6} Q${R - 4},${top + 18} ${R - 18},${top + 17} L${L + 18},${top + 17} Q${L + 4},${top + 18} ${L - 3},${top + 6} Q${L + 12},${top + 12} ${CX - bw / 2 + 4},${top + 3} Z`;
    return (
      <>
        <defs>
          <Shade id={id} t={t} />
        </defs>
        <rect x={CX - bw / 2} y={top + 15} width={bw} height={bottom - top - 15} fill={`url(#${id})`} stroke={t.dark} strokeWidth={0.8} />
        {[0.18, 0.38, 0.62, 0.82].map((f) => (
          <rect key={f} x={CX - bw / 2 + bw * f - 2} y={top + 17} width={4} height={bottom - top - 17} fill={t.dark} opacity={0.4} />
        ))}
        <line x1={CX - bw / 2} x2={CX + bw / 2} y1={top + 27} y2={top + 27} stroke={t.light} strokeWidth={2} />
        <path d={`M${CX - 7},${bottom} V${bottom - 13} Q${CX},${bottom - 21} ${CX + 7},${bottom - 13} V${bottom} Z`} fill={t.dark} />
        <path d={roof} fill={t.dark} stroke={t.dark} strokeWidth={0.8} />
        <path d={`M${L + 18},${top + 16} L${R - 18},${top + 16}`} stroke={t.light} strokeWidth={1.4} opacity={0.8} />
        {Array.from({ length: 9 }, (_, i) => {
          const x = CX - bw / 2 + 8 + ((bw - 16) * i) / 8;
          return <line key={i} x1={x} x2={x + (x - CX) * 0.35} y1={top + 4} y2={top + 15} stroke={t.fill} strokeWidth={1} opacity={0.7} />;
        })}
      </>
    );
  },
  crown: (built, _uid, grey) => {
    const t = built ? GOLD : grey;
    return (
      <g className={built ? "crown built" : "crown"}>
        <rect x={CX - 11} y={52} width={22} height={11} fill={t.fill} stroke={t.dark} strokeWidth={0.7} />
        <line x1={CX} x2={CX} y1={52} y2={10} stroke={t.dark} strokeWidth={2} />
        {[48, 42, 36, 30, 24].map((y, i) => (
          <ellipse key={y} cx={CX} cy={y} rx={9 - i} ry={2.2} fill={t.fill} stroke={t.dark} strokeWidth={0.6} />
        ))}
        <circle cx={CX} cy={13} r={5} fill={t.light} stroke={t.dark} strokeWidth={0.7} />
      </g>
    );
  },
  base: () => {
    const s = tone("#b9ad98");
    return (
      <g>
        <rect x={0} y={HEIGHT - 10} width={W} height={10} fill="#cfc3a8" />
        <rect x={CX - 78} y={GROUND} width={156} height={12} fill={s.light} stroke={s.dark} strokeWidth={0.7} />
        <rect x={CX - 100} y={GROUND + 12} width={200} height={12} fill={s.fill} stroke={s.dark} strokeWidth={0.7} />
      </g>
    );
  },
};

// ---------- Bouddha assis en méditation ----------

const bouddha: Renderer = {
  crackX: () => CX + 40,
  tier: (n, t, _built, uid) => {
    const id = `${uid}-bou-${n}`;
    const petals = Array.from({ length: 11 }, (_, i) => CX - 95 + (190 * i) / 10);
    const curls: [number, number][] = [];
    for (let y = 118; y <= 134; y += 6) for (let x = CX - 26; x <= CX + 26; x += 7) if ((x - CX) ** 2 / 900 + (y - 150) ** 2 / 1296 <= 1) curls.push([x, y]);
    return (
      <>
        <defs>
          <Shade id={id} t={t} />
        </defs>
        {/* halo derrière la tête */}
        <circle cx={CX} cy={150} r={64} fill={t.light} opacity={0.35} stroke={t.light} strokeWidth={2} />
        {/* trône et fleur de lotus */}
        <rect x={CX - 92} y={470} width={184} height={GROUND - 470} fill={`url(#${id})`} stroke={t.dark} strokeWidth={0.8} />
        <line x1={CX - 92} x2={CX + 92} y1={490} y2={490} stroke={t.dark} strokeWidth={1} opacity={0.5} />
        {petals.map((x) => (
          <path key={x} d={`M${x - 11},470 Q${x - 11},440 ${x},430 Q${x + 11},440 ${x + 11},470 Z`} fill={t.light} stroke={t.dark} strokeWidth={0.8} />
        ))}
        {/* buste et robe monastique */}
        <path d={`M${CX - 70},396 Q${CX - 74},300 ${CX - 58},226 Q${CX - 36},210 ${CX - 13},204 L${CX + 13},204 Q${CX + 36},210 ${CX + 58},226 Q${CX + 74},300 ${CX + 70},396 Z`} fill={`url(#${id})`} stroke={t.dark} strokeWidth={0.9} />
        <g fill="none" stroke={t.dark} strokeWidth={1.2} opacity={0.45}>
          <path d={`M${CX - 50},222 Q${CX + 10},300 ${CX + 64},392`} />
          <path d={`M${CX - 30},214 Q${CX + 24},290 ${CX + 70},360`} />
          <path d={`M${CX - 66},300 Q${CX - 50},360 ${CX - 32},392`} />
          <path d={`M${CX + 66},300 Q${CX + 50},360 ${CX + 32},392`} />
        </g>
        {/* jambes croisées */}
        <path d={`M${CX - 106},424 Q${CX - 112},392 ${CX - 78},386 Q${CX},376 ${CX + 78},386 Q${CX + 112},392 ${CX + 106},424 Q${CX},450 ${CX - 106},424 Z`} fill={`url(#${id})`} stroke={t.dark} strokeWidth={0.9} />
        <path d={`M${CX - 70},392 Q${CX - 30},420 ${CX + 40},408 M${CX + 70},392 Q${CX + 30},416 ${CX - 30},412`} fill="none" stroke={t.dark} strokeWidth={1} opacity={0.5} />
        <ellipse cx={CX - 52} cy={404} rx={14} ry={6} fill={t.light} stroke={t.dark} strokeWidth={0.6} />
        <ellipse cx={CX + 52} cy={404} rx={14} ry={6} fill={t.light} stroke={t.dark} strokeWidth={0.6} />
        {/* mains en méditation */}
        <ellipse cx={CX} cy={398} rx={32} ry={11} fill={t.light} stroke={t.dark} strokeWidth={0.8} />
        <path d={`M${CX - 22},396 Q${CX},390 ${CX + 22},396`} fill="none" stroke={t.dark} strokeWidth={0.8} opacity={0.6} />
        {/* cou, tête, oreilles, visage serein */}
        <rect x={CX - 12} y={180} width={24} height={26} fill={t.fill} />
        <path d={`M${CX - 12},194 Q${CX},198 ${CX + 12},194 M${CX - 12},200 Q${CX},204 ${CX + 12},200`} fill="none" stroke={t.dark} strokeWidth={0.8} opacity={0.6} />
        <ellipse cx={CX - 31} cy={160} rx={7} ry={21} fill={t.fill} stroke={t.dark} strokeWidth={0.7} />
        <ellipse cx={CX + 31} cy={160} rx={7} ry={21} fill={t.fill} stroke={t.dark} strokeWidth={0.7} />
        <ellipse cx={CX} cy={150} rx={30} ry={36} fill={`url(#${id})`} stroke={t.dark} strokeWidth={0.9} />
        <ellipse cx={CX} cy={108} rx={16} ry={14} fill={t.fill} stroke={t.dark} strokeWidth={0.8} />
        {[-8, 0, 8].flatMap((dx) => [100, 110].map((y) => <circle key={`u${dx}-${y}`} cx={CX + dx} cy={y} r={3} fill={t.dark} opacity={0.45} />))}
        {curls.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={2.8} fill={t.dark} opacity={0.4} />
        ))}
        <g fill="none" stroke={t.dark} strokeWidth={1.3} strokeLinecap="round">
          <path d={`M${CX - 21},148 Q${CX - 13},153 ${CX - 5},148`} />
          <path d={`M${CX + 5},148 Q${CX + 13},153 ${CX + 21},148`} />
          <path d={`M${CX - 22},140 Q${CX - 13},135 ${CX - 4},140`} opacity={0.6} />
          <path d={`M${CX + 4},140 Q${CX + 13},135 ${CX + 22},140`} opacity={0.6} />
          <path d={`M${CX},146 L${CX - 3},164 L${CX + 3},165`} opacity={0.6} />
          <path d={`M${CX - 8},173 Q${CX},177 ${CX + 8},173`} />
        </g>
        <circle cx={CX} cy={139} r={1.8} fill={t.dark} />
      </>
    );
  },
  crown: (built, _uid, grey) => {
    const t = built ? GOLD : grey;
    return (
      <g className={built ? "crown built" : "crown"}>
        {built && <circle cx={CX} cy={150} r={72} fill="none" stroke={GOLD.light} strokeWidth={4} opacity={0.7} />}
        <path d={`M${CX},64 C${CX + 9},78 ${CX + 8},88 ${CX + 4},95 L${CX - 4},95 C${CX - 8},88 ${CX - 9},78 ${CX},64 Z`} fill={t.fill} stroke={t.dark} strokeWidth={0.8} />
      </g>
    );
  },
  base: () => (
    <g>
      <rect x={0} y={GROUND} width={W} height={HEIGHT - GROUND} fill="#8a9a6a" />
      <rect x={CX - 104} y={GROUND} width={208} height={10} fill="#b9ad98" stroke="#8c8270" strokeWidth={0.7} />
    </g>
  ),
};

// ---------- Fusée ----------

const STAGES: { y0: number; y1: number; w: number }[] = [
  { y0: 330, y1: 498, w: 62 }, // premier étage
  { y0: 214, y1: 318, w: 50 }, // deuxième étage
  { y0: 146, y1: 204, w: 42 }, // troisième étage
];

const fusee: Renderer = {
  crackX: () => CX + 12,
  tier: (n, t, _built, uid) => {
    const id = `${uid}-fus-${n}`;
    const [s1, s2, s3] = STAGES;
    const body = (s: { y0: number; y1: number; w: number }) => (
      <rect x={CX - s.w / 2} y={s.y0} width={s.w} height={s.y1 - s.y0} fill={`url(#${id})`} stroke={t.dark} strokeWidth={0.9} />
    );
    const ring = (y: number, w: number) => <rect x={CX - w / 2} y={y} width={w} height={5} fill={t.light} stroke={t.dark} strokeWidth={0.6} />;
    return (
      <>
        <defs>
          <Shade id={id} t={t} />
        </defs>
        {/* ailerons et tuyères */}
        {[-1, 1].map((s) => (
          <path key={s} d={`M${CX + (s * s1.w) / 2},452 L${CX + s * (s1.w / 2 + 26)},${GROUND} L${CX + (s * s1.w) / 2},${GROUND - 12} Z`} fill={t.dark} stroke={t.dark} strokeWidth={0.6} />
        ))}
        {[-20, 0, 20].map((dx) => (
          <path key={dx} d={`M${CX + dx - 6},498 L${CX + dx + 6},498 L${CX + dx + 9},${GROUND} L${CX + dx - 9},${GROUND} Z`} fill={t.dark} stroke={t.dark} strokeWidth={0.6} />
        ))}
        {body(s1)}
        {/* damier de repérage du roulis */}
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={CX - s1.w / 2 + (i * s1.w) / 4} y={i % 2 ? 340 : 354} width={s1.w / 4} height={14} fill={t.dark} opacity={0.55} />
        ))}
        {[400, 440].map((y) => ring(y, s1.w))}
        <line x1={CX + 8} x2={CX + 8} y1={372} y2={496} stroke={t.light} strokeWidth={2} opacity={0.6} />
        {/* inter-étage, deuxième étage */}
        <path d={`M${CX - s1.w / 2},330 L${CX - s2.w / 2},318 L${CX + s2.w / 2},318 L${CX + s1.w / 2},330 Z`} fill={t.dark} />
        {body(s2)}
        {ring(250, s2.w)}
        {ring(286, s2.w)}
        {/* inter-étage, troisième étage et hublots */}
        <path d={`M${CX - s2.w / 2},214 L${CX - s3.w / 2},204 L${CX + s3.w / 2},204 L${CX + s2.w / 2},214 Z`} fill={t.dark} />
        {body(s3)}
        {[-10, 10].map((dx) => (
          <circle key={dx} cx={CX + dx} cy={172} r={5} fill={t.dark} stroke={t.light} strokeWidth={1.4} />
        ))}
        {/* capsule et tour de sauvetage */}
        <path d={`M${CX - s3.w / 2},146 L${CX - 9},104 L${CX + 9},104 L${CX + s3.w / 2},146 Z`} fill={`url(#${id})`} stroke={t.dark} strokeWidth={0.9} />
        <circle cx={CX} cy={128} r={4} fill={t.dark} stroke={t.light} strokeWidth={1.2} />
        <path d={`M${CX - 6},104 L${CX - 2},72 M${CX + 6},104 L${CX + 2},72 M${CX - 5},96 L${CX + 4},88 M${CX + 5},96 L${CX - 4},88 M${CX - 4},84 L${CX + 3},76`} stroke={t.dark} strokeWidth={1.2} />
        <path d={`M${CX - 3},72 L${CX},62 L${CX + 3},72 Z`} fill={t.dark} />
      </>
    );
  },
  crown: (built) =>
    built ? (
      <g className="crown built">
        {[
          [40, 40],
          [216, 30],
          [204, 96],
          [58, 118],
          [30, 200],
          [230, 180],
        ].map(([x, y]) => (
          <path key={`${x}-${y}`} d={`M${x},${y - 7} L${x + 2},${y - 2} L${x + 7},${y} L${x + 2},${y + 2} L${x},${y + 7} L${x - 2},${y + 2} L${x - 7},${y} L${x - 2},${y - 2} Z`} fill={GOLD.light} />
        ))}
        <path d={`M${CX - 30},${GROUND} Q${CX - 26},${GROUND + 22} ${CX},${HEIGHT} Q${CX + 26},${GROUND + 22} ${CX + 30},${GROUND} Z`} fill="#f0a43a" opacity={0.9} />
        <path d={`M${CX - 16},${GROUND} Q${CX - 12},${GROUND + 14} ${CX},${HEIGHT - 6} Q${CX + 12},${GROUND + 14} ${CX + 16},${GROUND} Z`} fill="#fde58a" />
      </g>
    ) : null,
  base: () => (
    <g>
      <rect x={0} y={GROUND} width={W} height={HEIGHT - GROUND} fill="#9a9893" />
      <rect x={CX - 40} y={GROUND} width={80} height={HEIGHT - GROUND} fill="#5d5b57" />
      <rect x={0} y={GROUND} width={W} height={4} fill="#c4c1ba" />
    </g>
  ),
};

// ---------- Tornade ----------

const T_TOP = 44;
const twHalf = (y: number) => 7 + 112 * Math.pow((GROUND - y) / (GROUND - T_TOP), 1.5);
const twX = (y: number) => CX + 12 * Math.sin((GROUND - y) / 70);

const tornade: Renderer = {
  crackX: () => CX + 4,
  tier: (n, t, _built, uid) => {
    const id = `${uid}-tor-${n}`;
    const ys: number[] = [];
    for (let y = GROUND; y >= T_TOP; y -= 6) ys.push(y);
    const left = ys.map((y) => `${(twX(y) - twHalf(y)).toFixed(1)},${y}`);
    const right = [...ys].reverse().map((y) => `${(twX(y) + twHalf(y)).toFixed(1)},${y}`);
    const swirls: string[] = [];
    for (let y = GROUND - 8, i = 0; y > T_TOP + 6; y -= 13, i++) {
      const h = twHalf(y);
      const x = twX(y);
      swirls.push(`M${(x - h * 0.95).toFixed(1)},${y} Q${x.toFixed(1)},${(y + 4 + h * 0.08).toFixed(1)} ${(x + h * 0.95).toFixed(1)},${(y - 3).toFixed(1)}`);
    }
    return (
      <>
        <defs>
          <linearGradient id={id} x1="0" x2="1">
            <stop offset="0" stopColor={t.light} />
            <stop offset="0.45" stopColor={t.fill} />
            <stop offset="1" stopColor={t.dark} />
          </linearGradient>
        </defs>
        <path d={`M${left.join(" L")} L${right.join(" L")} Z`} fill={`url(#${id})`} opacity={0.92} />
        <g fill="none" strokeLinecap="round">
          {swirls.map((d, i) => (
            <path key={i} d={d} stroke={i % 2 ? t.dark : t.light} strokeWidth={i % 2 ? 1.6 : 2.2} opacity={i % 2 ? 0.5 : 0.75} />
          ))}
        </g>
      </>
    );
  },
  crown: (built, _uid, grey) => {
    const c = built ? tone("#3b3f63") : grey;
    const blobs: [number, number, number][] = [
      [38, 38, 22],
      [80, 28, 26],
      [130, 22, 28],
      [180, 28, 26],
      [222, 38, 22],
      [130, 44, 24],
    ];
    return (
      <g className={built ? "crown built" : "crown"}>
        {blobs.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill={i === blobs.length - 1 ? c.dark : c.fill} opacity={0.95} />
        ))}
        {blobs.slice(0, 5).map(([x, y, r], i) => (
          <circle key={`h${i}`} cx={x - r * 0.25} cy={y - r * 0.3} r={r * 0.55} fill={c.light} opacity={0.35} />
        ))}
        {built && <path d="M206,52 L196,76 L206,76 L192,106 L218,70 L208,70 L218,52 Z" fill={GOLD.light} stroke={GOLD.dark} strokeWidth={1} />}
      </g>
    );
  },
  base: () => {
    const rnd = seeded(5);
    const debris = Array.from({ length: 18 }, () => [twX(GROUND) + (rnd() - 0.5) * 120, GROUND - 4 + rnd() * 14, 1.5 + rnd() * 2.5]);
    return (
      <g>
        <rect x={0} y={GROUND} width={W} height={HEIGHT - GROUND} fill="#b59a62" />
        <rect x={0} y={GROUND + 10} width={W} height={HEIGHT - GROUND - 10} fill="#8f7a4c" opacity={0.5} />
        <ellipse cx={twX(GROUND)} cy={GROUND + 2} rx={52} ry={10} fill="#8a7a62" opacity={0.6} />
        {debris.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="#5e4d36" opacity={0.7} />
        ))}
      </g>
    );
  },
};

// ---------- Massif Tamu : volcan bouclier sous-marin ----------
// Un dôme très large et très bas (exagéré verticalement ici), fait de coulées de basalte
// empilées, éteint depuis environ 145 millions d'années, sommet à près de 2 000 m sous la surface.

const YS = 82; // sommet du dôme
const SHIELD = 0.4; // bien en dessous de 1 : dôme large et plat, comme un volcan bouclier
const tamuHalf = (y: number) => {
  if (y <= YS) return 0;
  const h = 134 * Math.pow((y - YS) / (GROUND - YS), SHIELD);
  return h * (1 + 0.025 * Math.sin(y / 9)); // lobes de coulées
};
/** Hauteur du dôme à l'abscisse x (inverse de tamuHalf, sans les lobes). */
const tamuY = (x: number) => YS + (GROUND - YS) * Math.pow(Math.min(1, Math.abs(x - CX) / 134), 1 / SHIELD);

const DOME = (() => {
  const left: string[] = [];
  const right: string[] = [];
  for (let y = GROUND; y >= YS; y -= 4) {
    left.push(`${(CX - tamuHalf(y)).toFixed(1)},${y}`);
    right.unshift(`${(CX + tamuHalf(y)).toFixed(1)},${y}`);
  }
  return `M${left.join(" L")} L${CX},${YS - 2} L${right.join(" L")} Z`;
})();
const STRATA = [16, 36, 60, 88, 120, 156, 196, 240, 288, 340].map((d) => {
  const pts: string[] = [];
  for (let x = CX - 150; x <= CX + 150; x += 6) pts.push(`${x},${(tamuY(x) + d).toFixed(1)}`);
  return `M${pts.join(" L")}`;
});
const CHANNELS = [-0.8, -0.45, -0.15, 0.2, 0.5, 0.85].map((f, i) => {
  const x0 = CX + f * 18;
  const pts: string[] = [];
  for (let k = 0; k <= 12; k++) {
    const x = x0 + f * k * 9 + Math.sin(k + i) * 2;
    pts.push(`${x.toFixed(1)},${(tamuY(x) + 4 + k * 2).toFixed(1)}`);
  }
  return `M${pts.join(" L")}`;
});
const PILLOWS = (() => {
  const rnd = seeded(97);
  const out: { x: number; y: number; rx: number; ry: number }[] = [];
  while (out.length < 44) {
    const y = 150 + rnd() * 350;
    const side = rnd() < 0.5 ? -1 : 1;
    const x = CX + side * (tamuHalf(y) - 5 - rnd() * 16);
    out.push({ x, y, rx: 5 + rnd() * 4, ry: 3.5 + rnd() * 2.5 });
  }
  return out;
})();
const SNOW = (() => {
  const rnd = seeded(61);
  return Array.from({ length: 90 }, () => ({ x: rnd() * W, y: LAYOUT.crown + rnd() * (GROUND - LAYOUT.crown), r: 0.6 + rnd() * 1.1 }));
})();
const RAYS = [
  [34, 62, 6, 470],
  [92, 120, 58, 520],
  [168, 186, 150, 480],
  [214, 240, 214, 520],
];
const FISH: [number, number, number][] = [
  [204, 150, 1],
  [218, 144, 0.9],
  [226, 158, 1],
  [212, 166, 0.85],
  [238, 150, 0.8],
  [232, 170, 0.75],
  [246, 162, 0.7],
];

const tamu: Renderer = {
  crackX: () => CX + 22,
  defs: (uid) => (
    <>
      <linearGradient id={`${uid}-tamu-water`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={LAYOUT.crown} y2={GROUND}>
        <stop offset="0" stopColor="#1f7aa6" />
        <stop offset="0.55" stopColor="#123f6e" />
        <stop offset="1" stopColor="#081a33" />
      </linearGradient>
      <clipPath id={`${uid}-tamu-dome`}>
        <path d={DOME} />
      </clipPath>
    </>
  ),
  tier: (n, t, built, uid) => {
    const id = `${uid}-tamu-${n}`;
    const water = built ? `url(#${uid}-tamu-water)` : t.light;
    const glow = built ? "#e8f7ff" : t.fill;
    return (
      <>
        <defs>
          <linearGradient id={id} x1="0" x2="1">
            <stop offset="0" stopColor={t.dark} />
            <stop offset="0.35" stopColor={t.light} />
            <stop offset="0.6" stopColor={t.fill} />
            <stop offset="1" stopColor={t.dark} />
          </linearGradient>
        </defs>
        {/* l'océan, ses rais de lumière et sa neige marine */}
        <rect x={0} y={LAYOUT.crown} width={W} height={GROUND - LAYOUT.crown} fill={water} opacity={built ? 1 : 0.55} />
        {RAYS.map(([a, b, c, d], i) => (
          <path key={i} d={`M${a},${LAYOUT.crown} L${b},${LAYOUT.crown} L${d - (c - a) * 0.3},${GROUND} L${c - 30},${GROUND} Z`} fill={glow} opacity={built ? 0.07 : 0.12} />
        ))}
        {SNOW.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={glow} opacity={built ? 0.55 : 0.5} />
        ))}
        {/* bulles qui remontent le long du flanc ouest */}
        {[
          [26, 250, 3],
          [31, 214, 2.2],
          [24, 180, 2.8],
          [30, 140, 1.8],
          [27, 104, 2.4],
        ].map(([x, y, r]) => (
          <circle key={y} cx={x} cy={y} r={r} fill="none" stroke={glow} strokeWidth={0.9} opacity={0.7} />
        ))}
        {/* le dôme de basalte */}
        <path d={DOME} fill={`url(#${id})`} stroke={t.dark} strokeWidth={1} />
        <g clipPath={`url(#${uid}-tamu-dome)`}>
          {STRATA.map((d, i) => (
            <g key={i}>
              <path d={d} fill="none" stroke={t.dark} strokeWidth={1.3} opacity={0.38} />
              <path d={d} fill="none" stroke={t.light} strokeWidth={0.8} opacity={0.3} transform="translate(0,2.5)" />
            </g>
          ))}
          {CHANNELS.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={t.dark} strokeWidth={1.2} opacity={0.3} />
          ))}
          {/* voile de sédiments au sommet */}
          <path d={`M${CX - 40},${tamuY(CX - 40)} Q${CX},${YS - 8} ${CX + 40},${tamuY(CX + 40)} Q${CX},${YS + 14} ${CX - 40},${tamuY(CX - 40)} Z`} fill={t.light} opacity={0.35} />
        </g>
        {/* laves en coussins sur les flancs */}
        {PILLOWS.map((p, i) => (
          <g key={i}>
            <ellipse cx={p.x} cy={p.y} rx={p.rx} ry={p.ry} fill={t.fill} stroke={t.dark} strokeWidth={0.7} />
            <ellipse cx={p.x - p.rx * 0.3} cy={p.y - p.ry * 0.35} rx={p.rx * 0.45} ry={p.ry * 0.35} fill={t.light} opacity={0.55} />
          </g>
        ))}
        {/* banc de poissons et méduse */}
        {FISH.map(([x, y, s], i) => (
          <path
            key={i}
            d={`M${x},${y} q${6 * s},${-3.5 * s} ${11 * s},0 q${-5 * s},${3.5 * s} ${-11 * s},0 Z M${x + 11 * s},${y} l${4 * s},${-3 * s} l0,${6 * s} Z`}
            fill={built ? "#d6eef6" : t.dark}
            opacity={built ? 0.85 : 0.45}
          />
        ))}
        <g opacity={built ? 0.75 : 0.45}>
          <path d="M36,168 q10,-14 20,0 Z" fill={built ? "#e7b6e0" : t.dark} />
          {[39, 43, 47, 51].map((x, i) => (
            <path key={x} d={`M${x},168 q${i % 2 ? 2 : -2},6 0,12 q${i % 2 ? -2 : 2},5 0,9`} fill="none" stroke={built ? "#e7b6e0" : t.dark} strokeWidth={0.9} />
          ))}
        </g>
      </>
    );
  },
  crown: (built, _uid, grey) => {
    const SURF = 22;
    const waves = `M0,${SURF} q8,-3 16,0 t16,0 t16,0 t16,0 t16,0 t16,0 t16,0 t16,0 t16,0 t16,0 t16,0 t16,0 t16,0 t16,0 t16,0 t16,0 t16,0`;
    if (!built) {
      return (
        <g className="crown">
          <rect x={0} y={SURF} width={W} height={LAYOUT.crown - SURF} fill={grey.light} opacity={0.55} />
          <path d={waves} fill="none" stroke={grey.dark} strokeWidth={1.2} />
        </g>
      );
    }
    return (
      <g className="crown">
        <defs>
          <linearGradient id="tamu-surface" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#7fd3ea" />
            <stop offset="1" stopColor="#1f7aa6" />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={W} height={SURF} fill="#e3f3fb" />
        <circle cx={44} cy={10} r={9} fill={GOLD.light} />
        <rect x={0} y={SURF} width={W} height={LAYOUT.crown - SURF} fill="url(#tamu-surface)" />
        {[30, 90, 150, 210].map((x) => (
          <path key={x} d={`M${x},${SURF} L${x + 14},${SURF} L${x + 4},${LAYOUT.crown} L${x - 10},${LAYOUT.crown} Z`} fill="#ffffff" opacity={0.12} />
        ))}
        <path d={`${waves} L${W},${SURF + 4} L0,${SURF + 4} Z`} fill="#bfe8f5" opacity={0.6} />
        <path d={waves} fill="none" stroke="#ffffff" strokeWidth={1.4} />
        {/* navire de forage scientifique, derrick au milieu */}
        <g>
          <path d={`M150,${SURF - 6} L206,${SURF - 6} L200,${SURF + 1} L156,${SURF + 1} Z`} fill="#f2f2ee" stroke="#5b5f66" strokeWidth={0.8} />
          <rect x={154} y={SURF - 10} width={12} height={4} fill="#f2f2ee" stroke="#5b5f66" strokeWidth={0.6} />
          <path d={`M176,${SURF - 6} L180,${SURF - 20} L184,${SURF - 6} M177,${SURF - 10} L183,${SURF - 14} M183,${SURF - 10} L177,${SURF - 14}`} fill="none" stroke="#b5452f" strokeWidth={1} />
          <line x1={150} x2={206} y1={SURF - 3} y2={SURF - 3} stroke="#b5452f" strokeWidth={1.2} />
          <line x1={180} x2={180} y1={SURF + 1} y2={LAYOUT.crown + 12} stroke="#ffffff" strokeWidth={0.8} strokeDasharray="2 3" opacity={0.7} />
        </g>
      </g>
    );
  },
  base: () => {
    const rnd = seeded(13);
    return (
      <g>
        <rect x={0} y={GROUND} width={W} height={HEIGHT - GROUND} fill="#4a4740" />
        <rect x={0} y={GROUND} width={W} height={6} fill="#6c675b" />
        {[GROUND + 13, GROUND + 22, GROUND + 30].map((y, i) => (
          <path key={y} d={`M${i * 9},${y} q12,-3 24,0 t24,0 t24,0 t24,0 t24,0 t24,0 t24,0 t24,0 t24,0 t24,0 t24,0`} fill="none" stroke="#6c675b" strokeWidth={0.8} opacity={0.6} />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <ellipse key={i} cx={10 + rnd() * 240} cy={GROUND + 4 + rnd() * 4} rx={3 + rnd() * 4} ry={2 + rnd() * 2} fill="#2f2c28" />
        ))}
      </g>
    );
  },
};

export const MORE: Record<"pagode" | "bouddha" | "fusee" | "tornade" | "tamu", Renderer> = { pagode, bouddha, fusee, tornade, tamu };
