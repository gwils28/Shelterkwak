import { useEffect, useState } from "react";
import { type ContextId, type HouseholdIn, api } from "../api";
import { MembersEditor } from "../components/MembersEditor";
import { useAction, useCatalog, useDashboard } from "../hooks";

// Tags déclarables à la main (les autres sont déduits des membres).
const DECLARABLE_TAGS: { id: string; label: string }[] = [
  { id: "vehicule", label: "Véhicule à moteur" },
  { id: "risque_inondation", label: "Risque d'inondation" },
  { id: "risque_froid", label: "Hivers rigoureux" },
  { id: "risque_industriel", label: "Site industriel ou nucléaire proche" },
  { id: "risque_seisme", label: "Séisme" },
  { id: "risque_incendie", label: "Feux de forêt" },
  { id: "risque_canicule", label: "Canicules" },
];

export function HouseholdPage() {
  const catalog = useCatalog();
  const { data } = useDashboard();
  const [form, setForm] = useState<HouseholdIn | null>(null);
  const [saved, setSaved] = useState(false);
  const save = useAction((body: HouseholdIn) => api.updateHousehold(body));
  const reset = useAction(() => api.reset());

  useEffect(() => {
    if (data && !form) {
      const h = data.household;
      setForm({
        name: h.name,
        context: h.context,
        target_context: h.target_context,
        target_date: h.target_date,
        members: h.members.map(({ name, type, medical }) => ({ name, type, medical })),
        tags: h.tags,
        priority_axes: h.priority_axes,
        goal_level: h.goal_level,
        goal_horizon_months: h.goal_horizon_months,
      });
    }
  }, [data, form]);

  if (!catalog.data || !form || !data) return null;
  const set = (patch: Partial<HouseholdIn>) => {
    setSaved(false);
    setForm({ ...form, ...patch });
  };
  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const valid = form.name.trim() && form.members.some((m) => m.type !== "animal") && form.members.every((m) => m.name.trim());

  return (
    <div className="page">
      <h1>Foyer</h1>
      <section className="panel">
        <h2>Membres</h2>
        <label className="field">
          Nom du foyer
          <input value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <MembersEditor members={form.members} types={catalog.data.member_types} onChange={(members) => set({ members })} />
        <p className="hint">Ajouter un membre augmente les besoins : ton niveau peut baisser si les réserves ne suivent pas.</p>
      </section>

      <section className="panel">
        <h2>Lieu de vie</h2>
        <div className="row">
          <label className="field">
            Contexte actuel
            <select value={form.context} onChange={(e) => set({ context: e.target.value as ContextId })}>
              {catalog.data.contexts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Contexte visé
            <select value={form.target_context ?? ""} onChange={(e) => set({ target_context: (e.target.value || null) as ContextId | null })}>
              <option value="">Pas de projet</option>
              {catalog.data.contexts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Échéance
            <input type="date" value={form.target_date ?? ""} onChange={(e) => set({ target_date: e.target.value || null })} />
          </label>
        </div>
        <h3>Risques et particularités</h3>
        <div className="options multi">
          {DECLARABLE_TAGS.map((t) => (
            <label key={t.id} className={`option${form.tags.includes(t.id) ? " checked" : ""}`}>
              <input type="checkbox" checked={form.tags.includes(t.id)} onChange={() => set({ tags: toggleIn(form.tags, t.id) })} />
              {t.label}
            </label>
          ))}
        </div>
        {data.household.derived_tags.length > 0 && <p className="hint">Déduit des membres : {data.household.derived_tags.join(", ")}.</p>}
      </section>

      <section className="panel">
        <h2>Objectifs</h2>
        <div className="row">
          <label className="field">
            Palier visé
            <select value={form.goal_level ?? ""} onChange={(e) => set({ goal_level: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Aucun</option>
              {catalog.data.levels.slice(1).map((l) => (
                <option key={l.n} value={l.n}>
                  {l.n} · {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Horizon (mois)
            <input
              type="number"
              min={1}
              value={form.goal_horizon_months ?? ""}
              onChange={(e) => set({ goal_horizon_months: e.target.value ? Number(e.target.value) : null })}
            />
          </label>
        </div>
        <h3>Axes prioritaires</h3>
        <div className="options multi">
          {catalog.data.axes.map((a) => (
            <label key={a.id} className={`option${form.priority_axes.includes(a.id) ? " checked" : ""}`}>
              <input type="checkbox" checked={form.priority_axes.includes(a.id)} onChange={() => set({ priority_axes: toggleIn(form.priority_axes, a.id) })} />
              {a.icon} {a.name}
            </label>
          ))}
        </div>
      </section>

      <div className="actions sticky">
        {saved && <span className="ok-text">Enregistré ✓</span>}
        {save.error && <span className="warn-text">{save.error.message}</span>}
        <button className="primary" disabled={!valid || save.isPending} onClick={() => save.mutate(form, { onSuccess: () => setSaved(true) })}>
          Enregistrer
        </button>
      </div>

      <section className="panel danger-zone">
        <h2>Recommencer</h2>
        <p className="hint">Efface le foyer, les validations, l'inventaire et l'historique, puis relance l'interview.</p>
        <button
          className="danger"
          onClick={() => {
            if (window.confirm("Tout effacer et recommencer l'interview ?")) reset.mutate(undefined);
          }}
        >
          Tout effacer
        </button>
      </section>
    </div>
  );
}
