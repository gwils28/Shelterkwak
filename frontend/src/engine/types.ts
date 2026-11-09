// Types du catalogue tel qu'exporté par `python -m shelterkwak.export` (generated/catalog.json).

export type ContextId = "appartement" | "periurbain" | "rural";
export type Kind = "check" | "skill" | "stock";
export type Status = "na" | "todo" | "done" | "expiring" | "grace" | "expired";

export interface Level {
  n: number;
  name: string;
  horizon: string;
  summary: string;
}
export interface Axis {
  id: string;
  name: string;
  icon: string;
}
export interface NamedId {
  id: string;
  name: string;
}
export interface Category {
  id: string;
  name: string;
  unit: string;
  daily_need: Record<string, number>;
  per_household: number | null;
  per_member_tag: string | null; // 1 par jour pour chaque membre portant ce tag
  applies_if: string | null;
}
export interface Objective {
  id: string;
  axis: string;
  level: number;
  title: string;
  description: string;
  why: string;
  kind: Kind;
  required: boolean;
  contexts: ContextId[];
  requires_tags: string[];
  excludes_tags: string[];
  revalidate_days: number | null;
  due_month: number | null;
  stock: { category: string; min_days: number } | null;
  custom: boolean;
}
export interface Option {
  value: string;
  label: string;
  validates: string[];
  tags: string[];
  sets: Record<string, number | string>;
}
export interface Question {
  id: string;
  section: string;
  type: "single" | "multi" | "number";
  text: string;
  help: string;
  unit: string;
  show_if: {
    context_in: ContextId[] | null;
    tags_any: string[] | null;
    answer: { question: string; includes: string } | null;
  } | null;
  options: Option[];
  options_from: "axes" | null;
  sets_list: string | null;
  creates_stock: {
    category: string;
    name: string;
    unit_label: string;
    amount_per_unit: number | "household_day";
  } | null;
  answered_validates: string[];
}
export interface MemberCondition {
  id: string;
  name: string;
  tags: string[];
}
export interface CrisisNote {
  id: string;
  name: string;
  hint: string;
}
export interface ScenarioStep {
  text: string;
  tags_any: string[];
}
export interface Scenario {
  id: string;
  name: string;
  icon: string;
  tags_any: string[];
  group: "secours" | "situation";
  steps: (string | ScenarioStep)[];
}

