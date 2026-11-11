"""Chargement et validation du catalogue YAML (niveaux, axes, objectifs, besoins, interview)."""

from __future__ import annotations

import os
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel as _BaseModel
from pydantic import ConfigDict, Field, model_validator

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CATALOG_DIR = REPO_ROOT / "catalog"

ContextId = Literal["appartement", "periurbain", "rural"]
ALL_CONTEXTS: tuple[ContextId, ...] = ("appartement", "periurbain", "rural")
MAX_LEVEL = 9


class BaseModel(_BaseModel):
    """Refuse les clés inconnues : en YAML, une virgule non protégée dans `{label: a, b}` crée une clé `b`."""

    model_config = ConfigDict(extra="forbid")


class Level(BaseModel):
    n: int
    name: str
    horizon: str
    summary: str


class Axis(BaseModel):
    id: str
    name: str
    icon: str = ""


class NamedId(BaseModel):
    id: str
    name: str


class MemberCondition(BaseModel):
    """Particularité de santé ou physique d'un membre ; ajoute ses tags au foyer."""

    id: str
    name: str
    tags: list[str]


class CrisisNote(BaseModel):
    """Fiche de l'écran Crise, saisie librement par le foyer (opération notes.set)."""

    id: str
    name: str
    hint: str = ""


class ScenarioStep(BaseModel):
    """Étape réservée aux foyers qui portent l'un des tags."""

    text: str
    tags_any: list[str]


class Scenario(BaseModel):
    """Fiche réflexe : affichée si le foyer porte l'un des tags (toujours si la liste est vide)."""

    id: str
    name: str
    icon: str = ""
    tags_any: list[str] = Field(default_factory=list)
    group: Literal["secours", "situation"] = "situation"
    steps: list[str | ScenarioStep]


class StockRule(BaseModel):
    category: str
    min_days: float


class Objective(BaseModel):
    id: str
    axis: str
    level: int = Field(ge=1, le=MAX_LEVEL)
    title: str
    description: str = ""
    why: str = ""
    kind: Literal["check", "skill", "stock"] = "check"
    required: bool = True
    contexts: list[ContextId] = Field(default_factory=lambda: list(ALL_CONTEXTS))
    requires_tags: list[str] = Field(default_factory=list)
    excludes_tags: list[str] = Field(default_factory=list)  # non applicable si le foyer porte l'un de ces tags
    revalidate_days: int | None = None
    due_month: int | None = Field(default=None, ge=1, le=12)  # à refaire chaque année avant le 1er de ce mois
    stock: StockRule | None = None
    custom: bool = False  # objectif perso créé par le foyer

    @model_validator(mode="after")
    def _stock_consistency(self) -> Objective:
        if (self.kind == "stock") != (self.stock is not None):
            raise ValueError(f"{self.id}: `stock` est requis si et seulement si kind == 'stock'")
        if self.revalidate_days is not None and self.due_month is not None:
            raise ValueError(f"{self.id}: `revalidate_days` et `due_month` sont exclusifs")
        return self


class Category(BaseModel):
    id: str
    name: str
    unit: str
    daily_need: dict[str, float] = Field(default_factory=dict)
    per_household: float | None = None
    per_member_tag: str | None = None  # besoin de 1 par jour pour chaque membre portant ce tag
    applies_if: str | None = None


TierId = Literal["rustique", "commun", "confirme", "epique", "legendaire"]


class ItemTierName(BaseModel):
    id: TierId
    name: str


class ItemGroup(BaseModel):
    id: str
    name: str
    icon: str = ""


