// Monuments du monde : tour Eiffel, statue de la Liberté, stalactites de glace, mosquée de Djenné, moaï.
// Chaque renderer dessine le monument entier aux couleurs du palier ; Column découpe la bande du palier.

import type { ReactNode } from "react";
import { CX, GROUND, HEIGHT, LAYOUT, seeded, tone } from "../lib/monument";
import { Bird, Cloud, type Renderer, Shade } from "./monuments";

const GOLD = tone("#d4a531");
const W = LAYOUT.width;

function polyline(points: [number, number][]): string {
  return points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}
function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let v = from; step > 0 ? v <= to : v >= to; v += step) out.push(v);
  return out;
}

// ---------- Tour Eiffel ----------

const E_TOP = 40;
const P1 = 421; // premier étage
const P2 = 331; // deuxième étage
const P3 = 80; // troisième étage
const eh = (y: number) => 4 + 111 * Math.pow(Math.max(0, y - E_TOP) / (GROUND - E_TOP), 2.2);
/** Bord intérieur des piliers, qui se rejoignent au deuxième étage. */
const ein = (y: number) => (y <= P2 ? 0 : eh(y) * 0.64 * ((y - P2) / (GROUND - P2)));

const TWINKLES = (() => {
  const rnd = seeded(404);
  return Array.from({ length: 46 }, () => {
    const y = E_TOP + 20 + rnd() * (GROUND - E_TOP - 30);
    return { x: CX + (rnd() * 2 - 1) * eh(y) * 0.95, y };
  });
})();

