import { describe, expect, it } from "vitest";
import { CATALOG } from "../engine/catalog";
import type { TalentData } from "../engine/replay";
import { buildTree, dependentChain, forContext, missingChain, talentState, unlocks } from "./talents";

const owned = (...ids: string[]) => new Map<string, TalentData>(ids.map((id) => [id, { talent_id: id, acquired_on: null, note: "" }]));
const talent = (id: string) => CATALOG.talents.find((t) => t.id === id)!;
const soin = CATALOG.specialties.find((s) => s.id === "soin")!;

describe("arbres de talents", () => {
  it("rend disponibles les talents dont tous les prérequis sont acquis", () => {
    expect(talentState(talent("soin.alerter"), owned())).toBe("available");
    expect(talentState(talent("soin.gqs"), owned())).toBe("locked");
    expect(talentState(talent("soin.gqs"), owned("soin.alerter"))).toBe("available");
    expect(talentState(talent("soin.gqs"), owned("soin.alerter", "soin.gqs"))).toBe("acquired");
  });

  it("donne le rang et le titre d'après le talent le plus haut acquis", () => {
    expect(buildTree(CATALOG, soin, owned())).toMatchObject({ rank: 0, title: null, acquired: 0, available: 3 });
    const tree = buildTree(CATALOG, soin, owned("soin.alerter", "soin.gqs", "soin.psc1"));
    expect(tree).toMatchObject({ rank: 3, title: soin.titles[2], acquired: 3, total: 13 });
    expect(tree.nodes.find((n) => n.talent.id === "soin.isole")?.state).toBe("available");
  });

  it("liste les prérequis manquants, du plus bas au plus haut", () => {
    expect(missingChain(CATALOG, "soin.psc1", owned()).map((t) => t.id)).toEqual(["soin.alerter", "soin.gqs", "soin.psc1"]);
    expect(missingChain(CATALOG, "soin.psc1", owned("soin.alerter")).map((t) => t.id)).toEqual(["soin.gqs", "soin.psc1"]);
    const master = missingChain(CATALOG, "soin.maitre", owned());
    expect(master).toHaveLength(9); // les plantes médicinales ne sont plus exigées
    expect(master.at(-1)?.id).toBe("soin.maitre");
  });

  it("retire un talent avec ceux qui en dépendent, du plus haut au plus bas", () => {
    const acquired = owned("soin.alerter", "soin.gqs", "soin.psc1", "soin.respiration");
    expect(dependentChain(CATALOG, "soin.alerter", acquired).map((t) => t.id)).toEqual(["soin.psc1", "soin.gqs", "soin.alerter"]);
    expect(dependentChain(CATALOG, "soin.respiration", acquired).map((t) => t.id)).toEqual(["soin.respiration"]);
  });

  it("indique ce qu'un talent débloque", () => {
    expect(unlocks(CATALOG, "physique.marche").map((t) => t.id)).toEqual(["physique.endurance", "physique.porteur"]);
  });

  it("retire en appartement les talents réservés à la campagne, sans bloquer le maître", () => {
    const flat = forContext(CATALOG, "appartement");
    expect(flat.talents.some((t) => t.id === "brico.tronconneuse")).toBe(false);
    expect(flat.talents.find((t) => t.id === "brico.maitre")?.requires).toEqual(["brico.installations", "brico.mecanique"]);
    expect(forContext(CATALOG, "rural").talents.some((t) => t.id === "brico.tronconneuse")).toBe(true);
  });
});
