"""Traduction des réponses de l'interview en tags, validations, objectifs et stocks initiaux."""

from __future__ import annotations

from dataclasses import dataclass, field

from .catalog import Catalog, Question
from .engine import HouseholdState, daily_need

Answer = str | list[str] | float | int | None


@dataclass
class NewStock:
    name: str
    category: str
    quantity: float
    unit_label: str
    amount_per_unit: float


@dataclass
class InterviewResult:
    tags: set[str] = field(default_factory=set)
    validates: set[str] = field(default_factory=set)
    sets: dict[str, int | str] = field(default_factory=dict)
    lists: dict[str, list[str]] = field(default_factory=dict)
    stock: list[NewStock] = field(default_factory=list)


def is_visible(q: Question, answers: dict[str, Answer], context: str, tags: set[str]) -> bool:
    cond = q.show_if
    if cond is None:
        return True
    if cond.context_in is not None and context not in cond.context_in:
        return False
    if cond.tags_any is not None and not tags & set(cond.tags_any):
        return False
    if cond.answer is not None:
        given = answers.get(cond.answer["question"])
        expected = cond.answer["includes"]
        if not (given == expected or (isinstance(given, list) and expected in given)):
            return False
    return True


def apply_answers(catalog: Catalog, state: HouseholdState, answers: dict[str, Answer]) -> InterviewResult:
    """Applique les réponses dans l'ordre du questionnaire ; les questions masquées sont ignorées."""
    result = InterviewResult()
    tags = state.tags(catalog)
    for q in catalog.questions:
        if not is_visible(q, answers, state.context, tags | result.tags):
            continue
        given = answers.get(q.id)
        if given is None or given == "":
            continue
        result.validates.update(q.answered_validates)
        if given == []:
            continue
        if q.type == "number":
            qty = float(given)  # type: ignore[arg-type]
            spec = q.creates_stock
            if spec and qty > 0:
                per_unit = (
                    daily_need(catalog, spec.category, state)
                    if spec.amount_per_unit == "household_day"
                    else float(spec.amount_per_unit)
                )
                if per_unit > 0:
                    result.stock.append(NewStock(spec.name, spec.category, qty, spec.unit_label, per_unit))
            continue
        chosen = given if isinstance(given, list) else [str(given)]
        if q.options_from == "axes" and q.sets_list:
            valid_axes = {a.id for a in catalog.axes}
            result.lists[q.sets_list] = [v for v in chosen if v in valid_axes]
            continue
        for opt in q.options:
            if opt.value in chosen:
                result.tags.update(opt.tags)
                result.validates.update(opt.validates)
                result.sets.update(opt.sets)
    return result
