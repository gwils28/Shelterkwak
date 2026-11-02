// Port TypeScript de backend/src/shelterkwak/interview.py.

import { dailyNeed, type HouseholdState, householdTags } from "./engine";
import type { Catalog, Question } from "./types";

export type Answer = string | string[] | number | null;

export interface NewStock {
  name: string;
  category: string;
  quantity: number;
  unit_label: string;
  amount_per_unit: number;
}
export interface InterviewResult {
  tags: Set<string>;
  validates: Set<string>;
  sets: Record<string, number | string>;
  lists: Record<string, string[]>;
  stock: NewStock[];
}

export function isVisible(q: Question, answers: Record<string, Answer>, context: string, tags: Set<string>): boolean {
  const c = q.show_if;
  if (!c) return true;
  if (c.context_in && !(c.context_in as string[]).includes(context)) return false;
  if (c.tags_any && !c.tags_any.some((t) => tags.has(t))) return false;
  if (c.answer) {
    const given = answers[c.answer.question];
    const ok = given === c.answer.includes || (Array.isArray(given) && given.includes(c.answer.includes));
    if (!ok) return false;
  }
  return true;
}

export function applyAnswers(catalog: Catalog, state: HouseholdState, answers: Record<string, Answer>): InterviewResult {
  const result: InterviewResult = { tags: new Set(), validates: new Set(), sets: {}, lists: {}, stock: [] };
  const base = householdTags(catalog, state);
  for (const q of catalog.questions) {
    if (!isVisible(q, answers, state.context, new Set([...base, ...result.tags]))) continue;
    const given = answers[q.id];
    if (given === undefined || given === null || given === "") continue;
    q.answered_validates.forEach((v) => result.validates.add(v));
    if (Array.isArray(given) && given.length === 0) continue;
    if (q.type === "number") {
      const qty = Number(given);
      const spec = q.creates_stock;
      if (spec && qty > 0) {
        const perUnit =
          spec.amount_per_unit === "household_day" ? dailyNeed(catalog, spec.category, state) : Number(spec.amount_per_unit);
        if (perUnit > 0) {
          result.stock.push({ name: spec.name, category: spec.category, quantity: qty, unit_label: spec.unit_label, amount_per_unit: perUnit });
        }
      }
      continue;
    }
    const chosen = Array.isArray(given) ? given : [String(given)];
    if (q.options_from === "axes" && q.sets_list) {
      const valid = new Set(catalog.axes.map((a) => a.id));
      result.lists[q.sets_list] = chosen.filter((v) => valid.has(v));
      continue;
    }
    for (const opt of q.options) {
      if (chosen.includes(opt.value)) {
        opt.tags.forEach((t) => result.tags.add(t));
        opt.validates.forEach((v) => result.validates.add(v));
        Object.assign(result.sets, opt.sets);
      }
    }
  }
  return result;
}

/** Options affichables d'une question (les axes sont injectés pour `options_from: axes`). */
export function questionOptions(catalog: Catalog, q: Question): { value: string; label: string }[] {
  if (q.options_from === "axes") return catalog.axes.map((a) => ({ value: a.id, label: `${a.icon} ${a.name}` }));
  return q.options.map((o) => ({ value: o.value, label: o.label }));
}
