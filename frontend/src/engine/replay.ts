// Port TypeScript de backend/src/shelterkwak/replay.py : rejeu du journal et historique dérivé.

import { addDays, type IsoDate } from "./dates";
import { type Evaluation, evaluate, GRACE_DAYS, type HouseholdState, memberOf, type StockLine, type Validation, validationExpiry } from "./engine";
import { type Catalog, type ContextId, type CustomObjective, levelOf, withCustom } from "./types";

export type OpType =
  | "household.set"
  | "onboarding"
  | "validation.set"
  | "validation.delete"
  | "stock.upsert"
  | "stock.delete"
  | "custom.upsert"
  | "custom.delete"
  | "notes.set"
  | "item.set"
  | "item.delete"
  | "talent.set"
  | "talent.delete"
  | "reset";

export interface Op {
  id: string;
  device: string;
  at: string; // ISO UTC
  type: OpType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
}

export interface MemberData {
  name: string;
  type: string;
  conditions?: string[]; // absent des opérations écrites avant les particularités
  medical?: boolean; // ancien champ, équivaut à la condition « traitement »
}
export interface HouseholdData {
  name: string;
  context: ContextId;
  target_context: ContextId | null;
  target_date: IsoDate | null;
  members: MemberData[];
  tags: string[];
  priority_axes: string[];
  goal_level: number | null;
  goal_horizon_months: number | null;
  monument?: string; // forme du monument de progression (absent des opérations anciennes)
}
export interface ValidationData {
  objective_id: string;
  validated_at: IsoDate;
  note: string;
  source: string;
}
export interface StockData {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit_label: string;
  amount_per_unit: number;
  expires_on: IsoDate | null;
  location?: string | null; // où il est rangé (absent des opérations anciennes)
  basket?: string | null; // ligne du panier type qu'il remplit (absent des opérations anciennes)
}

/** Carte d'inventaire possédée (opération item.set) ; `tier` est l'id d'un palier de qualité. */
export interface ItemData {
  item_id: string;
  tier: string | null;
  quantity: number;
  location: string | null;
  note: string;
  expires_on?: IsoDate | null; // péremption (consommable) ou prochaine vérification (équipement)
}

export interface TalentData {
  talent_id: string;
  acquired_on: IsoDate | null; // date d'acquisition, facultative
  note: string;
}

export interface State {
  household: HouseholdData | null;
  validations: Map<string, ValidationData>;
  stock: Map<string, StockData>;
  custom: Map<string, CustomObjective>;
  notes: Map<string, string>; // fiches de l'écran Crise
  items: Map<string, ItemData>; // cartes possédées, par id d'objet
  talents: Map<string, TalentData>; // talents acquis, par id de talent
  onboarded_at: string | null;
  /** Date (AAAA-MM-JJ) de la dernière déclaration : « item:<id> », « talent:<id> », « stock:<id> ». */
  declared: Map<string, IsoDate>;
}

export function emptyState(): State {
  return { household: null, validations: new Map(), stock: new Map(), custom: new Map(), notes: new Map(), items: new Map(), talents: new Map(), onboarded_at: null, declared: new Map() };
}

