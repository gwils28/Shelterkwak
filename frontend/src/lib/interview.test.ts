import { describe, expect, it } from "vitest";
import type { Question } from "../api";
import { isVisible, tagsFromMembers, visibleSections } from "./interview";

const q = (id: string, section: string, show_if: Question["show_if"] = null, options: Question["options"] = []): Question => ({
  id,
  section,
  type: "multi",
  text: id,
  help: "",
  unit: "",
  show_if,
  options,
});

describe("interview", () => {
  it("dérive les tags des membres", () => {
    const tags = tagsFromMembers([
      { name: "a", type: "adulte", medical: true },
      { name: "b", type: "bebe", medical: false },
    ]);
    expect([...tags].sort()).toEqual(["bebe", "traitement_medical"]);
  });

  it("filtre par contexte, tags et réponse", () => {
    expect(isVisible(q("x", "s", { context_in: ["rural"] }), {}, "appartement", new Set())).toBe(false);
    expect(isVisible(q("x", "s", { tags_any: ["vehicule"] }), {}, "rural", new Set(["vehicule"]))).toBe(true);
    expect(isVisible(q("x", "s", { answer: { question: "a", includes: "oui" } }), { a: ["oui"] }, "rural", new Set())).toBe(true);
  });

  it("regroupe par section et applique les tags issus des réponses", () => {
    const questions = [
      q("vehicule", "Env", null, [{ value: "oui", label: "Oui", tags: ["vehicule"] }]),
      q("carburant", "Env", { tags_any: ["vehicule"] }),
      q("eau", "Réserves"),
    ];
    const without = visibleSections(questions, {}, "appartement", []);
    expect(without.map((s) => s.questions.length)).toEqual([1, 1]);
    const withCar = visibleSections(questions, { vehicule: "oui" }, "appartement", []);
    expect(withCar[0].questions.map((x) => x.id)).toEqual(["vehicule", "carburant"]);
  });
});
