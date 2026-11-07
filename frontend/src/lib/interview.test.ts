import { describe, expect, it } from "vitest";
import { CATALOG } from "../engine/catalog";
import { visibleSections } from "./interview";

const ids = (s: ReturnType<typeof visibleSections>) => s.flatMap((x) => x.questions.map((q) => q.id));

describe("interview : questions visibles", () => {
  it("masque les questions de terrain en appartement", () => {
    const flat = ids(visibleSections(CATALOG, {}, "appartement", [{ name: "a", type: "adulte", conditions: [], medical: false }]));
    expect(flat).not.toContain("production");
    expect(ids(visibleSections(CATALOG, {}, "rural", [{ name: "a", type: "adulte", conditions: [], medical: false }]))).toContain("production");
  });

  it("pose la question des traitements seulement si un membre est sous traitement", () => {
    expect(ids(visibleSections(CATALOG, {}, "appartement", [{ name: "a", type: "adulte", conditions: [], medical: false }]))).not.toContain(
      "traitements_jours",
    );
    expect(ids(visibleSections(CATALOG, {}, "appartement", [{ name: "a", type: "adulte", conditions: ["traitement"], medical: true }]))).toContain(
      "traitements_jours",
    );
  });

  it("regroupe par section dans l'ordre du questionnaire", () => {
    const sections = visibleSections(CATALOG, {}, "appartement", [{ name: "a", type: "adulte", conditions: [], medical: false }]);
    expect(sections[0].section).toBe("Ton environnement");
    expect(new Set(sections.map((s) => s.section)).size).toBe(sections.length);
  });
});
