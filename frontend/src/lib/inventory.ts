// Cartes de l'inventaire : ce que le foyer possède, à quel palier, et les objectifs qu'elles servent.
// Rien n'est calculé par le moteur : la carte se déduit des opérations item.set et des stocks.

import { addDays } from "../engine/dates";
import type { ItemData, StockData } from "../engine/replay";
import { type BasketLine, type Catalog, type Item, type ItemReference, type ItemTier, linksOf, type Status } from "../engine/types";
import type { Autonomy, Objective } from "../model";
import { formatNumber } from "./format";

export const DONE_STATUSES: Status[] = ["done", "expiring", "grace"];

export interface Card {
  item: Item;
  owned: boolean;
  /** Palier atteint (choisi pour un objet, déduit des jours d'autonomie pour une réserve). */
  tier: ItemTier | null;
  data: ItemData | null;
  autonomy: Autonomy | null;
  /** Articles de la catégorie, pour une réserve. */
  articles: StockData[];
  /** Objectifs liés qui s'appliquent au foyer, du plus bas palier au plus haut. */
  objectives: Objective[];
  done: number;
  /** La carte concerne le foyer (ou elle est possédée). */
  relevant: boolean;
  /** Un article de la réserve périme sous 30 jours ou est périmé. */
  warn: boolean;
}

/** Objectifs que l'objet sert, tous paliers confondus, sans doublon. */
export function itemObjectiveIds(item: Item): string[] {
  return [...new Set([...linksOf(item), ...item.tiers.flatMap(linksOf)])];
}

/** Objectifs que l'objet remplit au palier donné (paliers précédents compris) ; sans palier, ceux de l'objet. */
export function tierObjectiveIds(item: Item, tierId: string | null): Set<string> {
  if (!item.tiers.length) return new Set(linksOf(item));
  const ids = new Set<string>();
  for (const t of item.tiers) {
    linksOf(t).forEach((o) => ids.add(o));
    if (t.tier === tierId) break;
  }
  return tierId ? ids : new Set();
}

/** Palier le plus haut dont le seuil d'autonomie est atteint. */
export function reserveTier(item: Item, days: number | null): ItemTier | null {
  if (days === null) return null;
  return [...item.tiers].reverse().find((t) => t.min_days !== null && days >= t.min_days) ?? null;
}

export function buildCards(
  catalog: Catalog,
  items: Map<string, ItemData>,
  stock: Map<string, StockData>,
  autonomy: Autonomy[],
  objectives: Objective[],
  soon: string,
  tags: ReadonlySet<string> = new Set(),
): Card[] {
  const byObjective = new Map(objectives.map((o) => [o.id, o]));
  const byCategory = new Map(autonomy.map((a) => [a.category, a]));
  return catalog.items.map((item) => {
    const linked = itemObjectiveIds(item)
      .map((id) => byObjective.get(id))
      .filter((o): o is Objective => !!o && o.status !== "na")
      .sort((a, b) => a.level - b.level);
    const done = linked.filter((o) => DONE_STATUSES.includes(o.status)).length;
    if (item.kind === "reserve") {
      const auto = byCategory.get(item.category!) ?? null;
      const articles = [...stock.values()]
        .filter((s) => s.category === item.category)
        .sort((a, b) => (a.expires_on ?? "9999").localeCompare(b.expires_on ?? "9999") || a.name.localeCompare(b.name));
      const owned = (auto?.total ?? 0) > 0;
      const tier = reserveTier(item, auto?.days ?? null);
      return {
        item,
        owned,
        tier,
        data: null,
        autonomy: auto,
        articles,
        objectives: linked,
        done,
        relevant: owned || (auto !== null && auto.days !== null),
        warn: articles.some((s) => s.quantity > 0 && !!s.expires_on && s.expires_on <= soon),
      };
    }
    const data = items.get(item.id) ?? null;
    const tier = item.tiers.find((t) => t.tier === data?.tier) ?? null;
    const allLinks = itemObjectiveIds(item);
    return {
      item,
      owned: data !== null,
      tier,
      data,
      autonomy: null,
      articles: [],
      objectives: linked,
      done,
      relevant:
        data !== null ||
        (!item.opt_in &&
          (!item.requires_tags.length || item.requires_tags.some((t) => tags.has(t))) &&
          (allLinks.length === 0 || linked.length > 0)),
      warn: !!data?.expires_on && data.expires_on <= soon,
    };
  });
}

// ---------- État des lieux ----------

export const OPEN_STATUSES: Status[] = ["todo", "expired", "grace"];

export interface NextStep {
  card: Card;
  /** Niveau à atteindre. */
  target: ItemTier;
  objective: Objective;
  /** Pour une réserve : ce qui manque pour atteindre le niveau, dans l'unité de la catégorie. */
  missing: { amount: number; unit: string } | null;
}

