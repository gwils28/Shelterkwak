// Cartes de l'inventaire : ce que le foyer possède, à quel palier, et les objectifs qu'elles servent.
// Rien n'est calculé par le moteur : la carte se déduit des opérations item.set et des stocks.

import { addDays } from "../engine/dates";
import type { ItemData, StockData } from "../engine/replay";
import type { Catalog, Item, ItemTier, Status } from "../engine/types";
import type { Autonomy, Objective } from "../model";

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
  return [...new Set([...item.objectives, ...item.tiers.flatMap((t) => t.objectives)])];
}

/** Objectifs que l'objet remplit au palier donné (paliers précédents compris) ; sans palier, ceux de l'objet. */
export function tierObjectiveIds(item: Item, tierId: string | null): Set<string> {
  if (!item.tiers.length) return new Set(item.objectives);
  const ids = new Set<string>();
  for (const t of item.tiers) {
    t.objectives.forEach((o) => ids.add(o));
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
        relevant: owned || auto?.days !== null,
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
      relevant: data !== null || allLinks.length === 0 || linked.length > 0,
      warn: false,
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
}

/**
 * Prochains achats ou améliorations : pour chaque carte, le premier niveau au-dessus de l'actuel qui
 * remplit un objectif encore ouvert (une carte non possédée part de zéro). Trié par niveau de l'objectif (le plus urgent d'abord).
 */
export function nextSteps(cards: Card[]): NextStep[] {
  const out: NextStep[] = [];
  for (const card of cards) {
    if (!card.relevant || card.item.kind === "reserve") continue;
    const open = new Map(card.objectives.filter((o) => OPEN_STATUSES.includes(o.status)).map((o) => [o.id, o]));
    if (!open.size) continue;
    const current = card.tier ? card.item.tiers.indexOf(card.tier) : -1;
    // Seuls les objectifs qu'un niveau remplit comptent : ceux de l'objet lui-même n'y suffisent pas.
    const i = card.item.tiers.findIndex((t, n) => n > current && t.objectives.some((id) => open.has(id)));
    if (i < 0) continue;
    const target = card.item.tiers[i];
    out.push({ card, target, objective: open.get(target.objectives.find((id) => open.has(id))!)! });
  }
  return out.sort((a, b) => a.objective.level - b.objective.level);
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

/** Articles qui périment, regroupés par mois (AAAA-MM) sur les `months` prochains mois. */
export function expiriesByMonth(stock: StockData[], today: string, months = 12): { month: string; articles: StockData[] }[] {
  const out: { month: string; articles: StockData[] }[] = [];
  let [y, m] = today.slice(0, 7).split("-").map(Number);
  for (let i = 0; i < months; i++) {
    const month = `${y}-${String(m).padStart(2, "0")}`;
    out.push({ month, articles: stock.filter((s) => s.quantity > 0 && s.expires_on?.startsWith(month) && s.expires_on >= today) });
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
