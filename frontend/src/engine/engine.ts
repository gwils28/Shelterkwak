// Port TypeScript de backend/src/shelterkwak/engine.py. Toute modification se fait dans les
// deux fichiers ; les cas de fixtures/engine.json vérifient qu'ils calculent pareil.

import { addDays, DATE_MAX, type IsoDate } from "./dates";
import { type Catalog, isAnimal, levelOf, MAX_LEVEL, type Objective, type Status } from "./types";

export const EXPIRY_WARNING_DAYS = 30;
export const GRACE_DAYS = 30; // une validation expirée fissure le tambour pendant ce délai avant de le faire tomber
const DONE: ReadonlySet<Status> = new Set(["done", "expiring", "grace"]);

export interface Member {
  type: string;
  conditions: string[]; // ids de catalog.member_conditions
}

/** Membre tel que stocké dans le journal. L'ancien `medical: true` vaut la condition `traitement`. */
export function memberOf(m: { type: string; medical?: boolean; conditions?: string[] | null }): Member {
  return { type: m.type, conditions: memberConditions(m) };
}

export function memberConditions(m: { medical?: boolean; conditions?: string[] | null }): string[] {
  const set = new Set(m.conditions ?? []);
  if (m.medical) set.add("traitement");
  return [...set];
}
export interface HouseholdState {
  context: string;
  members: Member[];
  declared_tags: string[];
  target_context: string | null;
  priority_axes: string[];
  goal_level: number | null;
}
export interface Validation {
  objective_id: string;
  validated_at: IsoDate;
}
export interface StockLine {
  id: string;
  name: string;
  category: string;
  total: number;
  expires_on: IsoDate | null;
}
export interface CategoryAutonomy {
  category: string;
  need_per_day: number;
  total: number;
  days: number | null;
  days_after_expiring: number | null;
}
export interface ObjectiveStatus {
  status: Status;
  progress: number;
  validated_at: IsoDate | null;
  expires_on: IsoDate | null;
}
export interface Tier {
  n: number;
  state: "built" | "current" | "future";
  required_total: number;
  required_done: number;
  optional_total: number;
  optional_done: number;
  cracked: boolean;
  progress: number;
}
export type ChecklistKind = "revalidate" | "stock_expired" | "stock_expiring" | "blocking" | "optional" | "prepare";
export interface ChecklistItem {
  kind: ChecklistKind;
  title: string;
  detail: string;
  objective_id: string | null;
  stock_id: string | null;
  axis: string | null;
  level: number | null;
}
export interface Evaluation {
  level: number;
  tiers: Tier[];
  axis_levels: Record<string, number>;
  statuses: Record<string, ObjectiveStatus>;
  autonomy: Record<string, CategoryAutonomy>;
  checklist: ChecklistItem[];
}

export function householdTags(catalog: Catalog, state: HouseholdState): Set<string> {
  const tags = new Set(state.declared_tags);
  const conditionTags = new Map(catalog.member_conditions.map((c) => [c.id, c.tags]));
  for (const m of state.members) {
    const t = catalog.member_tags[m.type];
    if (t) tags.add(t);
    for (const c of m.conditions) for (const ct of conditionTags.get(c) ?? []) tags.add(ct);
  }
  return tags;
}

export function isApplicable(obj: Objective, state: HouseholdState, tags: Set<string>, context?: string): boolean {
  const ctx = context ?? state.context;
  if (!(obj.contexts as string[]).includes(ctx)) return false;
  if (obj.excludes_tags.some((t) => tags.has(t))) return false;
  return obj.requires_tags.length === 0 || obj.requires_tags.some((t) => tags.has(t));
}

/** Équivalent de `validation_expiry` : date à laquelle une validation cesse d'être à jour. */
export function validationExpiry(obj: Objective, validatedAt: IsoDate): IsoDate | null {
  if (obj.revalidate_days) return addDays(validatedAt, obj.revalidate_days);
  if (obj.due_month) {
    const m = String(obj.due_month).padStart(2, "0");
    let year = Number(validatedAt.slice(0, 4));
    if (`${year}-${m}-01` < validatedAt) year += 1;
    return `${year + 1}-${m}-01`;
  }
  return null;
}

/** Tags apportés par les particularités d'un membre. */
export function memberTags(catalog: Catalog, member: Member): Set<string> {
  const byId = new Map(catalog.member_conditions.map((c) => [c.id, c.tags]));
  return new Set(member.conditions.flatMap((c) => byId.get(c) ?? []));
}