export function compareOps(a: Op, b: Op): number {
  if (a.at !== b.at) return a.at < b.at ? -1 : 1;
  if (a.device !== b.device) return a.device < b.device ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function fmtQty(x: number): string {
  if (Number.isInteger(x)) return String(x);
  return x.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function titleOf(catalog: Catalog, state: State, id: string): string {
  const custom = state.custom.get(id);
  if (custom) return custom.title ?? id;
  return catalog.objectives.find((o) => o.id === id)?.title ?? id;
}

function contextName(catalog: Catalog, ctx: string | null | undefined): string {
  return catalog.contexts.find((c) => c.id === ctx)?.name ?? String(ctx);
}

function itemLabel(catalog: Catalog, itemId: string, tier: string | null = null): string {
  const name = catalog.items.find((i) => i.id === itemId)?.name ?? itemId;
  const tierName = catalog.item_tiers.find((t) => t.id === tier)?.name;
  return tierName ? `${name} (${tierName.toLowerCase()})` : name;
}

function talentName(catalog: Catalog, talentId: string): string {
  return catalog.talents.find((t) => t.id === talentId)?.name ?? talentId;
}

/** Applique une opération ; renvoie [message du journal, cause d'un éventuel changement de niveau]. */
export function apply(catalog: Catalog, state: State, op: Op): [string, string] {
  const p = op.payload;
  switch (op.type) {
    case "reset":
      state.household = null;
      state.onboarded_at = null;
      state.validations.clear();
      state.stock.clear();
      state.custom.clear();
      state.notes.clear();
      state.items.clear();
      state.talents.clear();
      state.declared.clear();
      return ["Remise à zéro du foyer", "remise à zéro"];
    case "onboarding": {
      state.household = { ...p.household };
      state.onboarded_at = op.at;
      const vals: ValidationData[] = p.validations ?? [];
      const stock: StockData[] = p.stock ?? [];
      for (const v of vals) state.validations.set(v.objective_id, { ...v });
      for (const s of stock) {
        state.stock.set(s.id, { ...s });
        state.declared.set(`stock:${s.id}`, op.at.slice(0, 10));
      }
      return [
        `Interview terminée : ${vals.length} objectif(s) déjà acquis, ${stock.length} stock(s) estimé(s)`,
        "interview initiale",
      ];
    }
    case "household.set": {
      const old = state.household;
      state.household = { ...(p as HouseholdData) };
      if (old === null) return [`Foyer créé : ${p.name ?? ""}`, "création du foyer"];
      if (old.context !== p.context) {
        return [
          `Changement de lieu de vie : ${contextName(catalog, old.context)} → ${contextName(catalog, p.context)}`,
          "changement de lieu de vie",
        ];
      }
      const nOld = (old.members ?? []).length;
      const nNew = (p.members ?? []).length;
      if (nOld !== nNew) return [`Le foyer passe de ${nOld} à ${nNew} membre(s)`, "changement de composition du foyer"];
      return ["Foyer mis à jour", "mise à jour du foyer"];
    }
    case "validation.set": {
      const id: string = p.objective_id;
      const verb = state.validations.has(id) ? "revalidé" : "validé";
      state.validations.set(id, { ...(p as ValidationData) });
      const title = titleOf(catalog, state, id);
      return [`Objectif ${verb} : ${title}`, `objectif ${verb} « ${title} »`];
    }
    case "validation.delete": {
      const id: string = p.objective_id;
      state.validations.delete(id);
      const title = titleOf(catalog, state, id);
      return [`Objectif décoché : ${title}`, `objectif décoché « ${title} »`];
    }
    case "stock.upsert": {
      const existed = state.stock.has(p.id);
      state.stock.set(p.id, { ...(p as StockData) });
      state.declared.set(`stock:${p.id}`, op.at.slice(0, 10));
      if (existed) return [`Stock modifié : ${p.name}`, `modification du stock « ${p.name} »`];
      return [`Stock ajouté : ${fmtQty(Number(p.quantity))} × ${p.name}`, `ajout de stock « ${p.name} »`];
    }
    case "stock.delete": {
      const item = state.stock.get(p.id);
      state.stock.delete(p.id);
      state.declared.delete(`stock:${p.id}`);
      const name = item ? item.name : p.id;
      return [`Stock retiré : ${name}`, `retrait du stock « ${name} »`];
    }
    case "custom.upsert": {
      const verb = state.custom.has(p.id) ? "modifié" : "créé";
      state.custom.set(p.id, { ...(p as CustomObjective) });
      return [`Objectif perso ${verb} : ${p.title}`, `objectif perso ${verb} « ${p.title} »`];
    }
    case "custom.delete": {
      const item = state.custom.get(p.id);
      state.custom.delete(p.id);
      state.validations.delete(p.id);
      const title = item ? item.title : p.id;
      return [`Objectif perso supprimé : ${title}`, `objectif perso supprimé « ${title} »`];
    }
    case "notes.set": {
      state.notes.set(p.key, String(p.text ?? ""));
      const name = catalog.crisis_notes.find((n) => n.id === p.key)?.name ?? p.key;
      return [`Fiche de crise mise à jour : ${name}`, `fiche de crise « ${name} »`];
    }
    case "item.set": {
      const prefix = state.items.has(p.item_id) ? "Inventaire mis à jour" : "Ajouté à l'inventaire";
      state.items.set(p.item_id, { ...(p as ItemData) });
      state.declared.set(`item:${p.item_id}`, op.at.slice(0, 10));
      const label = itemLabel(catalog, p.item_id, p.tier ?? null);
      return [`${prefix} : ${label}`, `inventaire « ${label} »`];
    }
    case "item.delete": {
      state.items.delete(p.item_id);
      state.declared.delete(`item:${p.item_id}`);
      const label = itemLabel(catalog, p.item_id);
      return [`Retiré de l'inventaire : ${label}`, `inventaire « ${label} » retiré`];
    }
    case "talent.set": {
      const prefix = state.talents.has(p.talent_id) ? "Talent mis à jour" : "Talent acquis";
      state.talents.set(p.talent_id, { ...(p as TalentData) });
      state.declared.set(`talent:${p.talent_id}`, op.at.slice(0, 10));
      const name = talentName(catalog, p.talent_id);
      return [`${prefix} : ${name}`, `talent « ${name} »`];
    }
    case "talent.delete": {
      state.talents.delete(p.talent_id);
      state.declared.delete(`talent:${p.talent_id}`);
      const name = talentName(catalog, p.talent_id);
      return [`Talent retiré : ${name}`, `talent « ${name} » retiré`];
    }
    default:
      throw new Error(`type d'opération inconnu : ${(op as Op).type}`);
  }
}

export function replay(catalog: Catalog, ops: Op[]): State {
  const state = emptyState();
  for (const op of [...ops].sort(compareOps)) apply(catalog, state, op);
  return state;
}

/** Objectif validé par un objet possédé ou un talent acquis (lien `proves` du catalogue). */
export interface Proof {
  objective_id: string;
  kind: "item" | "talent";
  source_id: string;
  tier: string | null; // niveau de l'objet qui porte le lien (null : l'objet à tout niveau, ou un talent)
  on: IsoDate; // date de la preuve, qui tient lieu de date de validation
}

/**
 * Preuves tirées de l'inventaire et des talents, dans l'ordre du catalogue (voir `proofs` en Python).
 * Un objet prouve les objectifs de son niveau et des niveaux inférieurs, à la date de sa dernière
 * déclaration, antidatée si sa « prochaine vérification » tombe avant la revalidation de l'objectif.
 */
export function proofs(catalog: Catalog, state: State): Proof[] {
  const byId = new Map(catalog.objectives.map((o) => [o.id, o]));
  const rank = new Map(catalog.item_tiers.map((t, i) => [t.id, i]));
  const out: Proof[] = [];
  for (const item of catalog.items) {
    if (item.kind === "reserve") {
      const lines = [...state.stock.values()].filter((s) => s.category === item.category && Number(s.quantity) > 0);
      if (lines.length && item.proves.length) {
        const on = lines.map((s) => state.declared.get(`stock:${s.id}`)!).reduce((a, b) => (b > a ? b : a));
        for (const id of item.proves) out.push({ objective_id: id, kind: "item", source_id: item.id, tier: null, on });
      }
      continue;
    }
    const data = state.items.get(item.id);
    if (!data) continue;
    const declared = state.declared.get(`item:${item.id}`)!;
    const check = data.expires_on || null;
    const owned = rank.get(data.tier ?? "") ?? -1;
    const links: [string, string | null][] = item.proves.map((id) => [id, null]);
    for (const t of item.tiers) if (rank.get(t.tier)! <= owned) for (const id of t.proves) links.push([id, t.tier]);
    for (const [id, tier] of links) {
      const obj = byId.get(id);
      let on = declared;
      if (obj?.revalidate_days && check) {
        const early = addDays(check, -obj.revalidate_days);
        if (early < on) on = early;
      }
      out.push({ objective_id: id, kind: "item", source_id: item.id, tier, on });
    }
  }
  for (const talent of catalog.talents) {
    const data = state.talents.get(talent.id);
    if (!data) continue;
    const on = data.acquired_on || state.declared.get(`talent:${talent.id}`)!;
    for (const id of talent.proves) out.push({ objective_id: id, kind: "talent", source_id: talent.id, tier: null, on });
  }
  return out;
}

/** Validations manuelles et preuves réunies : la plus récente date l'emporte. */
export function effectiveValidations(catalog: Catalog, state: State): Map<string, IsoDate> {
  const out = new Map([...state.validations].map(([id, v]) => [id, v.validated_at]));
  for (const p of proofs(catalog, state)) {
    const cur = out.get(p.objective_id);
    if (cur === undefined || p.on > cur) out.set(p.objective_id, p.on);
  }
  return out;
}

export interface Inputs {
  catalog: Catalog;
  household: HouseholdState;
  validations: Validation[];
  stock: StockLine[];
}

export function inputs(catalog: Catalog, state: State): Inputs | null {
  const h = state.household;
  if (!h) return null;
  return {
    catalog: withCustom(catalog, [...state.custom.values()]),
    household: {
      context: h.context,
      members: (h.members ?? []).map(memberOf),
      declared_tags: [...(h.tags ?? [])],
      target_context: h.target_context ?? null,
      priority_axes: [...(h.priority_axes ?? [])],
      goal_level: h.goal_level ?? null,
    },
    validations: [...effectiveValidations(catalog, state)].map(([objective_id, validated_at]) => ({ objective_id, validated_at })),
    stock: [...state.stock.values()].map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      total: Number(s.quantity) * Number(s.amount_per_unit),
      expires_on: s.expires_on || null,
    })),
  };
}

