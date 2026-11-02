import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export const useCatalog = () => useQuery({ queryKey: ["catalog"], queryFn: api.catalog, staleTime: Infinity });
export const useDashboard = () => useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard });
export const useObjectives = () => useQuery({ queryKey: ["objectives"], queryFn: api.objectives });

/** Mutation qui rafraîchit toutes les données du foyer une fois terminée. */
export function useAction<A>(fn: (arg: A) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "catalog" && q.queryKey[0] !== "interview" }),
  });
}

/** Valide / décoche un objectif. */
export function useToggleObjective() {
  return useAction(({ id, done }: { id: string; done: boolean }) => (done ? api.unvalidate(id) : api.validate(id)));
}