export function dailyNeed(catalog: Catalog, categoryId: string, state: HouseholdState): number {
  const cat = catalog.categories.find((c) => c.id === categoryId)!;
  if (cat.applies_if && !householdTags(catalog, state).has(cat.applies_if)) return 0;
  if (cat.per_member_tag !== null) {
    const tag = cat.per_member_tag;
    return state.members.filter((m) => memberTags(catalog, m).has(tag)).length;
  }
  if (cat.per_household !== null) {
    return state.members.some((m) => !isAnimal(catalog, m.type)) ? cat.per_household : 0;
  }
  return state.members.reduce((sum, m) => sum + (cat.daily_need[m.type] ?? 0), 0);
}

export function computeAutonomy(
  catalog: Catalog,
  state: HouseholdState,
  stock: StockLine[],
  today: IsoDate,
): Record<string, CategoryAutonomy> {
  const horizon = addDays(today, EXPIRY_WARNING_DAYS);
  const out: Record<string, CategoryAutonomy> = {};
  for (const cat of catalog.categories) {
    const lines = stock.filter((s) => s.category === cat.id);
    const valid = lines.reduce((sum, s) => (s.expires_on === null || s.expires_on >= today ? sum + s.total : sum), 0);
    const lasting = lines.reduce((sum, s) => (s.expires_on === null || s.expires_on > horizon ? sum + s.total : sum), 0);
    const need = dailyNeed(catalog, cat.id, state);
    out[cat.id] = {
      category: cat.id,
      need_per_day: need,
      total: valid,
      days: need > 0 ? valid / need : null,
      days_after_expiring: need > 0 ? lasting / need : null,
    };
  }
  return out;
}

function status(s: Status, progress: number, validated_at: IsoDate | null = null, expires_on: IsoDate | null = null): ObjectiveStatus {
  return { status: s, progress, validated_at, expires_on };
}

export function objectiveStatus(
  obj: Objective,
  applicable: boolean,
  validation: Validation | undefined,
  autonomy: Record<string, CategoryAutonomy>,
  today: IsoDate,
): ObjectiveStatus {
  if (!applicable) return status("na", 0);
  if (obj.kind === "stock" && obj.stock) {
    const auto = autonomy[obj.stock.category];
    const days = auto.days || 0;
    const progress = Math.min(1, days / obj.stock.min_days);
    if (days < obj.stock.min_days) return status("todo", progress);
    if ((auto.days_after_expiring || 0) < obj.stock.min_days) return status("expiring", 1);
    return status("done", 1);
  }
  if (!validation) return status("todo", 0);
  const expires = validationExpiry(obj, validation.validated_at);
  if (expires) {
    if (today >= addDays(expires, GRACE_DAYS)) return status("expired", 0, validation.validated_at, expires);
    if (today >= expires) return status("grace", 1, validation.validated_at, expires);
    if (today >= addDays(expires, -EXPIRY_WARNING_DAYS)) return status("expiring", 1, validation.validated_at, expires);
  }
  return status("done", 1, validation.validated_at, expires);
}

function climb(objectives: Objective[], statuses: Record<string, ObjectiveStatus>): number {
  let level = 0;
  for (let n = 1; n <= MAX_LEVEL; n++) {
    const blocking = objectives.some(
      (o) => o.level === n && o.required && statuses[o.id].status !== "na" && !DONE.has(statuses[o.id].status),
    );
    if (blocking) break;
    level = n;
  }
  return level;
}

export function evaluate(
  catalog: Catalog,
  state: HouseholdState,
  validations: Validation[],
  stock: StockLine[],
  today: IsoDate,
): Evaluation {
  const tags = householdTags(catalog, state);
  const byId = new Map(validations.map((v) => [v.objective_id, v]));
  const autonomy = computeAutonomy(catalog, state, stock, today);
  const statuses: Record<string, ObjectiveStatus> = {};
  for (const o of catalog.objectives) {
    statuses[o.id] = objectiveStatus(o, isApplicable(o, state, tags), byId.get(o.id), autonomy, today);
  }
  const level = climb(catalog.objectives, statuses);
  const axis_levels: Record<string, number> = {};
  for (const a of catalog.axes) {
    axis_levels[a.id] = climb(
      catalog.objectives.filter((o) => o.axis === a.id),
      statuses,
    );
  }

  const tiers: Tier[] = [];
  for (let n = 1; n <= MAX_LEVEL; n++) {
    const atLevel = catalog.objectives.filter((o) => o.level === n && statuses[o.id].status !== "na");
    const req = atLevel.filter((o) => o.required);
    const opt = atLevel.filter((o) => !o.required);
    const built = n <= level;
    const cracked =
      built &&
      atLevel.some(
        (o) =>
          statuses[o.id].status === "expiring" ||
          statuses[o.id].status === "grace" ||
          (!o.required && statuses[o.id].status === "expired"),
      );
    const required_done = req.filter((o) => DONE.has(statuses[o.id].status)).length;
    tiers.push({
      n,
      state: built ? "built" : n === level + 1 ? "current" : "future",
      required_total: req.length,
      required_done,
      optional_total: opt.length,
      optional_done: opt.filter((o) => DONE.has(statuses[o.id].status)).length,
      cracked,
      progress: req.length === 0 ? 1 : required_done / req.length,
    });
  }

  const checklist = buildChecklist(catalog, state, tags, statuses, stock, level, today);
  return { level, tiers, axis_levels, statuses, autonomy, checklist };
}

