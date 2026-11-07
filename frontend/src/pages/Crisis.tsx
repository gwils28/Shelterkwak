import { useState } from "react";
import { householdTags } from "../engine/engine";
import { inputs } from "../engine/replay";
import type { CrisisNote } from "../engine/types";
import { formatDays } from "../lib/format";
import { actions, useFoyer } from "../store/hooks";

/** Écran du jour J : sobre, hors ligne, imprimable. Fiches réflexes du catalogue + fiches du foyer. */
export function CrisisPage() {
  const { catalog, state, dashboard } = useFoyer();
  if (!dashboard) return null;
  const inp = inputs(catalog, state);
  const tags = inp ? householdTags(inp.catalog, inp.household) : new Set<string>();
  const scenarios = catalog.scenarios.filter((s) => s.tags_any.length === 0 || s.tags_any.some((t) => tags.has(t)));
  const autonomy = dashboard.autonomy.filter((a) => a.days !== null);

  return (
    <div className="page crisis">
      <div className="page-head">
        <h1>🚨 Crise</h1>
        <button className="no-print" onClick={() => window.print()}>
          Imprimer la version papier
        </button>
      </div>
      <p className="hint no-print">
        Tout est sur ce téléphone, même sans réseau. Imprime cette page et range-la avec les papiers importants : le jour où la
        batterie est vide, c'est elle qui sert.
      </p>

      <section className="panel crisis-autonomy">
        <h2>Autonomie actuelle</h2>
        <ul>
          {autonomy.map((a) => (
            <li key={a.category}>
              <strong>{a.name}</strong> : {formatDays(a.days)}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Fiches du foyer</h2>
        <div className="crisis-notes">
          {catalog.crisis_notes.map((n) => (
            <NoteEditor key={n.id} note={n} text={state.notes.get(n.id) ?? ""} />
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Réflexes</h2>
        <div className="crisis-scenarios">
          {scenarios.map((s) => (
            <article key={s.id} className="scenario">
              <h3>
                {s.icon} {s.name}
              </h3>
              <ol>
                {s.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function NoteEditor({ note, text }: { note: CrisisNote; text: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? text;
  const dirty = draft !== null && draft !== text;
  return (
    <div className="crisis-note">
      <h3>{note.name}</h3>
      <textarea
        className="no-print"
        rows={Math.max(3, value.split("\n").length + 1)}
        value={value}
        placeholder={note.hint}
        aria-label={note.name}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="print-only note-text">{value || "—"}</div>
      {dirty && (
        <div className="actions no-print">
          <button onClick={() => setDraft(null)}>Annuler</button>
          <button
            className="primary"
            onClick={() => {
              void actions.setNote(note.id, draft);
              setDraft(null);
            }}
          >
            Enregistrer
          </button>
        </div>
      )}
    </div>
  );
}
