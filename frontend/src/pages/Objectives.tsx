import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { romanNumeral } from "../components/Column";
import { type CustomObjective, type Kind, levelOf } from "../engine/types";
import { formatDate, formatPeriod, MONTHS, STATUS_LABEL } from "../lib/format";
import type { Objective, Status } from "../model";
import { actions, useFoyer } from "../store/hooks";

const KIND_LABEL: Record<Kind, string> = { check: "Action", skill: "Compétence", stock: "Stock" };

export function ObjectivesPage() {
  const { catalog, objectives, state } = useFoyer();
  const [params, setParams] = useSearchParams();
  const [axis, setAxis] = useState("");
  const [status, setStatus] = useState<"" | Status | "open">("");
  const [showNa, setShowNa] = useState(false);
  const [editing, setEditing] = useState<CustomObjective | "new" | null>(null);
  const level = Number(params.get("niveau") ?? 0);

  const filtered = useMemo(
    () =>
      objectives.filter(
        (o) =>
          (!level || o.level === level) &&
          (!axis || o.axis === axis) &&
          (showNa || o.status !== "na") &&
          (!status || (status === "open" ? ["todo", "expired", "expiring", "grace"].includes(o.status) : o.status === status)),
      ),
    [objectives, level, axis, status, showNa],
  );

  const axes = Object.fromEntries(catalog.axes.map((a) => [a.id, a]));
  const byLevel = new Map<number, Objective[]>();
  for (const o of filtered) byLevel.set(o.level, [...(byLevel.get(o.level) ?? []), o]);
  const levels = [...byLevel.keys()].sort((a, b) => a - b);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Objectifs</h1>
        <button className="primary" onClick={() => setEditing("new")}>
          + Objectif perso
        </button>
      </div>

      {editing && (
        <CustomForm
          initial={editing === "new" ? null : editing}
          defaultLevel={level || 3}
          onClose={() => setEditing(null)}
        />
      )}

      <div className="filters">
        <select aria-label="Niveau" value={level || ""} onChange={(e) => setParams(e.target.value ? { niveau: e.target.value } : {})}>
          <option value="">Tous les niveaux</option>
          {catalog.levels.filter((l) => l.n >= 1).map((l) => (
            <option key={l.n} value={l.n}>
              {l.n} · {l.name}
            </option>
          ))}
        </select>
        <select aria-label="Axe" value={axis} onChange={(e) => setAxis(e.target.value)}>
          <option value="">Tous les axes</option>
          {catalog.axes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select aria-label="Statut" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="">Tous les statuts</option>
          <option value="open">À traiter</option>
          {(["todo", "done", "expiring", "grace", "expired"] as Status[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <label className="inline">
          <input type="checkbox" checked={showNa} onChange={(e) => setShowNa(e.target.checked)} />
          Afficher les non applicables
        </label>
      </div>

      {levels.map((n) => (
        <section key={n} className="panel">
          <h2>
            <span className="roman">{romanNumeral(n)}</span> {levelOf(catalog, n).name}
            <span className="hint"> — {levelOf(catalog, n).summary}</span>
          </h2>
          <ul className="objectives">
            {byLevel.get(n)!.map((o) => {
              const done = o.status === "done" || o.status === "expiring" || o.status === "grace";
              // Atteint par un objet ou un talent : on ne décoche pas, on renvoie vers sa fiche.
              const proved = done && o.proofs.length > 0;
              return (
                <li key={o.id} className={`objective ${o.status}`}>
                  {o.kind === "stock" ? (
                    <Link to="/inventaire" className="tick ghost" title="Calculé depuis l'inventaire">
                      {done ? "✓" : `${Math.round(o.progress * 100)}%`}
                    </Link>
                  ) : proved ? (
                    <Link to={o.proofs[0].to} className="tick on" title={`Atteint grâce à : ${o.proofs.map((p) => p.label).join(", ")}`}>
                      ✓
                    </Link>
                  ) : (
                    <button
                      className={`tick${done ? " on" : ""}`}
                      disabled={o.status === "na"}
                      aria-label={done ? `Décocher ${o.title}` : `Valider ${o.title}`}
                      title={done ? "Décocher" : o.status === "expired" ? "Revalider aujourd'hui" : "Valider aujourd'hui"}
                      onClick={() => void actions.toggle(o.id, done)}
                    >
                      {done ? "✓" : o.status === "expired" ? "↻" : ""}
                    </button>
                  )}
                  <div className="objective-body">
                    <div className="item-title">
                      <span aria-hidden>{axes[o.axis]?.icon}</span> {o.title}
                    </div>
                    {o.why && <div className="item-detail">{o.why}</div>}
                    <div className="badges">
                      <span className={`badge status-${o.status}`}>{STATUS_LABEL[o.status]}</span>
                      <span className="badge">{KIND_LABEL[o.kind]}</span>
                      {o.custom && <span className="badge perso">Perso</span>}
                      {!o.required && <span className="badge soft">Bonus</span>}
                      {o.revalidate_days ? <span className="badge soft">À refaire tous les {formatPeriod(o.revalidate_days)}</span> : null}
                      {o.due_month ? <span className="badge soft">Chaque année avant le 1er {MONTHS[o.due_month - 1]}</span> : null}
                      {o.validated_at && (
                        <span className="badge soft">
                          Validé le {formatDate(o.validated_at)}
                          {o.source === "interview" ? " (interview)" : ""}
                        </span>
                      )}
                      {o.expires_on && <span className="badge soft">Échéance {formatDate(o.expires_on)}</span>}
                      {o.proofs.length > 0 && (
                        <span className="badge proof">
                          {done ? "Atteint grâce à" : "Prouvé par"} :{" "}
                          {o.proofs.map((p, i) => (
                            <span key={`${p.kind}:${p.id}`}>
                              {i > 0 && ", "}
                              <Link to={p.to}>{p.label}</Link>
                            </span>
                          ))}
                        </span>
                      )}
                      {(o.status === "expiring" || o.status === "grace") && (
                        <button className="link" onClick={() => void actions.validate(o.id)}>
                          Revalider maintenant
                        </button>
                      )}
                      {o.custom && (
                        <button className="link" onClick={() => setEditing(state.custom.get(o.id) ?? null)}>
                          Modifier
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {filtered.length === 0 && <p className="empty">Aucun objectif ne correspond à ces filtres.</p>}
    </div>
  );
}

function CustomForm({
  initial,
  defaultLevel,
  onClose,
}: {
  initial: CustomObjective | null;
  defaultLevel: number;
  onClose: () => void;
}) {
  const { catalog } = useFoyer();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [why, setWhy] = useState(initial?.why ?? "");
  const [axis, setAxis] = useState(initial?.axis ?? catalog.axes[0].id);
  const [level, setLevel] = useState(initial?.level ?? Math.max(2, defaultLevel));
  const [kind, setKind] = useState<Kind>(initial?.kind ?? "check");
  const [required, setRequired] = useState(initial?.required ?? true);
  const [months, setMonths] = useState(initial?.revalidate_days ? String(Math.round(initial.revalidate_days / 30.4)) : "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    void actions.upsertCustom({
      id: initial?.id,
      title: title.trim(),
      why: why.trim(),
      axis,
      level,
      kind,
      required,
      revalidate_days: months ? Math.round(Number(months) * 30.4) : null,
    });
    onClose();
  };

  return (
    <section className="panel custom-form">
      <h2>{initial ? "Modifier l'objectif perso" : "Nouvel objectif perso"}</h2>
      <form onSubmit={save}>
        <label className="field">
          Objectif
          <input id="custom-title" required value={title} placeholder="Croquettes du chien pour 2 semaines" onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          Pourquoi (facultatif)
          <input id="custom-why" value={why} onChange={(e) => setWhy(e.target.value)} />
        </label>
        <div className="row">
          <label className="field">
            Axe
            <select id="custom-axis" value={axis} onChange={(e) => setAxis(e.target.value)}>
              {catalog.axes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Palier
            <select id="custom-level" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
              {catalog.levels.filter((l) => l.n >= 1).map((l) => (
                <option key={l.n} value={l.n}>
                  {l.n} · {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Type
            <select id="custom-kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
              <option value="check">Action ou équipement</option>
              <option value="skill">Compétence</option>
            </select>
          </label>
          <label className="field">
            À refaire tous les (mois)
            <input id="custom-months" type="number" min={1} placeholder="jamais" value={months} onChange={(e) => setMonths(e.target.value)} />
          </label>
        </div>
        <div className="options">
          <label className={`option${required ? " checked" : ""}`}>
            <input type="radio" name="custom-weight" checked={required} onChange={() => setRequired(true)} />
            Requis : bloque le palier tant qu'il n'est pas validé
          </label>
          <label className={`option${!required ? " checked" : ""}`}>
            <input type="radio" name="custom-weight" checked={!required} onChange={() => setRequired(false)} />
            Bonus : recommandé, ne bloque rien
          </label>
        </div>
        <div className="actions">
          {initial &&
            (confirmDelete ? (
              <>
                <span className="warn-text">Supprimer cet objectif et sa validation ?</span>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    void actions.deleteCustom(initial.id);
                    onClose();
                  }}
                >
                  Oui, supprimer
                </button>
              </>
            ) : (
              <button type="button" className="danger" onClick={() => setConfirmDelete(true)}>
                Supprimer
              </button>
            ))}
          <button type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="primary" disabled={!title.trim()}>
            Enregistrer
          </button>
        </div>
      </form>
    </section>
  );
}