function item(
  kind: ChecklistKind,
  title: string,
  detail: string,
  objective_id: string | null = null,
  stock_id: string | null = null,
  axis: string | null = null,
  level: number | null = null,
): ChecklistItem {
  return { kind, title, detail, objective_id, stock_id, axis, level };
}

export function buildChecklist(
  catalog: Catalog,
  state: HouseholdState,
  tags: Set<string>,
  statuses: Record<string, ObjectiveStatus>,
  stock: StockLine[],
  level: number,
  today: IsoDate,
): ChecklistItem[] {
  const axisRank = new Map(catalog.axes.map((a, i) => [a.id, i]));
  const prio = new Map(state.priority_axes.map((a, i) => [a, i]));
  const key = (o: Objective): number[] => [o.level, prio.get(o.axis) ?? prio.size, axisRank.get(o.axis) ?? 99];
  const cmp = (a: Objective, b: Objective) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
    return 0;
  };
  const objs = [...catalog.objectives].sort(cmp);
  const items: ChecklistItem[] = [];

  const revalidations: [Status, string][] = [
    ["grace", "En sursis : à refaire pour que le tambour ne tombe pas."],
    ["expired", "Validation expirée : à refaire pour retrouver ton niveau."],
    ["expiring", "Expire bientôt : pense à revalider."],
  ];
  for (const [wanted, detail] of revalidations) {
    for (const o of objs) {
      const st = statuses[o.id];
      if (st.status === wanted && o.kind !== "stock") {
        const when = !st.expires_on
          ? ""
          : wanted === "grace"
            ? ` (le tambour tombe le ${addDays(st.expires_on, GRACE_DAYS)})`
            : ` (échéance ${st.expires_on})`;
        items.push(item("revalidate", o.title, detail + when, o.id, null, o.axis, o.level));
      }
    }
  }

  const horizon = addDays(today, EXPIRY_WARNING_DAYS);
  const byExpiry = [...stock].sort((a, b) => {
    const ea = a.expires_on ?? DATE_MAX;
    const eb = b.expires_on ?? DATE_MAX;
    return ea < eb ? -1 : ea > eb ? 1 : 0;
  });
  for (const s of byExpiry) {
    if (s.expires_on === null) continue;
    if (s.expires_on < today) {
      items.push(item("stock_expired", s.name, `Périmé depuis le ${s.expires_on} : à remplacer.`, null, s.id));
    } else if (s.expires_on <= horizon) {
      items.push(item("stock_expiring", s.name, `Périme le ${s.expires_on} : à consommer et renouveler.`, null, s.id));
    }
  }

  const next = level + 1;
  if (next <= MAX_LEVEL) {
    for (const o of objs) {
      if (o.level <= next && o.required && statuses[o.id].status === "todo") {
        const detail = o.why || `Bloque l'accès au niveau ${next} (${levelOf(catalog, next).name}).`;
        items.push(item("blocking", o.title, detail, o.id, null, o.axis, o.level));
      }
    }
  }

  for (const o of objs) {
    if (!o.required && (o.level === level || o.level === next) && statuses[o.id].status === "todo") {
      items.push(item("optional", o.title, o.why || "Bonus recommandé.", o.id, null, o.axis, o.level));
    }
  }

  if (state.target_context && state.target_context !== state.context) {
    for (const o of objs) {
      if (o.required && statuses[o.id].status === "na" && isApplicable(o, state, tags, state.target_context)) {
        items.push(
          item(
            "prepare",
            o.title,
            "Pas encore applicable, mais utile pour ton futur lieu de vie : anticipe compétences et budget.",
            o.id,
            null,
            o.axis,
            o.level,
          ),
        );
      }
    }
  }
  return items;
}