const eiffel: Renderer = {
  crackX: () => CX + 8,
  ambient: (uid, level) => ({
    back: (
      <>
        <Cloud x={50} y={130} s={1.1} />
        <Cloud x={210} y={210} s={0.9} opacity={0.65} />
      </>
    ),
    front: (
      <>
        <defs>
          <linearGradient id={`${uid}-beam`} x1="0" x2="1">
            <stop offset="0" stopColor="#fff3b0" stopOpacity={0.75} />
            <stop offset="1" stopColor="#fff3b0" stopOpacity={0} />
          </linearGradient>
        </defs>
        <g className="anim-beam">
          <path d={`M${CX},${E_TOP - 11} L${CX + 150},${E_TOP - 26} L${CX + 150},${E_TOP + 4} Z`} fill={`url(#${uid}-beam)`} />
          <path d={`M${CX},${E_TOP - 11} L${CX - 150},${E_TOP - 26} L${CX - 150},${E_TOP + 4} Z`} fill={`url(#${uid}-beam)`} opacity={0.45} />
        </g>
        {level >= LAYOUT.levels &&
          TWINKLES.map((p, i) => <circle key={i} className="anim-twinkle" cx={p.x} cy={p.y} r={1.6} fill="#fff6c8" opacity={0} />)}
      </>
    ),
  }),
  numeralOnPanel: true,
  tier: (_n, t) => {
    const ys = range(GROUND, E_TOP, -6);
    const outerL = polyline(ys.map((y) => [CX - eh(y), y]));
    const outerR = polyline(ys.map((y) => [CX + eh(y), y]));
    const innerYs = range(GROUND, P2, -6);
    const innerL = polyline(innerYs.map((y) => [CX - ein(y), y]));
    const innerR = polyline(innerYs.map((y) => [CX + ein(y), y]));
    const braces: ReactNode[] = [];
    // croisillons : dans chaque pilier sous le 2e étage, sur toute la largeur au-dessus
    let k = 0;
    for (let y = GROUND; y > E_TOP + 8; ) {
      const step = Math.max(7, (y - E_TOP) * 0.06);
      const y2 = y - step;
      if (y2 > P2) {
        for (const s of [-1, 1]) {
          const [a1, a2] = [CX + s * eh(y), CX + s * ein(y)];
          const [b1, b2] = [CX + s * eh(y2), CX + s * ein(y2)];
          braces.push(<path key={k++} d={`M${a1},${y} L${b2},${y2} M${a2},${y} L${b1},${y2}`} />);
        }
      } else {
        braces.push(<path key={k++} d={`M${CX - eh(y)},${y} L${CX + eh(y2)},${y2} M${CX + eh(y)},${y} L${CX - eh(y2)},${y2}`} />);
      }
      y = y2;
    }
    const arch = `M${CX - ein(GROUND)},${GROUND} Q${CX},${P1 + 8} ${CX + ein(GROUND)},${GROUND}`;
    const platform = (y: number, h: number, extra: number) => (
      <rect x={CX - eh(y) - extra} y={y - h / 2} width={2 * (eh(y) + extra)} height={h} fill={t.fill} stroke={t.dark} strokeWidth={0.8} />
    );
    return (
      <>
        <path d={`${polyline([...ys.map((y): [number, number] => [CX - eh(y), y]), ...[...ys].reverse().map((y): [number, number] => [CX + eh(y), y])])} Z`} fill={t.fill} opacity={0.16} />
        <g stroke={t.dark} strokeWidth={0.9} opacity={0.75} fill="none">
          {braces}
        </g>
        <g fill="none" stroke={t.fill} strokeLinecap="round">
          <path d={outerL} strokeWidth={4} />
          <path d={outerR} strokeWidth={4} />
          <path d={innerL} strokeWidth={3} />
          <path d={innerR} strokeWidth={3} />
          <path d={arch} strokeWidth={4} />
          <path d={arch} strokeWidth={1.2} stroke={t.light} />
        </g>
        {platform(P1, 9, 10)}
        {platform(P2, 7, 7)}
        {platform(P3, 5, 6)}
      </>
    );
  },
  crown: (built, _uid, grey) => {
    const t = built ? GOLD : grey;
    return (
      <g className={built ? "crown built" : "crown"}>
        {built && <circle cx={CX} cy={20} r={16} fill={GOLD.light} opacity={0.4} />}
        <path d={`M${CX - eh(LAYOUT.crown)},${LAYOUT.crown} L${CX - 3},${E_TOP - 8} L${CX + 3},${E_TOP - 8} L${CX + eh(LAYOUT.crown)},${LAYOUT.crown} Z`} fill={t.fill} stroke={t.dark} strokeWidth={0.6} />
        <rect x={CX - 5} y={E_TOP - 14} width={10} height={7} fill={t.light} stroke={t.dark} strokeWidth={0.6} />
        <line x1={CX} x2={CX} y1={E_TOP - 14} y2={8} stroke={t.dark} strokeWidth={1.6} />
      </g>
    );
  },
  base: () => (
    <g>
      <rect x={0} y={GROUND} width={W} height={HEIGHT - GROUND} fill="#7ea350" />
      <rect x={0} y={GROUND} width={W} height={5} fill="#d8c9a3" />
      <path d={`M${CX - 30},${HEIGHT} L${CX - 12},${GROUND + 5} L${CX + 12},${GROUND + 5} L${CX + 30},${HEIGHT} Z`} fill="#d8c9a3" />
    </g>
  ),
};

// ---------- Statue de la Liberté ----------