/**
 * Prochains achats ou améliorations : pour chaque carte, le premier niveau au-dessus de l'actuel qui
 * remplit un objectif encore ouvert (une carte non possédée part de zéro). Trié par niveau de l'objectif (le plus urgent d'abord).
 */
export function nextSteps(cards: Card[]): NextStep[] {
  const out: NextStep[] = [];
  for (const card of cards) {
    if (!card.relevant) continue;
    const open = new Map(card.objectives.filter((o) => OPEN_STATUSES.includes(o.status)).map((o) => [o.id, o]));
    if (!open.size) continue;
    const current = card.tier ? card.item.tiers.indexOf(card.tier) : -1;
    // Seuls les objectifs qu'un niveau remplit comptent : ceux de l'objet lui-même n'y suffisent pas.
    const i = card.item.tiers.findIndex((t, n) => n > current && linksOf(t).some((id) => open.has(id)));
    if (i < 0) continue;
    const target = card.item.tiers[i];
    const auto = card.autonomy;
    const missing =
      card.item.kind === "reserve" && auto && target.min_days !== null
        ? { amount: Math.max(0, target.min_days - (auto.days ?? 0)) * auto.need_per_day, unit: auto.unit }
        : null;
    out.push({ card, target, objective: open.get(linksOf(target).find((id) => open.has(id))!)!, missing });
  }
  // Le palier le plus bas d'abord, et à palier égal ce qui est requis avant les bonus.
  return out.sort((a, b) => a.objective.level - b.objective.level || Number(b.objective.required) - Number(a.objective.required));
}

export interface ProjectionPoint {
  date: string;
  days: number;
}
export interface Projection {
  category: string;
  name: string;
  points: ProjectionPoint[];
}

/**
 * Autonomie de chaque catégorie dans le temps si l'on ne consomme rien et ne rachète rien : elle ne
 * baisse qu'aux péremptions (un article cesse de compter le lendemain de sa date).
 */
export function autonomyProjection(stock: StockData[], autonomy: Autonomy[], today: string, until: string): Projection[] {
  return autonomy
    .filter((a) => a.days !== null && a.need_per_day > 0)
    .map((a) => {
      const lines = stock.filter((s) => s.category === a.category && (!s.expires_on || s.expires_on >= today));
      let total = lines.reduce((sum, s) => sum + s.quantity * s.amount_per_unit, 0);
      const points: ProjectionPoint[] = [{ date: today, days: total / a.need_per_day }];
      const drops = new Map<string, number>();
      for (const s of lines) {
        if (!s.expires_on) continue;
        const d = addDays(s.expires_on, 1);
        if (d <= until) drops.set(d, (drops.get(d) ?? 0) + s.quantity * s.amount_per_unit);
      }
      for (const d of [...drops.keys()].sort()) {
        total -= drops.get(d)!;
        points.push({ date: d, days: Math.max(0, total) / a.need_per_day });
      }
      points.push({ date: until, days: points[points.length - 1].days });
      return { category: a.category, name: a.name, points };
    });
}

/** Ce qui a une date : articles des réserves (péremption) et objets (péremption ou vérification). */
export interface Dated {
  id: string;
  name: string;
  date: string;
  /** Article de réserve (péremption) ou objet (péremption d'un consommable, vérification d'un équipement). */
  kind: "article" | "consommable" | "equipement";
  detail: string;
}