class BasketLine(BaseModel):
    """Ligne du panier type d'un palier de réserve. Son id est stocké dans le journal (`basket` d'un article).

    `share` : part des besoins du palier (en %), convertie par l'app en unités pour le foyer.
    """

    id: str
    name: str
    unit: str  # « paquet de 300 g », « boîte de 400 g »
    amount_per_unit: float = Field(gt=0)  # dans l'unité de la catégorie (kcal pour l'alimentation)
    share: int = Field(gt=0, le=100)
    keeps: str = ""  # conservation fermé, ordre de grandeur
    keeps_months: int | None = None  # pour proposer une date de péremption, à corriger avec l'emballage
    note: str = ""
    child: str = ""  # précaution affichée si le foyer compte un enfant ou un bébé


class ItemTier(BaseModel):
    """Palier de qualité ou de contenu d'un objet ; `min_days` pour une réserve (jours d'autonomie)."""

    tier: TierId
    contents: str = ""
    min_days: float | None = None
    proves: list[str] = Field(default_factory=list)  # objectifs validés par la possession de ce niveau
    objectives: list[str] = Field(default_factory=list)  # objectifs auxquels ce niveau contribue
    includes: list[str] = Field(default_factory=list)  # contenu minimal ajouté à ce niveau (contenants)
    basket: list[BasketLine] = Field(default_factory=list)  # panier type d'une réserve, pour ce palier
    basket_notes: list[str] = Field(default_factory=list)  # principes du panier, affichés sous la liste


class Item(BaseModel):
    """Carte de l'inventaire. Son id est stocké dans le journal (opération item.set)."""

    id: str
    group: str
    name: str
    icon: str = ""
    kind: Literal["equipement", "consommable", "reserve"]
    basis: Literal["qualite", "options", "quantite", "contenu", "autonomie"]  # ce qui fait monter le niveau
    category: str | None = None  # catégorie d'autonomie, pour une réserve
    description: str = ""
    caution: str = ""  # mise en garde (loi, santé, sécurité), affichée en tête de la fiche
    proves: list[str] = Field(default_factory=list)  # objectifs validés par la possession, à tout niveau
    objectives: list[str] = Field(default_factory=list)  # objectifs auxquels l'objet contribue
    tiers: list[ItemTier] = Field(default_factory=list)
    crisis: bool = False  # à retrouver le jour J : emplacement affiché dans l'écran Crise
    requires_tags: list[str] = Field(default_factory=list)  # carte proposée aux seuls foyers portant ce tag
    opt_in: bool = False  # carte sur demande : cachée sauf si le foyer la possède (« Voir aussi… »)

    @model_validator(mode="after")
    def _reserve_consistency(self) -> Item:
        if (self.kind == "reserve") != (self.category is not None):
            raise ValueError(f"{self.id}: `category` est requis si et seulement si kind == 'reserve'")
        if any((t.min_days is not None) != (self.kind == "reserve") for t in self.tiers):
            raise ValueError(f"{self.id}: `min_days` est requis sur chaque palier d'une réserve, et seulement là")
        if (self.kind == "reserve") != (self.basis == "autonomie"):
            raise ValueError(f"{self.id}: `basis: autonomie` est réservé aux réserves, et obligatoire pour elles")
        if (self.basis == "contenu") != all(t.includes for t in self.tiers):
            raise ValueError(f"{self.id}: un contenant liste `includes` à chaque niveau, et lui seul")
        if self.kind != "reserve" and any(t.basket for t in self.tiers):
            raise ValueError(f"{self.id}: un panier type (`basket`) est réservé aux réserves")
        ids = [line.id for t in self.tiers for line in t.basket]
        if len(ids) != len(set(ids)):
            raise ValueError(f"{self.id}: id de ligne de panier en double")
        for t in self.tiers:
            if t.basket and sum(line.share for line in t.basket) != 100:
                raise ValueError(f"{self.id}/{t.tier}: les parts du panier type doivent faire 100 %")
        return self


class PurchaseRef(BaseModel):
    """Modèle conseillé, prix en fourchette. Le premier d'un palier est le choix du Fourrier."""

    brand: str
    model: str
    price: str  # fourchette arrondie, « 25-35 € » ou « 150-180 $ »
    market: Literal["france", "europe", "usa"] = "france"  # où l'acheter : en France, en Europe, en import
    why: str = ""


