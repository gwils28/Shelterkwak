// Arbres de talents de l'onglet Compétences : états des nœuds, rang atteint, chaînes de prérequis.
// Rien n'est stocké ici : tout se déduit du catalogue et des talents acquis (journal rejoué).

import type { TalentData } from "../engine/replay";
import type { Catalog, Specialty, Talent } from "../engine/types";

/** acquis : coché ; disponible : tous ses prérequis sont acquis ; verrouillé : il en manque. */
export type TalentState = "acquired" | "available" | "locked";

export interface TalentNode {
  talent: Talent;
  state: TalentState;
  data: TalentData | null;
  missing: Talent[]; // prérequis directs pas encore acquis
}

export interface Tree {
  specialty: Specialty;
  nodes: TalentNode[];
  acquired: number;
  total: number;
  available: number;
  rank: number; // rang le plus haut atteint (0 : aucun talent)
  title: string | null; // titre porté à ce rang
}

/**
 * Les arbres vus depuis un lieu de vie : on retire les talents qui n'y ont pas cours (tronçonneuse,
 * élevage en appartement) et les prérequis qui pointaient vers eux, pour que le maître reste atteignable.
 */
export function forContext(catalog: Catalog, context: string | null): Catalog {
  if (!context) return catalog;
  const talents = catalog.talents.filter((t) => !t.contexts?.length || t.contexts.includes(context));
  const ids = new Set(talents.map((t) => t.id));
  return { ...catalog, talents: talents.map((t) => ({ ...t, requires: t.requires.filter((r) => ids.has(r)) })) };
}

export function talentState(talent: Talent, acquired: ReadonlyMap<string, TalentData>): TalentState {
  if (acquired.has(talent.id)) return "acquired";
  return talent.requires.every((r) => acquired.has(r)) ? "available" : "locked";
}

export function buildTree(catalog: Catalog, specialty: Specialty, acquired: ReadonlyMap<string, TalentData>): Tree {
  const byId = new Map(catalog.talents.map((t) => [t.id, t]));
  const nodes = catalog.talents
    .filter((t) => t.specialty === specialty.id)
    .map((talent) => ({
      talent,
      state: talentState(talent, acquired),
      data: acquired.get(talent.id) ?? null,
      missing: talent.requires.filter((r) => !acquired.has(r)).map((r) => byId.get(r)!),
    }));
  const owned = nodes.filter((n) => n.state === "acquired");
  const rank = Math.max(0, ...owned.map((n) => n.talent.row));
  return {
    specialty,
    nodes,
    acquired: owned.length,
    total: nodes.length,
    available: nodes.filter((n) => n.state === "available").length,
    rank,
    title: rank ? specialty.titles[rank - 1] : null,
  };
}

export function buildTrees(catalog: Catalog, acquired: ReadonlyMap<string, TalentData>): Tree[] {
  return catalog.specialties.map((s) => buildTree(catalog, s, acquired));
}

/** Le talent et tous ses ancêtres non acquis, du plus bas au plus haut : l'ordre où les cocher. */
export function missingChain(catalog: Catalog, talentId: string, acquired: ReadonlyMap<string, TalentData>): Talent[] {
  const byId = new Map(catalog.talents.map((t) => [t.id, t]));
  const found = new Map<string, Talent>();
  const visit = (id: string) => {
    const t = byId.get(id);
    if (!t || acquired.has(id) || found.has(id)) return;
    found.set(id, t);
    t.requires.forEach(visit);
  };
  visit(talentId);
  return [...found.values()].sort((a, b) => a.row - b.row || a.col - b.col);
}

/** Le talent et tous les talents acquis qui en dépendent, du plus haut au plus bas : l'ordre où les retirer. */
export function dependentChain(catalog: Catalog, talentId: string, acquired: ReadonlyMap<string, TalentData>): Talent[] {
  const found = new Map<string, Talent>();
  const visit = (id: string) => {
    for (const t of catalog.talents) {
      if (t.requires.includes(id) && acquired.has(t.id) && !found.has(t.id)) {
        found.set(t.id, t);
        visit(t.id);
      }
    }
  };
  const self = catalog.talents.find((t) => t.id === talentId);
  if (self) found.set(self.id, self);
  visit(talentId);
  return [...found.values()].sort((a, b) => b.row - a.row || a.col - b.col);
}

/** Talents directement débloqués par celui-ci (ceux qui le citent en prérequis). */
export function unlocks(catalog: Catalog, talentId: string): Talent[] {
  return catalog.talents.filter((t) => t.requires.includes(talentId));
}
