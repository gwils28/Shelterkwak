import { useRef, useState } from "react";
import { MonumentPicker } from "../components/MonumentPicker";
import { monumentOf } from "../lib/monument";
import { useAnimationsPref } from "../lib/prefs";
import { MembersEditor } from "../components/MembersEditor";
import { syncLabel } from "../components/SyncBadge";
import { memberConditions } from "../engine/engine";
import { isAnimal } from "../engine/types";
import type { ContextId, HouseholdData } from "../model";
import { actions, useFoyer } from "../store/hooks";
import { store } from "../store/store";

// Tags déclarables à la main (les autres sont déduits des membres).
const DECLARABLE_TAGS: { id: string; label: string }[] = [
  { id: "vehicule", label: "Véhicule à moteur" },
  { id: "risque_inondation", label: "Risque d'inondation" },
  { id: "risque_froid", label: "Hivers rigoureux" },
  { id: "risque_industriel", label: "Site industriel ou nucléaire proche" },
  { id: "risque_seisme", label: "Séisme" },
  { id: "risque_incendie", label: "Feux de forêt" },
  { id: "risque_canicule", label: "Canicules" },
  { id: "risque_tempete", label: "Tempêtes ou orages" },
  { id: "risque_mouvement_terrain", label: "Glissement de terrain ou éboulements" },
  { id: "risque_epidemie", label: "Épidémie / crise sanitaire" },
  { id: "risque_cyber", label: "Cyberattaque / crise de désinformation" },
  { id: "risque_terrorisme", label: "Terrorisme" },
  { id: "risque_guerre", label: "Guerre" },
];