class ItemReference(BaseModel):
    """Repères d'achat d'un palier d'une carte (catalog/references.yaml), tenus à jour par la revue du marché.

    Les critères passent avant les marques : ils restent vrais quand un modèle disparaît.
    """

    item: str
    tier: TierId
    criteria: str
    checked: date  # dernière vérification en ligne des modèles et des prix
    refs: list[PurchaseRef] = Field(min_length=2, max_length=3)


class Specialty(BaseModel):
    """Spécialité de l'onglet Compétences : un arbre de talents en colonnes (branches) et en rangs."""

    id: str
    name: str
    icon: str = ""
    description: str = ""
    branches: list[str] = Field(min_length=1, max_length=4)  # nom de chaque colonne de l'arbre
    titles: list[str] = Field(min_length=5, max_length=5)  # titre obtenu au rang le plus haut atteint


class Talent(BaseModel):
    """Talent d'un arbre. Son id est stocké dans le journal (opération talent.set) : il ne se renomme pas."""

    id: str
    specialty: str
    name: str
    icon: str = ""
    row: int = Field(ge=1, le=5)  # rang dans l'arbre, de novice (1) à maître (5)
    col: int = Field(ge=1)  # branche (colonne), à partir de 1
    description: str = ""
    criteria: str  # ce qui prouve qu'on l'a acquis
    contexts: list[ContextId] = Field(default_factory=lambda: list(ALL_CONTEXTS))  # lieux de vie où il s'affiche
    requires: list[str] = Field(default_factory=list)  # talents prérequis, tous exigés
    proves: list[str] = Field(default_factory=list)  # objectifs validés par ce talent
    objectives: list[str] = Field(default_factory=list)  # objectifs auxquels ce talent contribue


class ShowIf(BaseModel):
    context_in: list[ContextId] | None = None
    tags_any: list[str] | None = None
    answer: dict[str, str] | None = None  # {question: id, includes: value}


class Option(BaseModel):
    value: str
    label: str
    validates: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    sets: dict[str, int | str] = Field(default_factory=dict)


class CreatesStock(BaseModel):
    category: str
    name: str
    unit_label: str
    amount_per_unit: float | Literal["household_day"]


class Question(BaseModel):
    id: str
    section: str
    type: Literal["single", "multi", "number"]
    text: str
    help: str = ""
    unit: str = ""
    show_if: ShowIf | None = None
    options: list[Option] = Field(default_factory=list)
    options_from: Literal["axes"] | None = None
    sets_list: str | None = None
    creates_stock: CreatesStock | None = None
    answered_validates: list[str] = Field(default_factory=list)  # validés dès que la question a une réponse