const liberte: Renderer = {
  crackX: () => CX - 12,
  ambient: () => ({
    front: (
      <>
        <Bird x={40} y={150} scale={1.1} color="#5b6470" />
        <Bird x={215} y={240} color="#5b6470" />
      </>
    ),
  }),
  tier: (n, t, _built, uid) => {
    const id = `${uid}-lib-${n}`;
    const rays = [-160, -135, -112, -90, -68, -45, -20].map((deg) => {
      const r = (deg * Math.PI) / 180;
      return `M${CX + Math.cos(r) * 14},${146 + Math.sin(r) * 14} L${CX + Math.cos(r) * 32},${146 + Math.sin(r) * 32}`;
    });
    return (
      <>
        <defs>
          <Shade id={id} t={t} />
        </defs>
        {/* fort en étoile, socle et piédestal */}
        <path d={`M14,${GROUND} L30,488 L${CX - 40},494 L${CX},482 L${CX + 40},494 L${W - 30},488 L${W - 14},${GROUND} Z`} fill={t.dark} />
        <rect x={CX - 82} y={452} width={164} height={40} fill={`url(#${id})`} stroke={t.dark} strokeWidth={0.8} />
        <rect x={CX - 60} y={386} width={120} height={66} fill={`url(#${id})`} stroke={t.dark} strokeWidth={0.8} />
        {[-38, -13, 13, 38].map((dx) => (
          <rect key={dx} x={CX + dx - 6} y={400} width={12} height={30} rx={5} fill={t.dark} opacity={0.55} />
        ))}
        <rect x={CX - 70} y={372} width={140} height={14} fill={t.light} stroke={t.dark} strokeWidth={0.8} />
        {/* robe drapée */}
        <path d={`M${CX - 42},372 L${CX - 30},192 Q${CX},176 ${CX + 28},190 L${CX + 44},372 Z`} fill={`url(#${id})`} stroke={t.dark} strokeWidth={0.9} />
        <g stroke={t.dark} strokeWidth={1.2} opacity={0.45} fill="none">
          <path d={`M${CX - 20},204 Q${CX - 30},290 ${CX - 34},370`} />
          <path d={`M${CX - 6},198 Q${CX - 10},290 ${CX - 12},372`} />
          <path d={`M${CX + 10},200 Q${CX + 14},290 ${CX + 18},372`} />
          <path d={`M${CX + 22},196 Q${CX + 30},280 ${CX + 32},370`} />
          <path d={`M${CX - 30},240 Q${CX},262 ${CX + 32},236`} />
        </g>
        {/* bras gauche et tablette */}
        <path d={`M${CX - 26},198 L${CX - 36},252`} stroke={t.fill} strokeWidth={9} strokeLinecap="round" />
        <path d={`M${CX - 50},236 L${CX - 30},232 L${CX - 27},292 L${CX - 47},296 Z`} fill={t.light} stroke={t.dark} strokeWidth={0.9} />
        {/* bras levé et flambeau */}
        <path d={`M${CX + 20},192 L${CX + 33},118 L${CX + 38},70`} stroke={t.fill} strokeWidth={11} strokeLinecap="round" fill="none" />
        <path d={`M${CX + 20},192 L${CX + 33},118 L${CX + 38},70`} stroke={t.dark} strokeWidth={1} opacity={0.4} fill="none" />
        <path d={`M${CX + 31},60 L${CX + 45},60 L${CX + 42},74 L${CX + 34},74 Z`} fill={t.fill} stroke={t.dark} strokeWidth={0.8} />
        {/* tête et couronne à sept rayons */}
        <rect x={CX - 7} y={164} width={14} height={14} fill={t.fill} />
        <ellipse cx={CX} cy={154} rx={13} ry={16} fill={`url(#${id})`} stroke={t.dark} strokeWidth={0.9} />
        <path d={`M${CX - 14},146 Q${CX},136 ${CX + 14},146`} fill="none" stroke={t.dark} strokeWidth={2.4} />
        <path d={rays.join(" ")} stroke={t.fill} strokeWidth={3.5} strokeLinecap="round" />
        <path d={rays.join(" ")} stroke={t.dark} strokeWidth={0.6} opacity={0.6} />
      </>
    );
  },
  crown: (built, _uid, grey) => {
    const t = built ? tone("#f0a43a") : grey;
    return (
      <g className={built ? "crown built" : "crown"}>
        {built && <circle cx={CX + 38} cy={42} r={22} fill={GOLD.light} opacity={0.35} />}
        <g className="anim-flame" style={{ transformOrigin: `${CX + 38}px 58px` }}>
        <path d={`M${CX + 38},22 C${CX + 50},38 ${CX + 48},52 ${CX + 44},58 L${CX + 32},58 C${CX + 28},50 ${CX + 30},36 ${CX + 38},22 Z`} fill={t.fill} stroke={built ? GOLD.dark : t.dark} strokeWidth={0.8} />
        <path d={`M${CX + 38},34 C${CX + 43},44 ${CX + 42},52 ${CX + 40},56 L${CX + 36},56 C${CX + 34},50 ${CX + 34},42 ${CX + 38},34 Z`} fill={built ? GOLD.light : t.light} />
        </g>
      </g>
    );
  },
  base: () => (
    <g>
      <rect x={0} y={GROUND} width={W} height={HEIGHT - GROUND} fill="#4f86a8" />
      {range(GROUND + 9, HEIGHT - 4, 9).map((y, i) => (
        <path key={y} className="anim-wave" d={`M${(i % 2) * 14 - 20},${y} q10,-4 20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0`} fill="none" stroke="#a9cfe0" strokeWidth={1} opacity={0.7} />
      ))}
      <rect x={10} y={GROUND} width={W - 20} height={5} fill="#7a8a5a" />
    </g>
  ),
};

