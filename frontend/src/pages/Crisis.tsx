import { Fragment, type ReactNode, useEffect, useState } from "react";
import { householdTags } from "../engine/engine";
import { inputs } from "../engine/replay";
import { type CrisisNote, isAnimal, type Scenario, scenarioSteps } from "../engine/types";
import { formatDays } from "../lib/format";
import { actions, useFoyer } from "../store/hooks";

/** Litres d'eau par personne et par jour pour la seule boisson, en restriction. */
const DRINK_ONLY_L = 2;

const CALLS = [
  { href: "tel:15", label: "15", sub: "SAMU", tone: "danger" },
  { href: "tel:112", label: "112", sub: "Urgences", tone: "danger" },
  { href: "tel:18", label: "18", sub: "Pompiers", tone: "" },
  { href: "tel:17", label: "17", sub: "Police", tone: "" },
  { href: "sms:114", label: "114", sub: "SMS si parler est impossible", tone: "" },
];

/**
 * Écran du jour J, pensé pour quelqu'un sous stress : appeler d'abord, choisir sa situation,
 * puis retrouver contacts et réserves. Hors ligne et imprimable.
 */
export function CrisisPage() {
  const { catalog, state, dashboard } = useFoyer();

  // À l'impression, toutes les fiches s'ouvrent.
  useEffect(() => {
    const open = () => document.querySelectorAll<HTMLDetailsElement>(".crisis details").forEach((d) => (d.open = true));
    window.addEventListener("beforeprint", open);
    return () => window.removeEventListener("beforeprint", open);
  }, []);

  if (!dashboard) return null;
  const inp = inputs(catalog, state);
  const tags = inp ? householdTags(inp.catalog, inp.household) : new Set<string>();
  const shown = catalog.scenarios.filter((s) => s.tags_any.length === 0 || s.tags_any.some((t) => tags.has(t)));
  const firstAid = shown.filter((s) => s.group === "secours");
  const situations = shown.filter((s) => s.group !== "secours");

  const humans = (dashboard.household.members ?? []).filter((m) => !isAnimal(catalog, m.type)).length;
  const locations = (category: string) =>
    [...new Set([...state.stock.values()].filter((s) => s.category === category && s.location).map((s) => s.location as string))];
  const autonomy = dashboard.autonomy.filter((a) => a.days !== null);
  const gear = catalog.items.filter((i) => i.crisis && state.items.has(i.id)).map((i) => ({ item: i, data: state.items.get(i.id)! }));

  return (
    <div className="page crisis">
      <div className="page-head">
        <h1>🚨 Crise</h1>
        <button className="no-print" onClick={() => window.print()}>
          Imprimer
        </button>
      </div>

      <nav className="crisis-calls" aria-label="Appels d'urgence">
        {CALLS.map((c) => (
          <a key={c.href} href={c.href} className={`call ${c.tone}`}>
            <strong>{c.label}</strong>
            <span>{c.sub}</span>
          </a>
        ))}
      </nav>
      <p className="breathe">
        <strong>Respire.</strong> Inspire 4 secondes, expire 6 secondes, trois fois. Puis choisis ta situation.
      </p>

      <section className="panel">
        <h2>Premiers secours</h2>
        <ScenarioGrid scenarios={firstAid} tags={tags} />
      </section>

      <section className="panel">
        <h2>Situations</h2>
        <ScenarioGrid scenarios={situations} tags={tags} />
      </section>

      <section className="panel">
        <h2>Fiches du foyer</h2>
        <div className="crisis-notes">
          {catalog.crisis_notes.map((n) => (
            <NoteCard key={n.id} note={n} text={state.notes.get(n.id) ?? ""} />
          ))}
        </div>
      </section>

      {gear.length > 0 && (
        <section className="panel crisis-autonomy">
          <h2>Où est le matériel</h2>
          <ul>
            {gear.map(({ item, data }) => (
              <li key={item.id}>
                <span aria-hidden>{item.icon}</span> <strong>{item.name}</strong>
                {data.location ? (
                  <div className="where">📍 {data.location}</div>
                ) : (
                  <div className="where warn-text">Emplacement non noté : à préciser dans l'Inventaire</div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel crisis-autonomy">
        <h2>Réserves</h2>
        <ul>
          {autonomy.map((a) => {
            const where = locations(a.category);
            const drinkOnly = a.category === "eau" && humans > 0 ? a.total / (DRINK_ONLY_L * humans) : null;
            return (
              <li key={a.category}>
                <strong>{a.name}</strong> : {formatDays(a.days)}
                {drinkOnly !== null && <> · {formatDays(drinkOnly)} en ne gardant l'eau que pour boire</>}
                {where.length > 0 && <div className="where">📍 {where.join(", ")}</div>}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function ScenarioGrid({ scenarios, tags }: { scenarios: Scenario[]; tags: Set<string> }) {
  return (
    <div className="crisis-scenarios">
      {scenarios.map((s) => (
        <details key={s.id} className="scenario">
          <summary>
            <span className="scenario-icon" aria-hidden>
              {s.icon}
            </span>
            {s.name}
          </summary>
          <ol>
            {scenarioSteps(s, tags).map((step) => (
              <li key={step}>{linkify(step)}</li>
            ))}
          </ol>
        </details>
      ))}
    </div>
  );
}

/** Numéros de téléphone français (fixes, mobiles, 0 800, numéros courts d'urgence) rendus cliquables. */
const PHONE = /(\+33\s?[1-9](?:[\s.]?\d{2}){4}|0\s?[1-9](?:[\s.]?\d{2}){4}|0 ?800(?:[\s.]?\d{2}){3}|\b(?:3919|3114|119|112|114|15|17|18)\b)/g;

function linkify(text: string): ReactNode {
  const parts = text.split(PHONE);
  return parts.map((part, i) => {
    if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
    const digits = part.replace(/[\s.]/g, "");
    const scheme = digits === "114" ? "sms" : "tel";
    return (
      <a key={i} href={`${scheme}:${digits}`} className="phone">
        {part}
      </a>
    );
  });
}

/** Fiche du foyer : lue par défaut (numéros cliquables), modifiable derrière un bouton. */
function NoteCard({ note, text }: { note: CrisisNote; text: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;
  return (
    <div className="crisis-note">
      <div className="note-head">
        <h3>{note.name}</h3>
        {!editing && (
          <button className="link no-print" onClick={() => setDraft(text)}>
            Modifier
          </button>
        )}
      </div>
      {editing ? (
        <>
          <textarea
            className="no-print"
            rows={Math.max(4, draft.split("\n").length + 1)}
            value={draft}
            placeholder={note.hint}
            aria-label={note.name}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
          <div className="actions no-print">
            <button onClick={() => setDraft(null)}>Annuler</button>
            <button
              className="primary"
              onClick={() => {
                if (draft !== text) void actions.setNote(note.id, draft);
                setDraft(null);
              }}
            >
              Enregistrer
            </button>
          </div>
        </>
      ) : (
        <div className={`note-text${text ? "" : " empty"}`}>
          {text ? text.split("\n").map((line, i) => <div key={i}>{linkify(line) || " "}</div>) : <span>{note.hint}</span>}
        </div>
      )}
    </div>
  );
}
