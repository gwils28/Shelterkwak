// Rejoue les cas calculés par le moteur Python de référence (fixtures/, générés par `make generate`).
import { describe, expect, it } from "vitest";
import engineCases from "../../../fixtures/engine.json";
import interviewCases from "../../../fixtures/interview.json";
import { CATALOG } from "./catalog";
import { memberOf } from "./engine";
import { applyAnswers, type Answer } from "./interview";
import { evaluateState, history, type Op, replay } from "./replay";

/** Arrondit les flottants pour absorber d'éventuels écarts de dernière décimale. */
function normalize(v: unknown): unknown {
  if (typeof v === "number") return Math.round(v * 1e9) / 1e9;
  if (Array.isArray(v)) return v.map(normalize);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normalize(x)]));
  return v;
}

interface EngineCase {
  name: string;
  today: string;
  ops: Op[];
  expected: { evaluation: unknown; history: unknown };
}

describe("parité du moteur avec Python", () => {
  for (const c of engineCases as unknown as EngineCase[]) {
    it(c.name, () => {
      const state = replay(CATALOG, c.ops);
      expect(normalize(evaluateState(CATALOG, state, c.today))).toEqual(normalize(c.expected.evaluation));
      expect(history(CATALOG, c.ops, c.today)).toEqual(c.expected.history);
    });
  }
});

interface InterviewCase {
  name: string;
  context: string;
  members: { type: string; medical?: boolean; conditions?: string[] }[];
  answers: Record<string, Answer>;
  expected: unknown;
}

describe("parité de l'interview avec Python", () => {
  for (const c of interviewCases as unknown as InterviewCase[]) {
    it(c.name, () => {
      const r = applyAnswers(
        CATALOG,
        {
          context: c.context,
          members: c.members.map(memberOf),
          declared_tags: [],
          target_context: null,
          priority_axes: [],
          goal_level: null,
        },
        c.answers,
      );
      expect(
        normalize({ tags: [...r.tags].sort(), validates: [...r.validates].sort(), sets: r.sets, lists: r.lists, stock: r.stock }),
      ).toEqual(normalize(c.expected));
    });
  }
});
