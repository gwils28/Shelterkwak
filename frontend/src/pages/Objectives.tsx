import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Objective, Status } from "../api";
import { romanNumeral } from "../components/Column";
import { useCatalog, useObjectives, useToggleObjective } from "../hooks";
import { STATUS_LABEL, formatDate, formatPeriod } from "../lib/format";

const KIND_LABEL = { check: "Action", skill: "Compétence", stock: "Stock" } as const;

export function ObjectivesPage() {
  const catalog = useCatalog();
  const objectives = useObjectives();
  const toggle = useToggleObjective();
  const [params, setParams] = useSearchParams();
  const [axis, setAxis] = useState("");
  const [status, setStatus] = useState<"" | Status | "open">("");
  const [showNa, setShowNa] = useState(false);
  const level = Number(params.get("niveau") ?? 0);

  const filtered = useMemo(
    () =>
      (objectives.data ?? []).filter(
        (o) =>
          (!level || o.level === level) &&
          (!axis || o.axis === axis) &&
          (showNa || o.status !== "na") &&
          (!status || (status === "open" ? ["todo", "expired", "expiring"].includes(o.status) : o.status === status)),
      ),
    [objectives.data, level, axis, status, showNa],
  );

  if (!catalog.data || !objectives.data) return null;
  const axes = Object.fromEntries(catalog.data.axes.map((a) => [a.id, a]));
  const byLevel = new Map<number, Objective[]>();
  for (const o of filtered) byLevel.set(o.level, [...(byLevel.get(o.level) ?? []), o]);

  return (
    <div className="page">
      <h1>Objectifs</h1>
      <div className="filters">
        <select value={level || ""} onChange={(e) => setParams(e.target.value ? { niveau: e.target.value } : {})}>
          <option value="">Tous les niveaux</option>
          {catalog.data.levels.slice(1).map((l) => (
            <option key={l.n} value={l.n}>
              {l.n} · {l.name}
            </option>
          ))}
        </select>
        <select value={axis} onChange={(e) => setAxis(e.target.value)}>
          <option value="">Tous les axes</option>
          {catalog.data.axes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.icon} {a.name}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="">Tous les statuts</option>
          <option value="open">À traiter</option>
          {(["todo", "done", "expiring", "expired"] as Status[]).map((s) => (
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

      {[...byLevel.entries()].map(([n, list]) => (
        <section key={n} className="panel">
          <h2>
            <span className="roman">{romanNumeral(n)}</span> {catalog.data!.levels[n - 1].name}
            <span className="hint"> — {catalog.data!.levels[n - 1].summary}</span>
          </h2>
          <ul className="objectives">
            {list.map((o) => {
              const done = o.status === "done" || o.status === "expiring";
              return (
                <li key={o.id} className={`objective ${o.status}`}>
                  {o.kind === "stock" ? (
                    <Link to="/inventaire" className="tick ghost" title="Calculé depuis l'inventaire">
                      {done ? "✓" : `${Math.round(o.progress * 100)}%`}
                    </Link>
                  ) : (
                    <button
                      className={`tick${done ? " on" : ""}`}
                      disabled={o.status === "na" || toggle.isPending}
                      title={done ? "Décocher" : o.status === "expired" ? "Revalider aujourd'hui" : "Valider aujourd'hui"}
                      onClick={() => toggle.mutate({ id: o.id, done })}
                    >
                      {done ? "✓" : o.status === "expired" ? "↻" : ""}
                    </button>
                  )}
                  <div className="objective-body">
                    <div className="item-title">
                      {axes[o.axis]?.icon} {o.title}
                    </div>
                    {o.why && <div className="item-detail">{o.why}</div>}
                    <div className="badges">
                      <span className={`badge status-${o.status}`}>{STATUS_LABEL[o.status]}</span>
                      <span className="badge">{KIND_LABEL[o.kind]}</span>
                      {!o.required && <span className="badge soft">Bonus</span>}
                      {o.revalidate_days && <span className="badge soft">À refaire tous les {formatPeriod(o.revalidate_days)}</span>}
                      {o.validated_at && <span className="badge soft">Validé le {formatDate(o.validated_at)}{o.source === "interview" ? " (interview)" : ""}</span>}
                      {o.expires_on && <span className="badge soft">Échéance {formatDate(o.expires_on)}</span>}
                      {o.status === "expiring" && (
                        <button className="link" onClick={() => toggle.mutate({ id: o.id, done: false })}>
                          Revalider maintenant
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