export function evaluateState(catalog: Catalog, state: State, today: IsoDate): Evaluation | null {
  const inp = inputs(catalog, state);
  return inp ? evaluate(inp.catalog, inp.household, inp.validations, inp.stock, today) : null;
}

function expirations(catalog: Catalog, state: State, after: IsoDate, until: IsoDate): [IsoDate, string][] {
  const full = withCustom(catalog, [...state.custom.values()]);
  const byId = new Map(full.objectives.map((o) => [o.id, o]));
  const found = new Map<IsoDate, string[]>();
  const add = (d: IsoDate, cause: string) => found.set(d, [...(found.get(d) ?? []), cause]);
  for (const [id, on] of effectiveValidations(catalog, state)) {
    const obj = byId.get(id);
    const expiry = obj ? validationExpiry(obj, on) : null;
    if (obj && expiry) {
      const d = addDays(expiry, GRACE_DAYS); // le tambour tombe à la fin du sursis
      if (after < d && d <= until) add(d, `revalidation dépassée « ${obj.title} »`);
    }
  }
  for (const s of state.stock.values()) {
    if (s.expires_on) {
      const d = addDays(s.expires_on, 1);
      if (after < d && d <= until) add(d, `péremption « ${s.name} »`);
    }
  }
  return [...found.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([d, causes]) => [d, [...causes].sort().join(", ")]);
}

