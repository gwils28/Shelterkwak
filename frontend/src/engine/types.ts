// Types du catalogue tel qu'exporté par `python -m shelterkwak.export` (generated/catalog.json).

export type ContextId = "appartement" | "periurbain" | "rural";
export type Kind = "check" | "skill" | "stock";
export type Status = "na" | "todo" | "done" | "expiring" | "expired";

export interface Level {
  n: number;
  name: string;
  horizon: string;
  summary: string;
}
export interface Axis {
  id: string;
  name: string;
  icon: string;
}
export interface NamedId {
  id: string;
  name: string;
}
export interface Category {
  id: string;
  name: string;
  unit: string;
  daily_need: Record<string, number>;
  per_household: number | null;
  applies_if: string | null;
}
export interface Objective {
  id: string;
  axis: string;
  level: number;
  title: string;
  description: string;
  why: string;
  kind: Kind;
  required: boolean;
  contexts: ContextId[];
  requires_tags: string[];
  revalidate_days: number | null;
  stock: { category: string; min_days: number } | null;
  custom: boolean;
}
export interface Option {
  value: string;
  label: string;
  validates: string[];
  tags: string[];
  sets: Record<string, number | string>;
}
export interface Question {
  id: string;
  section: string;
  type: "single" | "multi" | "number";
  text: string;
  help: string;
  unit: string;
  show_if: {
    context_in: ContextId[] | null;
    tags_any: string[] | null;
    answer: { question: string; includes: string } | null;
  } | null;
  options: Option[];
  options_from: "axes" | null;
  sets_list: string | null;
  creates_stock: {
    category: string;
    name: string;
    unit_label: string;
    amount_per_unit: number | "household_day";
  } | null;
  answered_validates: string[];
}
export interface Catalog {
  levels: Level[];
  axes: Axis[];
  contexts: NamedId[];
  member_types: NamedId[];
  member_tags: Record<string, string>;
  categories: Category[];
  objectives: Objective[];
  questions: Question[];
}

export const MAX_LEVEL = 8;
export const ALL_CONTEXTS: ContextId[] = ["appartement", "periurbain", "rural"];

export function levelOf(catalog: Catalog, n: number): Level {
  return catalog.levels.find((l) => l.n === n)!;
}

/** Objectif perso tel que stocké dans le journal (`custom.upsert`). */
export interface CustomObjective {
  id: string;
  axis: string;
  level: number;
  title: string;
  why?: string;
  kind?: Kind;
  required?: boolean;
  revalidate_days?: number | null;
}

/** Équivalent de `Catalog.with_custom` : ajoute les objectifs perso valides. */
export function withCustom(catalog: Catalog, customs: CustomObjective[]): Catalog {
  const axes = new Set(catalog.axes.map((a) => a.id));
  const extra: Objective[] = [];
  for (const c of customs) {
    const kind = c.kind ?? "check";
    const ok =
      typeof c.id === "string" &&
      typeof c.title === "string" &&
      Number.isInteger(c.level) &&
      c.level >= 2 &&
      c.level <= MAX_LEVEL &&
      axes.has(c.axis) &&
      (kind === "check" || kind === "skill");
    if (!ok) continue;
    extra.push({
      id: c.id,
      axis: c.axis,
      level: c.level,
      title: c.title,
      description: "",
      why: c.why ?? "",
      kind,
      required: c.required ?? true,
      contexts: [...ALL_CONTEXTS],
      requires_tags: [],
      revalidate_days: c.revalidate_days ?? null,
      stock: null,
      custom: true,
    });
  }
  return extra.length ? { ...catalog, objectives: [...catalog.objectives, ...extra] } : catalog;
}
