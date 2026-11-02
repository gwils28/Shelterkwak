import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { type StockIn, type StockItem, api } from "../api";
import { AutonomyCards } from "../components/AutonomyCards";
import { useAction, useCatalog, useDashboard } from "../hooks";
import { formatDate, formatNumber, today, unitLabel } from "../lib/format";

const EMPTY: StockIn = { name: "", category: "eau", quantity: 1, unit_label: "", amount_per_unit: 1, expires_on: null };

const HINTS: Record<string, string> = {
  eau: "Ex. : 6 bouteilles de 1,5 L → quantité 6, contenu par unité 1,5 L.",
  alimentation:
    "Calories par unité (sur l'étiquette) : boîte de lentilles 400 g ≈ 400 kcal, paquet de pâtes 500 g ≈ 1 800 kcal, riz 1 kg ≈ 3 600 kcal.",
  traitements: "Nombre de jours de traitement par boîte.",
  cuisson: "Nombre de jours de cuisson par unité (une cartouche de gaz de 450 g ≈ 3 jours pour 2 personnes).",
};

export function InventoryPage() {
  const catalog = useCatalog();
  const dashboard = useDashboard();
  const stock = useQuery({ queryKey: ["stock"], queryFn: api.stock });
  const [form, setForm] = useState<StockIn>(EMPTY);
  const [editing, setEditing] = useState<number | null>(null);
  const save = useAction((body: StockIn) => (editing ? api.updateStock(editing, body) : api.addStock(body)));
  const remove = useAction((id: number) => api.deleteStock(id));

  if (!catalog.data || !stock.data || !dashboard.data) return null;
  const categories = Object.fromEntries(catalog.data.categories.map((c) => [c.id, c]));
  const now = today();
  const soon = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate(form, {
      onSuccess: () => {
        setForm({ ...EMPTY, category: form.category });
        setEditing(null);
      },
    });
  };
  const edit = (s: StockItem) => {
    setEditing(s.id);
    setForm({ name: s.name, category: s.category, quantity: s.quantity, unit_label: s.unit_label, amount_per_unit: s.amount_per_unit, expires_on: s.expires_on });
  };

  return (
    <div className="page">
      <h1>Inventaire</h1>
      <section className="panel">
        <h2>Autonomie du foyer</h2>
        <p className="hint">Calculée sur les articles non périmés et les besoins journaliers de chaque membre. Repères : 3 j, 14 j, 3 mois, 6 mois.</p>
        <AutonomyCards autonomy={dashboard.data.autonomy} />
      </section>

      <section className="panel">
        <h2>{editing ? "Modifier un article" : "Ajouter un article"}</h2>
        <form className="stock-form" onSubmit={submit}>
          <label className="field">
            Catégorie
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {catalog.data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field grow">
            Article
            <input required value={form.name} placeholder="Packs d'eau, conserves de lentilles…" onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="field">
            Quantité
            <input type="number" min={0} step="any" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
          </label>
          <label className="field">
            Unité
            <input value={form.unit_label} placeholder="bouteille, boîte…" onChange={(e) => setForm({ ...form, unit_label: e.target.value })} />
          </label>
          <label className="field">
            Contenu par unité ({categories[form.category]?.unit})
            <input type="number" min={0} step="any" required value={form.amount_per_unit} onChange={(e) => setForm({ ...form, amount_per_unit: Number(e.target.value) })} />
          </label>
          <label className="field">
            Péremption
            <input type="date" value={form.expires_on ?? ""} onChange={(e) => setForm({ ...form, expires_on: e.target.value || null })} />
          </label>
          <div className="actions">
            {editing && (
              <button type="button" onClick={() => { setEditing(null); setForm(EMPTY); }}>
                Annuler
              </button>
            )}
            <button className="primary" disabled={save.isPending}>
              {editing ? "Enregistrer" : "Ajouter"}
            </button>
          </div>
        </form>
        <p className="hint">{HINTS[form.category]}</p>
        {save.error && <p className="warn-text">{save.error.message}</p>}
      </section>

      <section className="panel">
        <h2>Articles ({stock.data.length})</h2>
        {stock.data.length === 0 ? (
          <p className="empty">Inventaire vide.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Catégorie</th>
                  <th>Quantité</th>
                  <th>Total</th>
                  <th>Péremption</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {stock.data.map((s) => {
                  const state = s.expires_on && s.expires_on < now ? "expired" : s.expires_on && s.expires_on <= soon ? "expiring" : "";
                  const cat = categories[s.category];
                  return (
                    <tr key={s.id} className={state}>
                      <td>{s.name}</td>
                      <td>{cat?.name ?? s.category}</td>
                      <td>
                        {formatNumber(s.quantity)} {s.unit_label}
                      </td>
                      <td>
                        {formatNumber(s.quantity * s.amount_per_unit)} {unitLabel(cat?.unit ?? "", s.quantity * s.amount_per_unit)}
                      </td>
                      <td>
                        {formatDate(s.expires_on)}
                        {state === "expired" && " · périmé"}
                        {state === "expiring" && " · bientôt"}
                      </td>
                      <td className="row-actions">
                        <button className="link" onClick={() => edit(s)}>
                          Modifier
                        </button>
                        <button className="link danger" onClick={() => remove.mutate(s.id)}>
                          Retirer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
