// Monuments de progression : quatre silhouettes découpées en 9 paliers empilés.
// Un palier acquis prend sa couleur, le palier en cours et les suivants restent gris.

import { MAX_LEVEL } from "../engine/types";

export type MonumentStyle = "colonne" | "pyramide" | "arbre" | "azteque" | "eiffel" | "liberte" | "glace" | "djenne" | "moai" | "pagode" | "bouddha" | "fusee" | "tornade" | "tamu" | "cocotier" | "everest" | "totem" | "phare" | "iguazu" | "burj" | "panier";

export const MONUMENTS: { id: MonumentStyle; name: string; hint: string }[] = [
  { id: "colonne", name: "Colonne romaine", hint: "Tambour après tambour, jusqu'au chapiteau doré." },
  { id: "pyramide", name: "Pyramide d'Égypte", hint: "Assise après assise, jusqu'au pyramidion d'or." },
  { id: "arbre", name: "Arbre", hint: "Des racines au feuillage, jusqu'aux fruits." },
  { id: "azteque", name: "Pyramide aztèque", hint: "Terrasse après terrasse, jusqu'au temple." },
  { id: "eiffel", name: "Tour Eiffel", hint: "Étage après étage, jusqu'au phare du sommet." },
  { id: "liberte", name: "Statue de la Liberté", hint: "Du piédestal de granit à la flamme." },
  { id: "glace", name: "Stalactites de glace", hint: "Goutte après goutte, jusqu'à l'aurore boréale." },
  { id: "djenne", name: "Mosquée de Djenné (Mali)", hint: "Banco et bois de palmier, jusqu'aux œufs d'autruche." },
  { id: "moai", name: "Moaï (île de Pâques)", hint: "De l'ahu de pierre au pukao rouge." },
  { id: "pagode", name: "Pagode", hint: "Neuf toits relevés, jusqu'à la flèche dorée." },
  { id: "bouddha", name: "Bouddha", hint: "Du trône de lotus au halo de lumière." },
  { id: "fusee", name: "Fusée", hint: "Étage après étage, jusqu'au décollage." },
  { id: "tornade", name: "Tornade", hint: "Du tourbillon au sol jusqu'à l'orage qui gronde." },
  { id: "tamu", name: "Massif Tamu (volcan sous-marin)", hint: "Volcan bouclier géant, du plancher du Pacifique à la surface." },
  { id: "cocotier", name: "Cocotier", hint: "Anneau après anneau, jusqu'aux noix de coco." },
  { id: "everest", name: "Mont Everest", hint: "Du camp de base au toit du monde." },
  { id: "totem", name: "Totem amérindien", hint: "Figure après figure, jusqu'à l'oiseau-tonnerre." },
  { id: "phare", name: "Phare", hint: "Bande après bande, jusqu'à la lanterne qui veille." },
  { id: "iguazu", name: "Chutes d'Iguazú", hint: "Cascade après cascade, jusqu'à l'arc-en-ciel." },
  { id: "burj", name: "Burj Khalifa", hint: "Retrait après retrait, jusqu'à la flèche." },
  { id: "panier", name: "Panier de basket", hint: "Du poteau au panneau, jusqu'au panier marqué." },
];

/** Teinte de la scène derrière le monument (page Monument), mêlée au fond de carte. */
export const SCENE: Record<MonumentStyle, string> = {
  colonne: "#f1d9b5",
  pyramide: "#f6cf8f",
  arbre: "#cfe6c1",
  azteque: "#efc79d",
  eiffel: "#c9d9ee",
  liberte: "#bfe0ef",
  glace: "#cde6f4",
  djenne: "#f3cf9f",
  moai: "#cfe5d6",
  pagode: "#f6d2d6",
  bouddha: "#f1dfb5",
  fusee: "#cfd4ec",
  tornade: "#cdd4df",
  tamu: "#b7e0ee",
  cocotier: "#cfeaf0",
  everest: "#d3dfeb",
  totem: "#e6d9c2",
  phare: "#c8dff0",
  iguazu: "#cfe8d6",
  burj: "#f0dfbf",
  panier: "#f3d6bf",
};