export interface Snapshot {
  at: string;
  level: number;
  cause: string;
}
export interface JournalEntry {
  at: string;
  type: string;
  message: string;
  op_id: string | null;
}
export interface History {
  snapshots: Snapshot[];
  journal: JournalEntry[];
}

export function history(catalog: Catalog, ops: Op[], today: IsoDate): History {
  const state = emptyState();
  const snapshots: Snapshot[] = [];
  const journal: JournalEntry[] = [];
  let last: number | null = null;

  const check = (at: string, day: IsoDate, cause: string) => {
    const ev = evaluateState(catalog, state, day);
    if (!ev) {
      last = null;
      return;
    }
    if (ev.level !== last) {
      snapshots.push({ at, level: ev.level, cause });
      if (last !== null) {
        const direction = ev.level > last ? "monte" : "descend";
        journal.push({
          at,
          type: "level_changed",
          message: `Le foyer ${direction} au niveau ${ev.level} (${levelOf(catalog, ev.level).name}) : ${cause}`,
          op_id: null,
        });
      }
      last = ev.level;
    }
  };
  const runExpirations = (after: IsoDate | null, until: IsoDate) => {
    if (after === null || state.household === null) return;
    for (const [d, cause] of expirations(catalog, state, after, until)) check(`${d}T00:00:00.000Z`, d, cause);
  };

  let prev: IsoDate | null = null;
  for (const op of [...ops].sort(compareOps)) {
    const day = op.at.slice(0, 10);
    runExpirations(prev, day);
    const [message, cause] = apply(catalog, state, op);
    journal.push({ at: op.at, type: op.type, message, op_id: op.id });
    check(op.at, day, cause);
    prev = day;
  }
  runExpirations(prev, today);
  return { snapshots, journal };
}
