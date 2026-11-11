// Vue calculée sur l'appareil : état rejoué depuis le journal + évaluation du moteur.

import type { ChecklistItem as EngineItem, Evaluation, Tier as EngineTier } from "./engine/engine";
import { type HouseholdData, proofs, type State } from "./engine/replay";
import { type Catalog, type Kind, type Level, levelOf, MAX_LEVEL, type Objective as CatalogObjective, type Status } from "./engine/types";

export type { Axis, ContextId, NamedId, Status } from "./engine/types";
export type { HouseholdData, ItemData, StockData, TalentData } from "./engine/replay";

export interface MemberIn {
  name: string;
  type: string;
  conditions: string[];
  medical: boolean; // gardé en double de la condition « traitement » pour les anciennes versions
}
export interface Tier extends EngineTier {
  name: string;
  horizon: string;
  summary: string;
}
export interface Autonomy {
  category: string;
  name: string;
  unit: string;
  need_per_day: number;
  total: number;
  days: number | null;
  days_after_expiring: number | null;
}
export type ChecklistKind = EngineItem["kind"];
export interface ChecklistItem extends EngineItem {
  objective_kind: Kind | null;
}
export interface Dashboard {
  household: HouseholdData;
  level: number;
  level_info: Level;
  next_level_info: Level | null;
  tiers: Tier[];
  axis_levels: { axis: string; name: string; icon: string; level: number }[];
  autonomy: Autonomy[];
  checklist: ChecklistItem[];
  counts: Partial<Record<Status, number>>;
}
export interface Objective extends CatalogObjective {
  status: Status;
  progress: number;
  validated_at: string | null;
  expires_on: string | null;
  source: string | null;
  /** Objets possédés et talents acquis qui valident l'objectif (liens `proves`). */
  proofs: ProofSource[];
}
export interface ProofSource {
  kind: "item" | "talent";
  id: string;
  label: string; // « Radio (commun) », « Plan de communication »
  on: string;
  /** Lien vers la fiche de l'objet ou du talent. */
  to: string;
}

export function buildDashboard(catalog: Catalog, state: State, ev: Evaluation): Dashboard {
  const byId = new Map(catalog.objectives.map((o) => [o.id, o]));
  const counts: Partial<Record<Status, number>> = {};
  for (const st of Object.values(ev.statuses)) counts[st.status] = (counts[st.status] ?? 0) + 1;
  const level = (n: number) => levelOf(catalog, n);
  return {
    household: state.household!,
    level: ev.level,
    level_info: level(ev.level),
    next_level_info: ev.level < MAX_LEVEL ? level(ev.level + 1) : null,
    tiers: ev.tiers.map((t) => ({ ...t, name: level(t.n).name, horizon: level(t.n).horizon, summary: level(t.n).summary })),
    axis_levels: catalog.axes.map((a) => ({ axis: a.id, name: a.name, icon: a.icon, level: ev.axis_levels[a.id] })),
    autonomy: catalog.categories.map((c) => ({ ...ev.autonomy[c.id], name: c.name, unit: c.unit })),
    checklist: ev.checklist.map((i) => ({
      ...i,
      objective_kind: i.objective_id ? (byId.get(i.objective_id)?.kind ?? null) : null,
    })),
    counts,
  };
}

export function buildObjectives(catalog: Catalog, state: State, ev: Evaluation): Objective[] {
  const byObjective = new Map<string, ProofSource[]>();
  for (const p of proofs(catalog, state)) {
    let src: ProofSource;
    if (p.kind === "item") {
      const item = catalog.items.find((i) => i.id === p.source_id)!;
      const tier = catalog.item_tiers.find((t) => t.id === state.items.get(item.id)?.tier)?.name;
      src = { kind: "item", id: item.id, label: tier ? `${item.name} (${tier.toLowerCase()})` : item.name, on: p.on, to: `/inventaire?objet=${item.id}` };
    } else {
      const t = catalog.talents.find((x) => x.id === p.source_id)!;
      src = { kind: "talent", id: t.id, label: t.name, on: p.on, to: `/competences?spe=${t.specialty}&talent=${t.id}` };
    }
    const list = byObjective.get(p.objective_id) ?? [];
    if (!list.some((x) => x.kind === src.kind && x.id === src.id)) list.push(src);
    byObjective.set(p.objective_id, list);
  }
  return catalog.objectives.map((o) => {
    const st = ev.statuses[o.id];
    return {
      ...o,
      status: st.status,
      progress: st.progress,
      validated_at: st.validated_at,
      expires_on: st.expires_on,
      source: state.validations.get(o.id)?.source ?? null,
      proofs: byObjective.get(o.id) ?? [],
    };
  });
}
