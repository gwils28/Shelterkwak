import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CATALOG } from "../engine/catalog";
import { memberOf } from "../engine/engine";
import { localToday } from "../engine/dates";
import type { Answer } from "../engine/interview";
import { applyAnswers } from "../engine/interview";
import { evaluateState, type HouseholdData, replay, type StockData } from "../engine/replay";
import { type CustomObjective, withCustom } from "../engine/types";
import { buildDashboard, buildObjectives } from "../model";
import { newId, store } from "./store";

export function useSnapshot() {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

/** Date du jour, rafraîchie à minuit tant que l'app reste ouverte. */
export function useToday(): string {
  const [today, setToday] = useState(localToday());
  useEffect(() => {
    const id = setInterval(() => setToday(localToday()), 60_000);
    return () => clearInterval(id);
  }, []);
  return today;
}

/** État du foyer rejoué depuis le journal, évalué au jour courant. */
export function useFoyer() {
  const snap = useSnapshot();
  const today = useToday();
  return useMemo(() => {
    const state = replay(CATALOG, snap.ops);
    const catalog = withCustom(CATALOG, [...state.custom.values()]);
    const ev = evaluateState(CATALOG, state, today);
    return {
      ready: snap.ready,
      ops: snap.ops,
      sync: snap.sync,
      today,
      state,
      catalog,
      dashboard: ev ? buildDashboard(catalog, state, ev) : null,
      objectives: ev ? buildObjectives(catalog, state, ev) : [],
    };
  }, [snap, today]);
}

export const actions = {
  validate: (objective_id: string) =>
    store.append("validation.set", { objective_id, validated_at: localToday(), note: "", source: "manual" }),
  unvalidate: (objective_id: string) => store.append("validation.delete", { objective_id }),
  toggle: (objective_id: string, done: boolean) => (done ? actions.unvalidate(objective_id) : actions.validate(objective_id)),
  upsertStock: (item: Omit<StockData, "id"> & { id?: string }) => store.append("stock.upsert", { ...item, id: item.id ?? newId() }),
  deleteStock: (id: string) => store.append("stock.delete", { id }),
  setHousehold: (h: HouseholdData) => store.append("household.set", { ...h }),
  upsertCustom: (c: Omit<CustomObjective, "id"> & { id?: string }) =>
    store.append("custom.upsert", { ...c, id: c.id ?? `perso.${newId()}` }),
  deleteCustom: (id: string) => store.append("custom.delete", { id }),
  setNote: (key: string, text: string) => store.append("notes.set", { key, text }),
  reset: () => store.append("reset", {}),

  /** Enregistre l'interview : une seule opération porte le foyer, les acquis et les stocks estimés. */
  commitOnboarding: (payload: OnboardingPayload) => store.append("onboarding", { ...payload }),
};

export interface OnboardingPayload {
  answers: Record<string, Answer>;
  household: HouseholdData;
  validations: { objective_id: string; validated_at: string; note: string; source: string }[];
  stock: StockData[];
}

/** Traduit les réponses de l'interview en contenu de l'opération `onboarding`. */
export function buildOnboarding(
  household: Omit<HouseholdData, "tags" | "priority_axes" | "goal_level" | "goal_horizon_months">,
  answers: Record<string, Answer>,
  today: string = localToday(),
): OnboardingPayload {
  const result = applyAnswers(
    CATALOG,
    {
      context: household.context,
      members: household.members.map(memberOf),
      declared_tags: [],
      target_context: household.target_context,
      priority_axes: [],
      goal_level: null,
    },
    answers,
  );
  return {
    answers,
    household: {
      ...household,
      tags: [...result.tags].sort(),
      priority_axes: result.lists.priority_axes ?? [],
      goal_level: result.sets.goal_level !== undefined ? Number(result.sets.goal_level) : null,
      goal_horizon_months: result.sets.goal_horizon_months !== undefined ? Number(result.sets.goal_horizon_months) : null,
    },
    validations: [...result.validates]
      .sort()
      .map((objective_id) => ({ objective_id, validated_at: today, note: "", source: "interview" })),
    stock: result.stock.map((s) => ({ ...s, id: newId(), expires_on: null })),
  };
}

/** Aperçu du tableau de bord qu'aurait le foyer après l'interview, sans rien enregistrer. */
export function previewOnboarding(payload: OnboardingPayload, today: string = localToday()) {
  const op = { id: "apercu", device: "apercu", at: new Date().toISOString(), type: "onboarding" as const, payload: { ...payload } };
  const state = replay(CATALOG, [op]);
  const ev = evaluateState(CATALOG, state, today)!;
  return buildDashboard(withCustom(CATALOG, []), state, ev);
}
