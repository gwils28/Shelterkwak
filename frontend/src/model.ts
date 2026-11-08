// Vue calculée sur l'appareil : état rejoué depuis le journal + évaluation du moteur.

import type { ChecklistItem as EngineItem, Evaluation, Tier as EngineTier } from "./engine/engine";
import type { HouseholdData, State } from "./engine/replay";
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
  return catalog.objectives.map((o) => {
    const st = ev.statuses[o.id];
    return {
      ...o,
      status: st.status,
      progress: st.progress,
      validated_at: st.validated_at,
      expires_on: st.expires_on,
      source: state.validations.get(o.id)?.source ?? null,
    };
  });
}