// ---------- Stalactites de glace ----------
// Elles pendent d'un rebord enneigé : la plus longue descend jusqu'au palier I,
// chaque palier gravi ajoute de l'épaisseur vers le rebord.

const LEDGE = 62;
/** [centre, largeur au rebord, pointe] */
const ICICLES: [number, number, number][] = [
  [36, 20, 214],
  [224, 22, 246],
  [62, 28, 304],
  [198, 30, 336],
  [150, 18, 262],
  [110, 20, 286],
  [92, 36, 404],
  [170, 40, 432],
  [CX, 56, 498],
];
function icicle([cx, w, tip]: [number, number, number], seed: number) {
  const left: string[] = [];
  const right: string[] = [];
  const rings: number[] = [];
  for (let y = LEDGE; y < tip; y += 7) {
    const f = (y - LEDGE) / (tip - LEDGE);
    const half = (w / 2) * Math.pow(1 - f, 0.75) * (1 + 0.08 * Math.sin(y / 6 + seed));
    left.push(`${(cx - half).toFixed(1)},${y}`);
    right.unshift(`${(cx + half).toFixed(1)},${y}`);
    if ((y - LEDGE) % 28 === 21) rings.push(y);
  }
  const half = (y: number) => (w / 2) * Math.pow(1 - (y - LEDGE) / (tip - LEDGE), 0.75);
  return { d: `M${left.join(" L")} L${cx},${tip} L${right.join(" L")} Z`, rings, half };
}
const ICE = ICICLES.map((ic, i) => ({ ic, ...icicle(ic, i * 1.7) }));
const ICE_BUBBLES = (() => {
  const rnd = seeded(77);
  return ICE.flatMap(({ ic: [cx, , tip], half }) =>
    Array.from({ length: 4 }, () => {
      const y = LEDGE + 10 + rnd() * (tip - LEDGE) * 0.7;
      return { x: cx + (rnd() - 0.5) * half(y), y, r: 0.8 + rnd() * 1.4 };
    }),
  );
})();

const DRIPS: [number, number][] = [
  [CX, 498],
  [170, 432],
  [92, 404],
];

