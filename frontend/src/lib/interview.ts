import { householdTags } from "../engine/engine";
import { type Answer, isVisible } from "../engine/interview";
import type { Catalog, ContextId, Question } from "../engine/types";
import type { MemberIn } from "../model";

/** Tags apportés par les réponses déjà données (pour afficher les questions qui en dépendent). */
export function answerTags(questions: Question[], answers: Record<string, Answer>): Set<string> {
  const tags = new Set<string>();
  for (const q of questions) {
    const given = answers[q.id];
    const chosen = Array.isArray(given) ? given : given == null ? [] : [String(given)];
    for (const opt of q.options) if (chosen.includes(opt.value)) opt.tags.forEach((t) => tags.add(t));
  }
  return tags;
}

/** Sections dans l'ordre du questionnaire, avec leurs questions visibles. */
export function visibleSections(
  catalog: Catalog,
  answers: Record<string, Answer>,
  context: ContextId,
  members: MemberIn[],
): { section: string; questions: Question[] }[] {
  const base = householdTags(catalog, {
    context,
    members,
    declared_tags: [],
    target_context: null,
    priority_axes: [],
    goal_level: null,
  });
  const tags = new Set([...base, ...answerTags(catalog.questions, answers)]);
  const out: { section: string; questions: Question[] }[] = [];
  for (const q of catalog.questions) {
    if (!isVisible(q, answers, context, tags)) continue;
    const last = out[out.length - 1];
    if (last && last.section === q.section) last.questions.push(q);
    else out.push({ section: q.section, questions: [q] });
  }
  return out;
}