class Catalog(BaseModel):
    levels: list[Level]
    axes: list[Axis]
    contexts: list[NamedId]
    member_types: list[NamedId]
    member_tags: dict[str, str]
    member_conditions: list[MemberCondition] = Field(default_factory=list)
    categories: list[Category]
    objectives: list[Objective]
    questions: list[Question]
    crisis_notes: list[CrisisNote] = Field(default_factory=list)
    scenarios: list[Scenario] = Field(default_factory=list)
    item_tiers: list[ItemTierName] = Field(default_factory=list)
    item_groups: list[ItemGroup] = Field(default_factory=list)
    items: list[Item] = Field(default_factory=list)
    references: list[ItemReference] = Field(default_factory=list)  # repères d'achat par carte et palier
    talent_ranks: list[str] = Field(default_factory=list)  # noms des cinq rangs des arbres
    specialties: list[Specialty] = Field(default_factory=list)
    talents: list[Talent] = Field(default_factory=list)

    def is_animal(self, member_type: str) -> bool:
        return self.member_tags.get(member_type) == "animaux"

    @property
    def objectives_by_id(self) -> dict[str, Objective]:
        return {o.id: o for o in self.objectives}

    @property
    def categories_by_id(self) -> dict[str, Category]:
        return {c.id: c for c in self.categories}

    def with_custom(self, customs: list[dict]) -> Catalog:
        """Catalogue augmenté des objectifs perso du foyer (ignorés s'ils sont invalides)."""
        extra: list[Objective] = []
        axis_ids = {a.id for a in self.axes}
        for c in customs:
            try:
                obj = Objective.model_validate(
                    {**c, "contexts": list(ALL_CONTEXTS), "requires_tags": [], "custom": True}
                )
            except ValueError:
                continue
            if obj.axis in axis_ids and obj.kind != "stock":
                extra.append(obj)
        if not extra:
            return self
        return self.model_copy(update={"objectives": [*self.objectives, *extra]})

    def level(self, n: int) -> Level:
        return next(lv for lv in self.levels if lv.n == n)

    @model_validator(mode="after")
    def _check_references(self) -> Catalog:
        errors: list[str] = []
        if [lv.n for lv in self.levels] != list(range(0, MAX_LEVEL + 1)):
            errors.append(f"les niveaux doivent être numérotés de 0 à {MAX_LEVEL} dans l'ordre")
        axis_ids = {a.id for a in self.axes}
        cat_ids = {c.id for c in self.categories}
        member_type_ids = {m.id for m in self.member_types}
        seen: set[str] = set()
        for o in self.objectives:
            if o.id in seen:
                errors.append(f"objectif en double : {o.id}")
            seen.add(o.id)
            if o.axis not in axis_ids:
                errors.append(f"{o.id}: axe inconnu {o.axis}")
            if o.stock and o.stock.category not in cat_ids:
                errors.append(f"{o.id}: catégorie de stock inconnue {o.stock.category}")
        for c in self.categories:
            unknown = set(c.daily_need) - member_type_ids
            if unknown:
                errors.append(f"catégorie {c.id}: types de membres inconnus {sorted(unknown)}")
        q_ids: set[str] = set()
        for q in self.questions:
            if q.id in q_ids:
                errors.append(f"question en double : {q.id}")
            q_ids.add(q.id)
            for opt in [*q.options, Option(value="*", label="", validates=q.answered_validates)]:
                for oid in opt.validates:
                    if oid not in seen:
                        errors.append(f"question {q.id}/{opt.value}: objectif inconnu {oid}")
            if q.creates_stock and q.creates_stock.category not in cat_ids:
                errors.append(f"question {q.id}: catégorie inconnue {q.creates_stock.category}")
            if q.type != "number" and not q.options and not q.options_from:
                errors.append(f"question {q.id}: aucune option")
        errors.extend(_item_errors(self, seen, cat_ids))
        errors.extend(_reference_errors(self))
        errors.extend(_talent_errors(self, seen))
        if errors:
            raise ValueError("Catalogue invalide :\n- " + "\n- ".join(errors))
        return self


def _item_errors(catalog: Catalog, objective_ids: set[str], cat_ids: set[str]) -> list[str]:
    """Références des cartes d'inventaire : groupe, catégorie, objectifs, ordre des paliers."""
    errors: list[str] = []
    rank = {t.id: i for i, t in enumerate(catalog.item_tiers)}
    group_ids = {g.id for g in catalog.item_groups}
    seen: set[str] = set()
    for it in catalog.items:
        if it.id in seen:
            errors.append(f"objet en double : {it.id}")
        seen.add(it.id)
        if it.group not in group_ids:
            errors.append(f"objet {it.id}: groupe inconnu {it.group}")
        if it.category is not None and it.category not in cat_ids:
            errors.append(f"objet {it.id}: catégorie inconnue {it.category}")
        for oid in [*it.proves, *it.objectives, *(o for t in it.tiers for o in [*t.proves, *t.objectives])]:
            if oid not in objective_ids:
                errors.append(f"objet {it.id}: objectif inconnu {oid}")
        for owner, links in [(it.id, it), *((f"{it.id}/{t.tier}", t) for t in it.tiers)]:
            errors.extend(_proof_errors(catalog, f"objet {owner}", links.proves, links.objectives, owner_is_item=True))
        errors.extend(_tier_order_errors(catalog, it))
        if [t.tier for t in it.tiers] != list(rank):
            errors.append(f"objet {it.id}: les cinq niveaux sont attendus, dans l'ordre ({', '.join(rank)})")
        days = [t.min_days for t in it.tiers if t.min_days is not None]
        if days != sorted(set(days)):
            errors.append(f"objet {it.id}: `min_days` doit croître d'un palier au suivant")
    return errors