const glace: Renderer = {
  crackX: () => CX + 10,
  ambient: () => ({
    front: (
      <>
        {DRIPS.map(([x, y], i) => (
          <g key={i}>
            <ellipse className="anim-splash" data-i={i} cx={x} cy={GROUND + 8} rx={10} ry={2.5} fill="none" stroke="#e8f7ff" strokeWidth={1.2} opacity={0} />
            <path className="anim-drop" data-i={i} data-fall={GROUND + 6 - y} d={`M${x},${y} q3.2,5 0,8 q-3.2,-3 0,-8 Z`} fill="#bfe6f7" stroke="#7fb3d1" strokeWidth={0.5} opacity={0} />
          </g>
        ))}
      </>
    ),
  }),
  tier: (n, t, built, uid) => {
    const id = `${uid}-ice-${n}`;
    return (
      <>
        <defs>
          <linearGradient id={id} x1="0" x2="1">
            <stop offset="0" stopColor={t.dark} />
            <stop offset="0.3" stopColor={t.light} />
            <stop offset="0.55" stopColor={t.fill} />
            <stop offset="0.78" stopColor={t.light} />
            <stop offset="1" stopColor={t.dark} />
          </linearGradient>
        </defs>
        {ICE.map(({ ic: [cx, w], d, rings, half }, i) => (
          <g key={i}>
            <path d={d} fill={`url(#${id})`} stroke={t.dark} strokeWidth={0.7} opacity={built ? 0.95 : 0.9} />
            {/* reflet vertical, ondulations de gel, bulles d'air prises dans la glace */}
            <path d={`M${cx - w * 0.14},${LEDGE + 4} L${cx - w * 0.04},${LEDGE + (ICICLES[i][2] - LEDGE) * 0.8}`} stroke="#ffffff" strokeWidth={Math.max(1, w * 0.06)} opacity={0.55} strokeLinecap="round" />
            {rings.map((y) => (
              <path key={y} d={`M${(cx - half(y)).toFixed(1)},${y} Q${cx},${y + 4} ${(cx + half(y)).toFixed(1)},${y}`} fill="none" stroke={t.light} strokeWidth={1} opacity={0.7} />
            ))}
          </g>
        ))}
        {ICE_BUBBLES.map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r={b.r} fill="#ffffff" opacity={0.6} />
        ))}
        {built && (
          <g fill="#ffffff">
            {[
              [70, 120],
              [140, 200],
              [182, 300],
              [96, 360],
              [132, 440],
            ].map(([x, y]) => (
              <path key={`${x}-${y}`} className="anim-sparkle" d={`M${x},${y - 5} L${x + 1.3},${y - 1.3} L${x + 5},${y} L${x + 1.3},${y + 1.3} L${x},${y + 5} L${x - 1.3},${y + 1.3} L${x - 5},${y} L${x - 1.3},${y - 1.3} Z`} opacity={0.9} />
            ))}
          </g>
        )}
      </>
    );
  },
  crown: (built, uid, grey) => {
    const rock = built ? tone("#5b6676") : grey;
    const snow = built ? tone("#f4f8fc") : grey;
    return (
      <g className="crown">
        {built && (
          <>
            <defs>
              <linearGradient id={`${uid}-aurora`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#8a5cd6" stopOpacity={0.15} />
                <stop offset="0.5" stopColor="#4fe0a6" stopOpacity={0.7} />
                <stop offset="1" stopColor="#4fe0a6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <rect x={0} y={0} width={W} height={LEDGE} fill="#132640" />
            <path className="anim-aurora" d={`M-20,30 C50,6 90,40 140,18 S220,8 ${W + 20},26 L${W + 20},48 C210,30 170,52 120,38 S40,30 -20,50 Z`} fill={`url(#${uid}-aurora)`} />
            {[
              [24, 10],
              [180, 6],
              [236, 18],
              [96, 8],
            ].map(([x, y]) => (
              <circle key={x} cx={x} cy={y} r={1.2} fill="#ffffff" />
            ))}
          </>
        )}
        {/* rebord rocheux et sa corniche de neige */}
        <path d={`M0,${LEDGE - 16} L${W},${LEDGE - 18} L${W},${LEDGE} L0,${LEDGE} Z`} fill={rock.fill} stroke={rock.dark} strokeWidth={0.8} />
        <path
          d={`M0,${LEDGE - 14} C20,${LEDGE - 28} 46,${LEDGE - 24} 70,${LEDGE - 26} S120,${LEDGE - 32} 150,${LEDGE - 26} S210,${LEDGE - 30} ${W},${LEDGE - 18} L${W},${LEDGE - 12} L0,${LEDGE - 10} Z`}
          fill={snow.fill}
          stroke={snow.dark}
          strokeWidth={0.6}
        />
        <path d={`M0,${LEDGE} L${W},${LEDGE}`} stroke={snow.light} strokeWidth={3} />
      </g>
    );
  },
  base: () => (
    <g>
      <rect x={0} y={GROUND} width={W} height={HEIGHT - GROUND} fill="#dfe9f2" />
      <ellipse cx={CX} cy={GROUND + 8} rx={70} ry={8} fill="#a9d4ea" stroke="#7fb3d1" strokeWidth={0.8} />
      <path d={`M${CX - 12},${GROUND + 6} Q${CX},${GROUND - 8} ${CX + 12},${GROUND + 6} Z`} fill="#bfe3f3" stroke="#7fb3d1" strokeWidth={0.6} />
      <path d={`M${CX + 30},${GROUND + 20} q3,6 0,9 q-3,-3 0,-9 Z`} fill="#7fb3d1" />
      <rect x={0} y={HEIGHT - 6} width={W} height={6} fill="#c7d6e3" />
    </g>
  ),
};