export function HouseholdPage() {
  const { catalog, dashboard, sync, ops } = useFoyer();
  const [form, setForm] = useState<HouseholdData | null>(dashboard ? structuredClone(dashboard.household) : null);
  const [animations, setAnimations] = useAnimationsPref();
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!form || !dashboard) return null;
  const set = (patch: Partial<HouseholdData>) => {
    setSaved(false);
    setForm({ ...form, ...patch });
  };
  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const valid = form.name.trim() && form.members.some((m) => !isAnimal(catalog, m.type)) && form.members.every((m) => m.name.trim());
  const derived = new Set<string>();
  for (const m of form.members) {
    if (catalog.member_tags[m.type]) derived.add(catalog.member_tags[m.type]);
    for (const c of memberConditions(m)) for (const t of catalog.member_conditions.find((x) => x.id === c)?.tags ?? []) derived.add(t);
  }

  const exportJournal = () => {
    if (exportUrl) URL.revokeObjectURL(exportUrl);
    setExportUrl(URL.createObjectURL(new Blob([store.exportJson()], { type: "application/json" })));
  };
  const importJournal = async (file: File) => {
    try {
      const added = await store.importJson(await file.text());
      setBackupMsg(`${added} opération(s) importée(s).`);
    } catch (e) {
      setBackupMsg((e as Error).message);
    }
  };
  const { text: syncText } = syncLabel(sync);

  return (
    <div className="page">
      <h1>Foyer</h1>
      <section className="panel">
        <h2>Membres</h2>
        <label className="field">
          Nom du foyer
          <input id="household-name" value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <MembersEditor
          members={form.members}
          types={catalog.member_types}
          conditions={catalog.member_conditions}
          onChange={(members) => set({ members })}
        />
        <p className="hint">Ajouter un membre augmente les besoins : ton niveau peut baisser si les réserves ne suivent pas.</p>
      </section>

      <section className="panel">
        <h2>Monument</h2>
        <p className="hint">La forme de ta progression. Changer de monument ne change rien au niveau.</p>
        <MonumentPicker value={monumentOf(form.monument)} onChange={(monument) => set({ monument })} />
        <label className="check-line">
          <input type="checkbox" checked={animations} onChange={(e) => setAnimations(e.target.checked)} />
          Animer le monument sur cet appareil (coupé d'office si le téléphone demande moins d'animations)
        </label>
      </section>

      <section className="panel">
        <h2>Lieu de vie</h2>
        <div className="row">
          <label className="field">
            Contexte actuel
            <select id="household-context" value={form.context} onChange={(e) => set({ context: e.target.value as ContextId })}>
              {catalog.contexts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Contexte visé
            <select
              id="household-target"
              value={form.target_context ?? ""}
              onChange={(e) => set({ target_context: (e.target.value || null) as ContextId | null })}
            >
              <option value="">Pas de projet</option>
              {catalog.contexts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Échéance
            <input id="household-target-date" type="date" value={form.target_date ?? ""} onChange={(e) => set({ target_date: e.target.value || null })} />
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
        {derived.size > 0 && <p className="hint">Déduit des membres : {[...derived].join(", ")}.</p>}
      </section>

      <section className="panel">
        <h2>Objectifs</h2>
        <div className="row">
          <label className="field">
            Palier visé
            <select id="household-goal" value={form.goal_level ?? ""} onChange={(e) => set({ goal_level: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Aucun</option>
              {catalog.levels.filter((l) => l.n >= 1).map((l) => (
                <option key={l.n} value={l.n}>
                  {l.n} · {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Horizon (mois)
            <input
              id="household-horizon"
              type="number"
              min={1}
              value={form.goal_horizon_months ?? ""}
              onChange={(e) => set({ goal_horizon_months: e.target.value ? Number(e.target.value) : null })}
            />
          </label>
        </div>
        <h3>Axes prioritaires</h3>
        <div className="options multi">
          {catalog.axes.map((a) => (
            <label key={a.id} className={`option${form.priority_axes.includes(a.id) ? " checked" : ""}`}>
              <input type="checkbox" checked={form.priority_axes.includes(a.id)} onChange={() => set({ priority_axes: toggleIn(form.priority_axes, a.id) })} />
              <span aria-hidden>{a.icon}</span> {a.name}
            </label>
          ))}
        </div>
      </section>

      <div className="actions sticky">
        {saved && <span className="ok-text">Enregistré ✓</span>}
        <button
          className="primary"
          disabled={!valid}
          onClick={() => {
            void actions.setHousehold({ ...form, name: form.name.trim(), members: form.members.map((m) => ({ ...m, name: m.name.trim() })) });
            setSaved(true);
          }}
        >
          Enregistrer
        </button>
      </div>

      <section className="panel">
        <h2>Synchronisation et sauvegarde</h2>
        <p>
          <strong>{syncText}</strong>
          {sync.message && <span className="hint"> — {sync.message}</span>}
        </p>
        <p className="hint">
          Les données vivent sur cet appareil ({ops.length} opération(s) dans le journal). Quand le serveur du PC est joignable
          (Tailscale), les modifications sont échangées automatiquement ; sinon elles attendent.
        </p>
        <div className="actions start">
          <button onClick={() => void store.sync()}>Synchroniser maintenant</button>
          <button onClick={exportJournal}>Préparer une sauvegarde</button>
          {exportUrl && (
            <a className="button-link" href={exportUrl} download={`shelterkwak-${new Date().toISOString().slice(0, 10)}.json`}>
              Télécharger la sauvegarde
            </a>
          )}
          <button onClick={() => fileInput.current?.click()}>Importer une sauvegarde</button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importJournal(f);
              e.target.value = "";
            }}
          />
        </div>
        {backupMsg && <p className="hint">{backupMsg}</p>}
      </section>

      <section className="panel danger-zone">
        <h2>Recommencer</h2>
        <p className="hint">
          Efface le foyer, les validations, l'inventaire et les objectifs perso, sur cet appareil et sur ceux qui se synchronisent
          avec lui, puis relance l'interview. Une sauvegarde préalable permet de revenir en arrière.
        </p>
        {confirmReset ? (
          <div className="actions start">
            <span className="warn-text">Tout effacer et recommencer l'interview ?</span>
            <button className="danger" onClick={() => void actions.reset()}>
              Oui, tout effacer
            </button>
            <button onClick={() => setConfirmReset(false)}>Annuler</button>
          </div>
        ) : (
          <button className="danger" onClick={() => setConfirmReset(true)}>
            Tout effacer
          </button>
        )}
      </section>
    </div>
  );
}
