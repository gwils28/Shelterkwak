import { describe, expect, it } from "vitest";
import { CATALOG } from "../engine/catalog";
import type { ItemData, StockData } from "../engine/replay";
import type { Autonomy, Objective } from "../model";
import { autonomyProjection, buildCards, byLocation, datedEntries, expiriesByMonth, nextDue, nextSteps, reserveTier, tierObjectiveIds } from "./inventory";

const item = (id: string) => CATALOG.items.find((i) => i.id === id)!;
const objective = (id: string, status: Objective["status"]): Objective =>
  ({ ...CATALOG.objectives.find((o) => o.id === id)!, status, progress: 0, validated_at: null, expires_on: null, source: null });

describe("inventaire", () => {
  it("cumule les objectifs des paliers jusqu'au palier choisi", () => {
    const trousse = item("trousse_secours");
    expect([...tierObjectiveIds(trousse, "rustique")]).toEqual(["sante.pharmacie_base"]);
    expect(tierObjectiveIds(trousse, "epique").has("sante.pharmacie")).toBe(true);
    expect(tierObjectiveIds(trousse, null).size).toBe(0);
    expect([...tierObjectiveIds(item("ouvre_boite"), "commun")]).toEqual(["alimentation.ouvre_boite"]);
  });

  it("déduit le palier d'une réserve de ses jours d'autonomie", () => {
    const eau = item("reserve_eau");
    expect(reserveTier(eau, 0.5)).toBeNull();
    expect(reserveTier(eau, 3)?.tier).toBe("commun");
    expect(reserveTier(eau, 400)?.tier).toBe("legendaire");
    expect(reserveTier(eau, null)).toBeNull();
  });

  it("grise ce qui manque, colore ce qu'on a, masque ce qui ne concerne pas le foyer", () => {
    const items = new Map<string, ItemData>([["trousse_secours", { item_id: "trousse_secours", tier: "confirme", quantity: 1, location: null, note: "" }]]);
    const stock = new Map<string, StockData>([
      ["s1", { id: "s1", name: "Packs", category: "eau", quantity: 6, unit_label: "pack", amount_per_unit: 9, expires_on: "2026-11-20", location: null }],
    ]);
    const autonomy: Autonomy[] = [
      { category: "eau", name: "Eau", unit: "L", need_per_day: 8, total: 54, days: 6.75, days_after_expiring: 0 },
      { category: "traitements", name: "Traitements", unit: "jour", need_per_day: 0, total: 0, days: null, days_after_expiring: null },
    ];
    const objectives = [objective("sante.pharmacie_base", "done"), objective("sante.trousse", "todo"), objective("sante.pharmacie", "todo"), objective("sante.adrenaline", "na")];
    const cards = new Map(buildCards(CATALOG, items, stock, autonomy, objectives, "2026-12-01").map((c) => [c.item.id, c]));

    const trousse = cards.get("trousse_secours")!;
    expect(trousse.owned && trousse.tier?.tier).toBe("confirme");
    expect([trousse.done, trousse.objectives.length]).toEqual([1, 3]);

    const eau = cards.get("reserve_eau")!;
    expect(eau.owned && eau.tier?.tier).toBe("commun");
    expect(eau.warn).toBe(true);

    expect(cards.get("adrenaline")!.relevant).toBe(false);
    expect(cards.get("reserve_traitements")!.relevant).toBe(false);
    expect(cards.get("lampes")!.owned).toBe(false);
  });

  it("a cinq niveaux pour chaque objet, et un contenu minimal à chaque niveau d'un contenant", () => {
    for (const it of CATALOG.items) {
      expect(it.tiers.map((t) => t.tier)).toEqual(CATALOG.item_tiers.map((t) => t.id));
      if (it.basis === "contenu") expect(it.tiers.every((t) => t.includes.length > 0)).toBe(true);
    }
  });

  it("propose le niveau qui remplit l'objectif ouvert le plus bas", () => {
    const items = new Map<string, ItemData>([["trousse_secours", { item_id: "trousse_secours", tier: "rustique", quantity: 1, location: "Cuisine", note: "" }]]);
    const objectives = [objective("sante.pharmacie_base", "done"), objective("sante.trousse", "todo"), objective("energie.lumiere", "todo")];
    const cards = buildCards(CATALOG, items, new Map(), [], objectives, "2026-12-01");
    const steps = nextSteps(cards);
    expect(steps.map((s) => [s.card.item.id, s.target?.tier])).toEqual([
      ["lampes", "rustique"],
      ["trousse_secours", "commun"],
    ]);
    expect(byLocation(cards)).toEqual([{ location: "Cuisine", names: ["Trousse de secours"] }]);

    const autonomy: Autonomy[] = [{ category: "eau", name: "Eau", unit: "L", need_per_day: 8, total: 8, days: 1, days_after_expiring: 1 }];
    const water = nextSteps(buildCards(CATALOG, new Map(), new Map(), autonomy, [objective("eau.stock_3j", "todo")], "2026-12-01"));
    expect(water.map((s) => [s.card.item.id, s.target.tier, s.missing])).toEqual([["reserve_eau", "commun", { amount: 16, unit: "L" }]]);
  });

  it("projette l'autonomie aux péremptions et compte les articles par mois", () => {
    const stock: StockData[] = [
      { id: "a", name: "Packs", category: "eau", quantity: 2, unit_label: "pack", amount_per_unit: 8, expires_on: "2027-01-10", location: null },
      { id: "b", name: "Bidon", category: "eau", quantity: 1, unit_label: "bidon", amount_per_unit: 8, expires_on: null, location: null },
      { id: "c", name: "Vieux pack", category: "eau", quantity: 1, unit_label: "pack", amount_per_unit: 8, expires_on: "2026-11-01", location: null },
    ];
    const autonomy: Autonomy[] = [{ category: "eau", name: "Eau", unit: "L", need_per_day: 8, total: 24, days: 3, days_after_expiring: 1 }];
    const [eau] = autonomyProjection(stock, autonomy, "2026-12-01", "2027-12-01");
    expect(eau.points).toEqual([
      { date: "2026-12-01", days: 3 },
      { date: "2027-01-11", days: 1 },
      { date: "2027-12-01", days: 1 },
    ]);
    const items = new Map<string, ItemData>([
      ["adrenaline", { item_id: "adrenaline", tier: "commun", quantity: 2, location: "Sac", note: "", expires_on: "2026-12-20" }],
    ]);
    const cards = buildCards(CATALOG, items, new Map(stock.map((s) => [s.id, s])), autonomy, [], "2026-12-31");
    const dated = datedEntries(cards, () => "Eau");
    expect(dated.map((d) => [d.id, d.kind])).toEqual([
      ["c", "article"],
      ["adrenaline", "equipement"],
      ["a", "article"],
    ]);
    expect(cards.find((c) => c.item.id === "adrenaline")!.warn).toBe(true);
    const months = expiriesByMonth(dated, "2026-12-01");
    expect(months).toHaveLength(12);
    expect(months[0].entries.map((e) => e.id)).toEqual(["adrenaline"]);
    expect(months[1].entries.map((e) => e.id)).toEqual(["a"]);
  });

  it("place l'échéance saisonnière au prochain 1er du mois", () => {
    expect(nextDue(11, "2026-11-08")).toBe("2027-11-01");
    expect(nextDue(11, "2026-10-31")).toBe("2026-11-01");
    expect(nextDue(6, "2026-11-08")).toBe("2027-06-01");
  });
});