// ---------- Grande Mosquée de Djenné ----------

const TOWERS: { x: number; w: number; top: number }[] = [
  { x: 34, w: 40, top: 124 },
  { x: CX - 26, w: 52, top: 84 },
  { x: W - 74, w: 40, top: 124 },
];
const BODY_TOP = 258;
const inTower = (x: number, pad = 0) => TOWERS.some((t) => x > t.x - 5 - pad && x < t.x + t.w + 5 + pad);
/** Les tours s'affinent vers le haut, comme les contreforts de banco. */
function towerEdges(tw: { x: number; w: number; top: number }, y: number): [number, number] {
  const f = (GROUND - y) / (GROUND - tw.top);
  const inset = -5 + 11 * f;
  return [tw.x + inset, tw.x + tw.w - inset];
}

const djenne: Renderer = {
  crackX: () => CX + 50,
  ambient: () => ({
    front: (
      <>
        <Bird x={CX} y={60} scale={1.1} />
        <Bird x={70} y={92} />
        <Bird x={196} y={84} scale={0.9} />
      </>
    ),
  }),
  tier: (n, t, _built, uid) => {
    const id = `${uid}-dje-${n}`;
    const pilasters = range(24, W - 24, 15).filter((x) => !inTower(x, 4));
    return (
      <>
        <defs>
          <Shade id={id} t={t} />
        </defs>
        {/* corps de la façade, parapet à pinacles */}
        <rect x={16} y={BODY_TOP} width={W - 32} height={GROUND - BODY_TOP} fill={t.fill} stroke={t.dark} strokeWidth={0.8} />
        {pilasters.map((x) => (
          <g key={x}>
            <rect x={x - 5} y={BODY_TOP - 4} width={10} height={GROUND - BODY_TOP + 4} rx={4} fill={t.light} opacity={0.6} />
            <path d={`M${x - 5},${BODY_TOP - 4} Q${x},${BODY_TOP - 22} ${x + 5},${BODY_TOP - 4} Z`} fill={t.fill} stroke={t.dark} strokeWidth={0.6} />
          </g>
        ))}
        {/* bois de palmier (toron) qui dépassent du banco */}
        <g stroke={t.dark} strokeWidth={2} strokeLinecap="round">
          {range(BODY_TOP + 22, GROUND - 20, 30).flatMap((y, row) =>
            range(28 + (row % 2) * 11, W - 28, 22)
              .filter((x) => !inTower(x, 4))
              .map((x) => <line key={`${x}-${y}`} x1={x - 2} x2={x + 2} y1={y} y2={y} />),
          )}
        </g>
        {/* trois tours */}
        {TOWERS.map((tw) => (
          <g key={tw.x}>
            <path
              d={`M${towerEdges(tw, GROUND)[0]},${GROUND} L${towerEdges(tw, tw.top)[0]},${tw.top} L${towerEdges(tw, tw.top)[1]},${tw.top} L${towerEdges(tw, GROUND)[1]},${GROUND} Z`}
              fill={`url(#${id})`}
              stroke={t.dark}
              strokeWidth={0.9}
            />
            {[0.3, 0.5, 0.7].map((f) => (
              <line key={f} x1={tw.x + tw.w * f} x2={tw.x + tw.w * f} y1={tw.top + 10} y2={GROUND} stroke={t.dark} strokeWidth={1} opacity={0.35} />
            ))}
            {range(tw.top + 16, GROUND - 16, 24).map((y) => (
              <g key={y} stroke={t.dark} strokeWidth={2.2} strokeLinecap="round">
                <line x1={towerEdges(tw, y)[0] - 7} x2={towerEdges(tw, y)[0] + 2} y1={y} y2={y} />
                <line x1={towerEdges(tw, y)[1] - 2} x2={towerEdges(tw, y)[1] + 7} y1={y} y2={y} />
              </g>
            ))}
            <path
              d={`M${towerEdges(tw, tw.top)[0]},${tw.top} Q${tw.x + tw.w / 2},${tw.top - (tw.w > 45 ? 30 : 24)} ${towerEdges(tw, tw.top)[1]},${tw.top} Z`}
              fill={t.fill}
              stroke={t.dark}
              strokeWidth={0.8}
            />
            {[-1, 1].map((sd) => (
              <path
                key={sd}
                d={`M${tw.x + tw.w / 2 + sd * (tw.w / 2 - 7) - 4},${tw.top + 1} Q${tw.x + tw.w / 2 + sd * (tw.w / 2 - 7)},${tw.top - 12} ${tw.x + tw.w / 2 + sd * (tw.w / 2 - 7) + 4},${tw.top + 1} Z`}
                fill={t.fill}
                stroke={t.dark}
                strokeWidth={0.6}
              />
            ))}
          </g>
        ))}
        {/* porte centrale */}
        <path d={`M${CX - 13},${GROUND} V${GROUND - 26} Q${CX},${GROUND - 42} ${CX + 13},${GROUND - 26} V${GROUND} Z`} fill={t.dark} opacity={0.8} />
      </>
    );
  },
  crown: (built, _uid, grey) => {
    const egg = built ? tone("#f6efe0") : grey;
    return (
      <g className={built ? "crown built" : "crown"}>
        {TOWERS.map((tw) => {
          const tip = tw.top - (tw.w > 45 ? 15 : 12);
          return (
            <g key={tw.x}>
              <line x1={tw.x + tw.w / 2} x2={tw.x + tw.w / 2} y1={tip} y2={tip - 10} stroke={built ? GOLD.dark : grey.dark} strokeWidth={1.4} />
              <ellipse cx={tw.x + tw.w / 2} cy={tip - 15} rx={4.5} ry={6} fill={egg.fill} stroke={built ? GOLD.dark : egg.dark} strokeWidth={0.8} />
            </g>
          );
        })}
        {built && <circle cx={CX} cy={52} r={18} fill={GOLD.light} opacity={0.3} />}
      </g>
    );
  },
  base: () => (
    <g>
      <rect x={0} y={GROUND} width={W} height={HEIGHT - GROUND} fill="#c9925a" />
      <rect x={10} y={GROUND} width={W - 20} height={6} fill="#a8703f" />
    </g>
  ),
};