/** Étapes d'une fiche qui concernent ce foyer (une étape ciblée ne s'affiche qu'aux foyers concernés). */
export function scenarioSteps(s: Scenario, tags: Set<string>): string[] {
  return s.steps.flatMap((step) => (typeof step === "string" ? [step] : step.tags_any.some((t) => tags.has(t)) ? [step.text] : []));
}
export type ItemKind = "equipement" | "consommable" | "reserve";
export interface ItemTierName {
  id: string;
  name: string;
}
export interface ItemGroup {
  id: string;
  name: string;
  icon: string;
}
export interface ItemTier {
  tier: string;
  contents: string;
  min_days: number | null; // jours d'autonomie, pour une réserve
  objectives: string[];
  includes: string[]; // contenu minimal ajouté à ce niveau (contenants)
}
/** Ce qui fait monter le niveau d'un objet. */
export type ItemBasis = "qualite" | "options" | "quantite" | "contenu" | "autonomie";
/** Carte de l'inventaire (catalog/items.yaml). */
export interface Item {
  id: string;
  group: string;
  name: string;
  icon: string;
  kind: ItemKind;
  basis: ItemBasis;
  category: string | null; // catégorie d'autonomie, pour une réserve
  description: string;
  caution: string; // mise en garde (loi, santé, sécurité), affichée en tête de la fiche
  objectives: string[];
  tiers: ItemTier[];
  crisis: boolean; // à retrouver le jour J : emplacement affiché dans l'écran Crise
  requires_tags: string[]; // carte proposée seulement si le foyer porte l'un de ces tags
  opt_in: boolean; // carte sur demande : cachée sauf si le foyer la possède
}
/** Où acheter un modèle : en France, ailleurs en Europe, ou en import des États-Unis. */
export type Market = "france" | "europe" | "usa";
/** Modèle conseillé, prix en fourchette. Le premier d'un palier est le choix du Fourrier. */
export interface PurchaseRef {
  brand: string;
  model: string;
  price: string;
  market: Market;
  why: string;
}
/** Repères d'achat d'un palier d'une carte (catalog/references.yaml). */
export interface ItemReference {
  item: string;
  tier: string;
  criteria: string; // ce qu'il faut regarder, quelle que soit la marque
  checked: string; // date ISO de la dernière vérification en ligne
  refs: PurchaseRef[];
}
export interface Specialty {
  id: string;
  name: string;
  icon: string;
  description: string;
  branches: string[]; // nom de chaque colonne de l'arbre
  titles: string[]; // titre obtenu au rang le plus haut atteint (5)
}
export interface Talent {
  id: string;
  specialty: string;
  name: string;
  icon: string;
  row: number; // rang, de 1 (novice) à 5 (maître)
  col: number; // branche, à partir de 1
  description: string;
  criteria: string; // ce qui prouve qu'on l'a acquis
  contexts: string[]; // lieux de vie où il s'affiche
  requires: string[]; // talents prérequis, tous exigés
  objectives: string[];
}
export interface Catalog {
  levels: Level[];
  axes: Axis[];
  contexts: NamedId[];
  member_types: NamedId[];
  member_tags: Record<string, string>;
  member_conditions: MemberCondition[];
  categories: Category[];
  objectives: Objective[];
  questions: Question[];
  crisis_notes: CrisisNote[];
  scenarios: Scenario[];
  item_tiers: ItemTierName[];
  item_groups: ItemGroup[];
  items: Item[];
  references: ItemReference[]; // repères d'achat par carte et palier
  talent_ranks: string[]; // noms des cinq rangs des arbres
  specialties: Specialty[];
  talents: Talent[];
}

export function isAnimal(catalog: Catalog, memberType: string): boolean {
  return catalog.member_tags[memberType] === "animaux";
}

export const MAX_LEVEL = 9;
export const ALL_CONTEXTS: ContextId[] = ["appartement", "periurbain", "rural"];

export function levelOf(catalog: Catalog, n: number): Level {
  return catalog.levels.find((l) => l.n === n)!;
}

/** Objectif perso tel que stocké dans le journal (`custom.upsert`). */
export interface CustomObjective {
  id: string;
  axis: string;
  level: number;
  title: string;
  why?: string;
  kind?: Kind;
  required?: boolean;
  revalidate_days?: number | null;
}

/** Équivalent de `Catalog.with_custom` : ajoute les objectifs perso valides. */
export function withCustom(catalog: Catalog, customs: CustomObjective[]): Catalog {
  const axes = new Set(catalog.axes.map((a) => a.id));
  const extra: Objective[] = [];
  for (const c of customs) {
    const kind = c.kind ?? "check";
    const ok =
      typeof c.id === "string" &&
      typeof c.title === "string" &&
      Number.isInteger(c.level) &&
      c.level >= 1 &&
      c.level <= MAX_LEVEL &&
      axes.has(c.axis) &&
      (kind === "check" || kind === "skill");
    if (!ok) continue;
    extra.push({
      id: c.id,
      axis: c.axis,
      level: c.level,
      title: c.title,
      description: "",
      why: c.why ?? "",
      kind,
      required: c.required ?? true,
      contexts: [...ALL_CONTEXTS],
      requires_tags: [],
      excludes_tags: [],
      revalidate_days: c.revalidate_days ?? null,
      due_month: null,
      stock: null,
      custom: true,
    });
  }
  return extra.length ? { ...catalog, objectives: [...catalog.objectives, ...extra] } : catalog;
}