export function datedEntries(cards: Card[], categoryName: (id: string) => string): Dated[] {
  const out: Dated[] = [];
  for (const c of cards) {
    for (const s of c.articles)
      if (s.quantity > 0 && s.expires_on)
        out.push({ id: s.id, name: s.name, date: s.expires_on, kind: "article", detail: `${formatNumber(s.quantity)} ${s.unit_label} · ${categoryName(s.category)}` });
    if (c.data?.expires_on && c.item.kind !== "reserve")
      out.push({ id: c.item.id, name: c.item.name, date: c.data.expires_on, kind: c.item.kind, detail: c.data.location ?? "" });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

/** Échéances regroupées par mois (AAAA-MM) sur les `months` prochains mois. */
export function expiriesByMonth(entries: Dated[], today: string, months = 12): { month: string; entries: Dated[] }[] {
  const out: { month: string; entries: Dated[] }[] = [];
  let [y, m] = today.slice(0, 7).split("-").map(Number);
  for (let i = 0; i < months; i++) {
    const month = `${y}-${String(m).padStart(2, "0")}`;
    out.push({ month, entries: entries.filter((e) => e.date.startsWith(month) && e.date >= today) });
    m += 1;
    if (m > 12) [y, m] = [y + 1, 1];
  }
  return out;
}

/** Ce qui est rangé où : objets possédés et articles, par emplacement déclaré. */
export function byLocation(cards: Card[]): { location: string; names: string[] }[] {
  const map = new Map<string, Set<string>>();
  const add = (loc: string | null | undefined, name: string) => {
    const key = loc?.trim() || "";
    map.set(key, (map.get(key) ?? new Set()).add(name));
  };
  for (const c of cards) {
    if (c.data) add(c.data.location, c.item.name);
    for (const s of c.articles) if (s.quantity > 0) add(s.location, s.name);
  }
  return [...map.entries()]
    .map(([location, names]) => ({ location, names: [...names].sort() }))
    .sort((a, b) => (a.location === "") !== (b.location === "") ? (a.location === "" ? 1 : -1) : b.names.length - a.names.length);
}

/** Prochaine échéance d'un objectif saisonnier : le 1er du mois `dueMonth` à venir (aujourd'hui exclu). */
export function nextDue(dueMonth: number, today: string): string {
  const year = Number(today.slice(0, 4));
  const thisYear = `${year}-${String(dueMonth).padStart(2, "0")}-01`;
  return thisYear > today ? thisYear : `${year + 1}-${String(dueMonth).padStart(2, "0")}-01`;
}

/** Objectifs saisonniers du foyer, du plus proche au plus lointain. */
export function seasonal(objectives: Objective[], today: string): { objective: Objective; due: string }[] {
  return objectives
    .filter((o) => o.due_month !== null && o.status !== "na")
    .map((o) => ({ objective: o, due: nextDue(o.due_month!, today) }))
    .sort((a, b) => a.due.localeCompare(b.due) || a.objective.level - b.objective.level);
}

/** Au-delà d'un an, un repère d'achat est à revérifier : modèles et prix changent vite. */
export const REFERENCE_STALE_DAYS = 365;

export interface PurchaseGuide extends ItemReference {
  next: boolean; // le palier à viser ensuite (premier palier au-dessus de celui du foyer)
  stale: boolean;
}

/** Repères d'achat d'une carte, dans l'ordre des paliers, en signalant le prochain palier à viser. */
export function purchaseGuide(catalog: Catalog, item: Item, ownedTier: string | null, today: string): PurchaseGuide[] {
  const rank = new Map(item.tiers.map((t, i) => [t.tier, i]));
  const owned = ownedTier === null ? -1 : (rank.get(ownedTier) ?? -1);
  const refs = catalog.references
    .filter((r) => r.item === item.id && rank.has(r.tier))
    .sort((a, b) => rank.get(a.tier)! - rank.get(b.tier)!);
  const next = refs.find((r) => rank.get(r.tier)! > owned);
  return refs.map((r) => ({ ...r, next: r === next, stale: addDays(r.checked, REFERENCE_STALE_DAYS) < today }));
}

// ---------- Panier type d'une réserve ----------

export type BasketStatus = "full" | "partial" | "empty";

export interface BasketRow {
  line: BasketLine;
  /** Unités à viser pour le foyer (au moins une). */
  target: number;
  /** Unités non périmées des articles reliés à la ligne. */
  have: number;
  status: BasketStatus;
}

export interface Basket {
  tier: ItemTier;
  days: number;
  /** Besoin du palier pour le foyer, dans l'unité de la catégorie. */
  need: number;
  rows: BasketRow[];
  full: number;
}

/**
 * Paniers types d'une réserve, un par palier qui en a un. Les quantités suivent les besoins du foyer :
 * part de la ligne × besoin quotidien × jours du palier, arrondi à l'unité supérieure.
 * Une ligne est remplie par les articles non périmés qui la citent (`basket`).
 */
export function reserveBaskets(item: Item, articles: StockData[], autonomy: Autonomy | null, today: string): Basket[] {
  const perDay = autonomy?.need_per_day ?? 0;
  const have = new Map<string, number>();
  for (const s of articles) {
    if (!s.basket || (s.expires_on && s.expires_on < today)) continue;
    have.set(s.basket, (have.get(s.basket) ?? 0) + s.quantity);
  }
  return item.tiers
    .filter((t) => t.basket.length && t.min_days)
    .map((tier) => {
      const days = tier.min_days!;
      const need = perDay * days;
      const rows = tier.basket.map((line): BasketRow => {
        const target = Math.max(1, Math.ceil((need * line.share) / 100 / line.amount_per_unit - 1e-9));
        const h = have.get(line.id) ?? 0;
        return { line, target, have: h, status: h >= target ? "full" : h > 0 ? "partial" : "empty" };
      });
      return { tier, days, need, rows, full: rows.filter((r) => r.status === "full").length };
    });
}

/** Date de péremption proposée pour un article ajouté depuis le panier (à corriger avec l'emballage). */
export function suggestedExpiry(line: BasketLine, today: string): string | null {
  if (!line.keeps_months) return null;
  const [y, m, d] = today.split("-").map(Number);
  const months = m - 1 + line.keeps_months;
  const year = y + Math.floor(months / 12);
  const month = months % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate(); // 31 janvier + 1 mois → 28 ou 29 février
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}