def _reference_errors(catalog: Catalog) -> list[str]:
    """Repères d'achat : une carte et un palier existants, une seule entrée par palier, pas de réserve."""
    items = {it.id: it for it in catalog.items}
    errors: list[str] = []
    seen: set[tuple[str, str]] = set()
    for r in catalog.references:
        key = (r.item, r.tier)
        if key in seen:
            errors.append(f"repères d'achat en double : {r.item}/{r.tier}")
        seen.add(key)
        item = items.get(r.item)
        if item is None:
            errors.append(f"repères d'achat : objet inconnu {r.item}")
        elif item.kind == "reserve":
            errors.append(f"repères d'achat {r.item}: une réserve se compte en jours, pas en modèles")
    return errors


def _tier_order_errors(catalog: Catalog, item: Item) -> list[str]:
    """Un niveau ne remplit que des objectifs matériels, jamais plus bas que ceux du niveau précédent.

    Posséder un objet ne prouve pas une compétence : une compétence peut être liée à l'objet
    (`objectives`), pas à un niveau. Et un foyer qui monte les niveaux d'un objet doit rencontrer
    les objectifs dans l'ordre des paliers. Un objectif déjà lié plus bas (à l'objet ou à un niveau
    inférieur) peut être prouvé par un niveau plus haut : il ne compte pas pour l'ordre.
    """
    by_id = catalog.objectives_by_id
    errors: list[str] = []
    highest = 0
    seen = {*item.proves, *item.objectives}
    for t in item.tiers:
        links = [*t.proves, *t.objectives]
        objs = [by_id[o] for o in links if o in by_id]
        errors.extend(
            f"objet {item.id}/{t.tier}: {o.id} est une compétence, à lier à l'objet et non à un niveau"
            for o in objs
            if o.kind == "skill"
        )
        objs = [o for o in objs if o.id not in seen]
        seen.update(links)
        if objs and min(o.level for o in objs) < highest:
            errors.append(f"objet {item.id}/{t.tier}: objectif de niveau inférieur à celui d'un niveau précédent")
        highest = max([highest, *(o.level for o in objs)])
    return errors


def _talent_errors(catalog: Catalog, objective_ids: set[str]) -> list[str]:
    """Arbres de talents : une place par talent, des prérequis plus bas dans le même arbre."""
    errors: list[str] = []
    if catalog.talents and len(catalog.talent_ranks) != 5:
        errors.append("compétences : cinq rangs attendus (`ranks`)")
    specs = {s.id: s for s in catalog.specialties}
    talents = {t.id: t for t in catalog.talents}
    if len(talents) != len(catalog.talents):
        errors.append("talent en double")
    places: set[tuple[str, int, int]] = set()
    for t in catalog.talents:
        spec = specs.get(t.specialty)
        if spec is None:
            errors.append(f"talent {t.id}: spécialité inconnue {t.specialty}")
            continue
        if t.col > len(spec.branches):
            errors.append(f"talent {t.id}: colonne {t.col} hors des {len(spec.branches)} branches")
        if (t.specialty, t.row, t.col) in places:
            errors.append(f"talent {t.id}: place déjà prise (rang {t.row}, colonne {t.col})")
        places.add((t.specialty, t.row, t.col))
        if t.row > 1 and not t.requires:
            errors.append(f"talent {t.id}: un talent au-delà du premier rang a au moins un prérequis")
        for r in t.requires:
            req = talents.get(r)
            if req is None:
                errors.append(f"talent {t.id}: prérequis inconnu {r}")
            elif req.specialty != t.specialty or req.row >= t.row:
                errors.append(f"talent {t.id}: le prérequis {r} doit être plus bas dans le même arbre")
        errors.extend(
            f"talent {t.id}: objectif inconnu {o}" for o in [*t.proves, *t.objectives] if o not in objective_ids
        )
        errors.extend(_proof_errors(catalog, f"talent {t.id}", t.proves, t.objectives, owner_is_item=False))
    return errors