export function monumentOf(value: unknown): MonumentStyle {
  return MONUMENTS.some((m) => m.id === value) ? (value as MonumentStyle) : "colonne";
}

/** Mise en page commune : couronne en haut, 9 paliers de même hauteur, socle en bas. */
export const LAYOUT = {
  width: 260,
  crown: 60,
  tier: 50,
  base: 34,
  levels: MAX_LEVEL,
} as const;

export const CX = LAYOUT.width / 2;

export function tierTop(n: number): number {
  return LAYOUT.crown + (LAYOUT.levels - n) * LAYOUT.tier;
}
export function tierBottom(n: number): number {
  return tierTop(n) + LAYOUT.tier;
}
export const GROUND = tierBottom(1);
export const HEIGHT = GROUND + LAYOUT.base;

// ---------- Couleurs ----------

export interface Tone {
  fill: string;
  light: string;
  dark: string;
  ink: string; // couleur du chiffre romain posé dessus
}

function hex(c: string): [number, number, number] {
  const v = parseInt(c.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("")}`;
}
export function mix(a: string, b: string, t: number): string {
  const [x, y] = [hex(a), hex(b)];
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}
function luminance(c: string): number {
  const [r, g, b] = hex(c);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
export function tone(fill: string): Tone {
  return {
    fill,
    light: mix(fill, "#ffffff", 0.38),
    dark: mix(fill, "#000000", 0.32),
    ink: luminance(fill) < 0.5 ? "#fdf8ec" : "#3b2f1f",
  };
}

/** Rampe de couleurs : plusieurs jalons, interpolés sur les 9 paliers. */
function ramp(stops: string[], n: number): string {
  const t = ((n - 1) / (LAYOUT.levels - 1)) * (stops.length - 1);
  const i = Math.min(Math.floor(t), stops.length - 2);
  return mix(stops[i], stops[i + 1], t - i);
}

const RAMPS: Record<MonumentStyle, string[]> = {
  // marbres antiques : rouge porphyre, ocre, jaune antique, jusqu'à l'or
  colonne: ["#a4503c", "#c47a45", "#d6a64e", "#e2c463"],
  // grès des assises basses au calcaire clair du sommet
  pyramide: ["#a8682f", "#c98d45", "#ddb35f", "#efd28a"],
  // vert profond des premières branches au vert tendre de la cime
  arbre: ["#2f6b3a", "#3f8a43", "#62a845", "#9cc94f"],
  // terre rouge, ocre, puis jade et turquoise vers le temple
  azteque: ["#9c3d2a", "#c0703a", "#c9a046", "#3f9a7f", "#2a8c9d"],
  // fer puddlé « brun Tour Eiffel », éclairci vers le doré du sommet
  eiffel: ["#5a3b24", "#7d5532", "#a8743a", "#d4a046"],
  // cuivre patiné : du vert-de-gris sombre au turquoise clair
  liberte: ["#2c6f62", "#3f8f7f", "#5aab98", "#86cdb7"],
  // glace : du bleu profond des pointes au blanc givré du rebord
  glace: ["#24557f", "#2f78a8", "#4fa3cf", "#8fd0ea", "#d8f2fb"],
  // banco : de la terre rouge au sable doré
  djenne: ["#8a4b2c", "#a8613a", "#c27e48", "#dcaa66"],
  // basalte de l'ahu puis tuf volcanique ocre
  moai: ["#4f4842", "#76624f", "#9d7a55", "#c49c63"],
  // laque rouge sombre jusqu'à l'ocre doré
  pagode: ["#7d2620", "#a8352a", "#c4612f", "#d9a03c"],
  // bronze patiné jusqu'à l'or
  bouddha: ["#6b4a2a", "#8f6a35", "#b78f3e", "#e3c158"],
  // du rouge des propulseurs au bleu du ciel
  fusee: ["#b3392f", "#d9732f", "#e8b23a", "#cfd6de", "#4f8fc0", "#2f5f9e"],
  // ciel d'orage : gris ardoise, bleu nuit, violet, jusqu'au cyan électrique
  tornade: ["#3e4a5c", "#4f6a91", "#6a5aa8", "#3aa6c9"],
  // basalte des coulées profondes, oxydé en rouge, jusqu'aux sédiments ocre du sommet
  tamu: ["#2e2a3a", "#47354a", "#6b3f45", "#94523f", "#b8763f", "#d6a65c"],
  // Neuf jalons ci-dessous : un par palier.
  // stipe brun qui s'éclaircit, puis le vert des palmes
  cocotier: ["#5a3c24", "#68462a", "#765131", "#855c38", "#94683f", "#a37548", "#b38352", "#4f9438", "#79bd48"],
  // forêt du camp de base, roche brune, puis neiges éternelles bleutées
  everest: ["#3f6b45", "#557048", "#6c6d4c", "#7a6450", "#8c7461", "#9f8673", "#b6cbe0", "#d4e4f2", "#eef6fc"],
  // cèdre rouge sculpté, puis peintures turquoise, rouge et ocre
  totem: ["#6e2f1f", "#8a3a24", "#a5472a", "#b85c33", "#2f6f73", "#2a5f86", "#b8432f", "#c98a34", "#dcb054"],
  // bandes rouges et blanches alternées
  phare: ["#b8322a", "#f1ece0", "#c23a2e", "#f3efe4", "#cc4232", "#f5f1e8", "#d64a36", "#f7f3ec", "#e0533a"],
  // eau sombre du bas vers l'écume claire du haut
  iguazu: ["#1d4f68", "#22607c", "#2a7290", "#3584a2", "#4497b3", "#56a9c2", "#6dbbcf", "#89ccdb", "#a9dde7"],
  // verre bleuté qui s'éclaircit vers le ciel
  burj: ["#34506a", "#3d5e7c", "#476d8e", "#527d9f", "#5f8daf", "#6f9dbd", "#82adc9", "#98bfd5", "#b2d1e2"],
  // poteau bleu nuit, panneau de verre
  panier: ["#22324a", "#283b57", "#2f4565", "#364f73", "#3e5a81", "#46658f", "#4f709d", "#d8e6ef", "#eef5f9"],
};

const GRANITE = ["#6f6a63", "#8a847a", "#a39c90"];

const BARK = ["#5e3f26", "#6e4a2c", "#7d5633"];

export function builtTone(style: MonumentStyle, n: number): Tone {
  if (style === "arbre" && n <= 3) return tone(BARK[n - 1]);
  if (style === "liberte" && n <= 3) return tone(GRANITE[n - 1]);
  if (style === "liberte") return tone(ramp(RAMPS.liberte, ((n - 4) / 5) * 8 + 1));
  if (style === "arbre") return tone(ramp(RAMPS.arbre, ((n - 4) / 5) * 8 + 1));
  return tone(ramp(RAMPS[style], n));
}

/** Gris : palier en cours (plus soutenu) ou à venir (pâle). Variables CSS pour suivre le thème. */
export const GREY: Record<"current" | "future", Tone> = {
  current: { fill: "var(--tier-grey)", light: "var(--tier-grey-light)", dark: "var(--tier-grey-dark)", ink: "var(--tier-grey-ink)" },
  future: { fill: "var(--tier-ghost)", light: "var(--tier-ghost-light)", dark: "var(--tier-ghost-dark)", ink: "var(--tier-ghost-ink)" },
};

/** Petit générateur déterministe pour les textures (joints, feuilles, fruits). */
export function seeded(seed: number): () => number {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Zigzag de fissure au milieu d'un palier. */
export function crackPath(n: number, x0: number): string {
  const top = tierTop(n);
  const steps = 6;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const y = top + 4 + ((LAYOUT.tier - 8) * i) / steps;
    const x = x0 + (i % 2 === 0 ? -1 : 1) * (3 + ((n * 7 + i * 3) % 4));
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(" ");
}