// ---------- Moaï ----------

const AHU_STONES = (() => {
  const rnd = seeded(11);
  const rows = [
    [440, 475],
    [475, GROUND],
  ];
  return rows.flatMap(([y0, y1], r) => {
    const out: string[] = [`M14,${y0} H${W - 14}`];
    for (let x = 14 + rnd() * 20 + r * 10; x < W - 20; x += 22 + rnd() * 18) {
      out.push(`M${x.toFixed(1)},${y0} L${(x + (rnd() - 0.5) * 8).toFixed(1)},${y1}`);
    }
    return out;
  });
})();

const moai: Renderer = {
  crackX: () => CX + 34,
  ambient: () => ({
    back: (
      <>
        <Cloud x={44} y={120} />
        <Cloud x={214} y={70} s={0.8} opacity={0.7} />
      </>
    ),
    front: (
      <>
        <Bird x={210} y={170} color="#4a4f57" />
        <Bird x={40} y={210} scale={0.85} color="#4a4f57" />
        <rect className="anim-sea" x={-30} y={HEIGHT - 8} width={W + 60} height={2} fill="#bfe1f0" opacity={0.8} />
      </>
    ),
  }),
  tier: (n, t, _built, uid) => {
    const id = `${uid}-moa-${n}`;
    return (
      <>
        <defs>
          <Shade id={id} t={t} />
        </defs>
        {/* ahu : la plateforme de pierres ajustées */}
        <rect x={14} y={440} width={W - 28} height={GROUND - 440} fill={t.fill} stroke={t.dark} strokeWidth={0.8} />
        <path d={AHU_STONES.join(" ")} stroke={t.dark} strokeWidth={1} opacity={0.6} fill="none" />
        <rect x={8} y={430} width={W - 16} height={10} fill={t.light} stroke={t.dark} strokeWidth={0.8} />
        {/* buste, bras et mains */}
        <path d={`M${CX - 60},430 L${CX - 55},256 L${CX + 55},256 L${CX + 60},430 Z`} fill={`url(#${id})`} stroke={t.dark} strokeWidth={0.9} />
        <g fill="none" stroke={t.dark} strokeWidth={1.8} opacity={0.6}>
          <path d={`M${CX - 50},272 Q${CX - 46},350 ${CX - 32},394 L${CX - 4},400`} />
          <path d={`M${CX + 50},272 Q${CX + 46},350 ${CX + 32},394 L${CX + 4},400`} />
          {[-24, -17, -10, 10, 17, 24].map((dx) => (
            <path key={dx} d={`M${CX + dx},392 l${dx < 0 ? 2 : -2},10`} />
          ))}
        </g>
        {/* tête : front, arcades, nez, bouche, menton, oreilles */}
        <path d={`M${CX - 56},262 L${CX - 61},118 Q${CX - 59},66 ${CX - 48},64 L${CX + 48},64 Q${CX + 59},66 ${CX + 61},118 L${CX + 56},262 Z`} fill={`url(#${id})`} stroke={t.dark} strokeWidth={0.9} />
        <rect x={CX - 70} y={118} width={12} height={92} rx={5} fill={t.dark} opacity={0.55} />
        <rect x={CX + 58} y={118} width={12} height={92} rx={5} fill={t.dark} opacity={0.55} />
        <rect x={CX - 54} y={108} width={108} height={14} rx={4} fill={t.light} stroke={t.dark} strokeWidth={0.6} />
        <ellipse cx={CX - 27} cy={133} rx={17} ry={9} fill={t.dark} opacity={0.75} />
        <ellipse cx={CX + 27} cy={133} rx={17} ry={9} fill={t.dark} opacity={0.75} />
        <path d={`M${CX - 7},122 L${CX - 18},194 Q${CX},206 ${CX + 18},194 L${CX + 7},122 Z`} fill={t.light} stroke={t.dark} strokeWidth={0.8} />
        <ellipse cx={CX - 9} cy={196} rx={4} ry={2.5} fill={t.dark} />
        <ellipse cx={CX + 9} cy={196} rx={4} ry={2.5} fill={t.dark} />
        <path d={`M${CX - 28},220 Q${CX},210 ${CX + 28},220`} fill="none" stroke={t.dark} strokeWidth={3} />
        <path d={`M${CX - 22},228 Q${CX},236 ${CX + 22},228`} fill="none" stroke={t.dark} strokeWidth={1.4} opacity={0.6} />
        <path d={`M${CX - 34},248 Q${CX},262 ${CX + 34},248`} fill="none" stroke={t.dark} strokeWidth={1.2} opacity={0.5} />
      </>
    );
  },
  crown: (built, _uid, grey) => {
    const t = built ? tone("#a8452f") : grey;
    return (
      <g className={built ? "crown built" : "crown"}>
        <rect x={CX - 44} y={30} width={88} height={34} fill={t.fill} stroke={t.dark} strokeWidth={0.8} />
        <ellipse cx={CX} cy={64} rx={44} ry={6} fill={t.dark} />
        <ellipse cx={CX} cy={30} rx={44} ry={7} fill={t.light} stroke={t.dark} strokeWidth={0.8} />
        <ellipse cx={CX} cy={27} rx={16} ry={4} fill={t.fill} stroke={t.dark} strokeWidth={0.6} />
      </g>
    );
  },
  base: () => (
    <g>
      <rect x={0} y={GROUND} width={W} height={HEIGHT - GROUND} fill="#6f9a44" />
      <rect x={0} y={HEIGHT - 8} width={W} height={8} fill="#4f86a8" />
    </g>
  ),
};

export const WORLD: Record<"eiffel" | "liberte" | "glace" | "djenne" | "moai", Renderer> = { eiffel, liberte, glace, djenne, moai };