def _proof_errors(
    catalog: Catalog, owner: str, proves: list[str], objectives: list[str], owner_is_item: bool
) -> list[str]:
    """Liens « prouve » : jamais aussi « contribue », jamais un stock (calculé), jamais un savoir-faire pour un objet.

    Posséder prouve un état, jamais un savoir-faire : seul un talent prouve un objectif « skill ».
    Voir docs/conseil/2026-11-11.md.
    """
    by_id = catalog.objectives_by_id
    errors = [f"{owner}: {o} à la fois dans `proves` et `objectives`" for o in set(proves) & set(objectives)]
    for oid in proves:
        obj = by_id.get(oid)
        if obj is None:
            continue
        if obj.kind == "stock":
            errors.append(f"{owner}: {oid} est un objectif de stock, déjà calculé : il ne se prouve pas")
        elif obj.kind == "skill" and owner_is_item:
            errors.append(f"{owner}: {oid} est une compétence, qu'aucune possession ne prouve")
    return errors


def _read(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_catalog(directory: Path | None = None) -> Catalog:
    directory = directory or Path(os.environ.get("SHELTERKWAK_CATALOG", DEFAULT_CATALOG_DIR))
    axes = _read(directory / "axes.yaml")
    axis_rank = {a["id"]: i for i, a in enumerate(axes["axes"])}
    objectives: list[dict] = []
    for path in sorted((directory / "objectives").glob("*.yaml")):
        data = _read(path)
        for o in data.get("objectives", []):
            objectives.append({"axis": data["axis"], **o})
    # Ordre stable : niveau, puis ordre des axes déclaré dans axes.yaml, puis ordre du fichier.
    items = _read(directory / "items.yaml") if (directory / "items.yaml").exists() else {}
    skills = _read(directory / "talents.yaml") if (directory / "talents.yaml").exists() else {}
    refs = _read(directory / "references.yaml") if (directory / "references.yaml").exists() else {}
    objectives.sort(key=lambda o: (o.get("level", 0), axis_rank.get(o["axis"], len(axis_rank))))
    return Catalog(
        levels=_read(directory / "levels.yaml")["levels"],
        axes=axes["axes"],
        contexts=axes["contexts"],
        member_types=axes["member_types"],
        member_tags=axes.get("member_tags", {}),
        member_conditions=axes.get("member_conditions", []),
        categories=_read(directory / "needs.yaml")["categories"],
        objectives=objectives,
        questions=_read(directory / "interview.yaml")["questions"],
        crisis_notes=_read(directory / "crisis.yaml").get("notes", []),
        scenarios=_read(directory / "crisis.yaml").get("scenarios", []),
        item_tiers=items.get("tiers", []),
        item_groups=items.get("groups", []),
        items=items.get("items", []),
        references=refs.get("references", []),
        talent_ranks=skills.get("ranks", []),
        specialties=skills.get("specialties", []),
        talents=skills.get("talents", []),
    )


@lru_cache(maxsize=1)
def get_catalog() -> Catalog:
    return load_catalog()
