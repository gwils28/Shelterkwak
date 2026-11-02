import type { Answer, ContextId, MemberIn, Question } from "../api";

// Doit rester aligné sur `member_tags` (catalog/axes.yaml) et `is_visible` (backend/interview.py).
const MEMBER_TAGS: Record<string, string> = { enfant: "enfants", bebe: "bebe", senior: "seniors", animal: "animaux" };

export function tagsFromMembers(members: MemberIn[]): Set<string> {
  const tags = new Set<string>();
  for (const m of members) {
    if (MEMBER_TAGS[m.type]) tags.add(MEMBER_TAGS[m.type]);
    if (m.medical) tags.add("traitement_medical");
  }
  return tags;
}

export function answerTags(questions: Question[], answers: Record<string, Answer>): Set<string> {
  const tags = new Set<string>();
  for (const q of questions) {
    const given = answers[q.id];
    const chosen = Array.isArray(given) ? given : given == null ? [] : [String(given)];
    for (const opt of q.options) if (chosen.includes(opt.value)) opt.tags?.forEach((t) => tags.add(t));
  }
  return tags;
}

export function isVisible(q: Question, answers: Record<string, Answer>, context: ContextId, tags: Set<string>): boolean {
  const c = q.show_if;
  if (!c) return true;
  if (c.context_in && !c.context_in.includes(context)) return false;
  if (c.tags_any && !c.tags_any.some((t) => tags.has(t))) return false;
  if (c.answer) {
    const given = answers[c.answer.question];
    const ok = given === c.answer.includes || (Array.isArray(given) && given.includes(c.answer.includes));
    if (!ok) return false;
  }
  return true;
}

/** Sections dans l'ordre du questionnaire, avec leurs questions visibles. */
export function visibleSections(
  questions: Question[],
  answers: Record<string, Answer>,
  context: ContextId,
  members: MemberIn[],
): { section: string; questions: Question[] }[] {
  const tags = new Set([...tagsFromMembers(members), ...answerTags(questions, answers)]);
  const out: { section: string; questions: Question[] }[] = [];
  for (const q of questions) {
    if (!isVisible(q, answers, context, tags)) continue;
    const last = out[out.length - 1];
    if (last && last.section === q.section) last.questions.push(q);
    else out.push({ section: q.section, questions: [q] });
  }
  return out;
}
