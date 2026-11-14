import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { romanNumeral } from "../components/Column";
import { type CustomObjective, type Kind, levelOf, MAX_LEVEL } from "../engine/types";
import { formatDate, formatPeriod, MONTHS, STATUS_LABEL } from "../lib/format";
import type { Axis, Objective, Status } from "../model";
import { actions, useFoyer } from "../store/hooks";

const KIND_LABEL: Record<Kind, string> = { check: "Action", skill: "Compétence", stock: "Stock" };

/** Onglets de statut : chacun regroupe les statuts qu'il montre. */
const TABS = [
  { id: "open", label: "À faire", statuses: ["todo", "expired", "expiring", "grace"] },
  { id: "renew", label: "À revalider", statuses: ["expired", "expiring", "grace"] },
  { id: "done", label: "Validés", statuses: ["done", "expiring", "grace"] },
  { id: "all", label: "Tout", statuses: ["todo", "done", "expiring", "grace", "expired"] },
] as const satisfies readonly { id: string; label: string; statuses: readonly Status[] }[];
type TabId = (typeof TABS)[number]["id"];

/** Groupes affichés dans un palier, dans cet ordre. */
const GROUPS: { id: string; title: string; tone: string; match: (o: Objective) => boolean }[] = [
  { id: "renew", title: "À revalider", tone: "warn", match: (o) => ["expired", "grace", "expiring"].includes(o.status) },
  { id: "required", title: "Requis", tone: "main", match: (o) => o.status === "todo" && o.required },
  { id: "bonus", title: "Bonus", tone: "soft", match: (o) => o.status === "todo" && !o.required },
  { id: "done", title: "Validés", tone: "ok", match: (o) => o.status === "done" },
  { id: "na", title: "Non applicables", tone: "soft", match: (o) => o.status === "na" },
];

const isDone = (o: Objective) => o.status === "done" || o.status === "expiring" || o.status === "grace";

export function ObjectivesPage() {
  const { catalog, objectives, dashboard, state } = useFoyer();
  const [params, setParams] = useSearchParams();
  const [axis, setAxis] = useState("");
  const [tab, setTab] = useState<TabId>("open");
  const [showNa, setShowNa] = useState(false);
  const [editing, setEditing] = useState<CustomObjective | "new" | null>(null);

  // Par défaut : le palier en cours de construction (celui qui suit le niveau atteint).
  const current = Math.min(Math.max((dashboard?.level ?? 0) + 1, 1), MAX_LEVEL);
  const raw = params.get("niveau");
  const all = raw === "tous";
  const level = all ? 0 : Number(raw) >= 1 && Number(raw) <= MAX_LEVEL ? Number(raw) : current;
  const goTo = (n: number | "tous") => setParams(n === current ? {} : { niveau: String(n) }, { replace: true });

  const inLevel = useMemo(() => objectives.filter((o) => all || o.level === level), [objectives, all, level]);
  const inAxis = useMemo(() => inLevel.filter((o) => !axis || o.axis === axis), [inLevel, axis]);
  const tabOf = (id: TabId) => TABS.find((t) => t.id === id)!;
  const countTab = (id: TabId) => inAxis.filter((o) => (tabOf(id).statuses as readonly Status[]).includes(o.status)).length;
  const shown = inAxis.filter(
    (o) => (tabOf(tab).statuses as readonly Status[]).includes(o.status) || (showNa && o.status === "na"),
  );
  const naCount = inAxis.filter((o) => o.status === "na").length;
  const axisCount = (id: string) => inLevel.filter((o) => o.axis === id && o.status !== "na").length;

  const axes = Object.fromEntries(catalog.axes.map((a) => [a.id, a]));
  const byLevel = new Map<number, Objective[]>();
  for (const o of shown) byLevel.set(o.level, [...(byLevel.get(o.level) ?? []), o]);
  const levels = [...byLevel.keys()].sort((a, b) => a - b);
  const tiers = new Map((dashboard?.tiers ?? []).map((t) => [t.n, t]));

  const info = all ? null : levelOf(catalog, level);
  const tier = all ? null : tiers.get(level);
  const reqPct = tier && tier.required_total ? Math.round((tier.required_done / tier.required_total) * 100) : 0;

  return (
    <div className="page objectives-page">
      <div className="page-head">
        <h1>Objectifs</h1>
        <button className="primary" onClick={() => setEditing("new")}>
          + Objectif perso
        </button>
      </div>

      {editing && (
        <CustomForm
          initial={editing === "new" ? null : editing}
          defaultLevel={level || current}
          onSaved={(n) => {
            if (!all) goTo(n);
            if (tab !== "all") setTab("open");
          }}
          onClose={() => setEditing(null)}
        />
      )}

      <section className="panel level-head">
        <div className="level-nav">
          <button
            className="icon"
            aria-label="Palier précédent"
            disabled={all || level <= 1}
            onClick={() => goTo(level - 1)}
          >
            ‹
          </button>
          <div className="level-nav-title">
            {info ? (
              <>
                <div className="eyebrow">
                  Palier {level} sur {MAX_LEVEL}
                  {level === current ? " · en cours" : level < current ? " · atteint" : ""}
                  {info.horizon !== "0" ? ` · horizon : ${info.horizon.toLowerCase()}` : ""}
                </div>
                <h2>
                  <span className="roman">{romanNumeral(level)}</span> {info.name}
                </h2>
              </>
            ) : (
              <>
                <div className="eyebrow">Paliers 1 à {MAX_LEVEL}</div>
                <h2>Tous les paliers</h2>
              </>
            )}
          </div>
          <button
            className="icon"
            aria-label="Palier suivant"
            disabled={all || level >= MAX_LEVEL}
            onClick={() => goTo(level + 1)}
          >
            ›
          </button>
        </div>
        {info && <p className="hint level-summary">{info.summary}</p>}
        {tier && tier.required_total > 0 && (
          <div className="level-meter">
            <div className="meter" role="progressbar" aria-valuenow={reqPct} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${reqPct}%` }} />
            </div>
            <small>
              <strong>
                {tier.required_done}/{tier.required_total}
              </strong>{" "}
              requis
              {tier.optional_total > 0 && ` · ${tier.optional_done}/${tier.optional_total} bonus`}
              {tier.cracked && " · fissuré : des validations ont expiré"}
            </small>
          </div>
        )}
        <nav className="level-strip" aria-label="Choisir un palier">
          {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((n) => {
            const t = tiers.get(n);
            return (
              <button
                key={n}
                className={`strip-step ${t?.state ?? "future"}${t?.cracked ? " cracked" : ""}${n === level && !all ? " selected" : ""}${n === current ? " now" : ""}`}
                aria-current={n === level && !all ? "page" : undefined}
                title={`${n} · ${levelOf(catalog, n).name}${n === current ? " (en cours)" : ""}`}
                onClick={() => goTo(n)}
              >
                {romanNumeral(n)}
              </button>
            );
          })}
          <button className={`strip-step all${all ? " selected" : ""}`} aria-current={all ? "page" : undefined} onClick={() => goTo("tous")}>
            Tous
          </button>
        </nav>
      </section>

      <div className="objectives-filters">
        <div className="segmented" role="group" aria-label="Statut">
          {TABS.map((t) => (
            <button key={t.id} aria-pressed={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
              {t.label}
              <span className="count">{countTab(t.id)}</span>
            </button>
          ))}
        </div>
        <div className="axis-chips" role="group" aria-label="Axe">
          {catalog.axes.map((a) => {
            const n = axisCount(a.id);
            return (
              <button
                key={a.id}
                className={`axis-chip${axis === a.id ? " on" : ""}`}
                aria-pressed={axis === a.id}
                title={`${a.name} (${n})`}
                disabled={n === 0 && axis !== a.id}
                onClick={() => setAxis(axis === a.id ? "" : a.id)}
              >
                <span aria-hidden>{a.icon}</span>
                {axis === a.id && <span className="axis-chip-name">{a.name}</span>}
                {axis === a.id && <span aria-hidden> ✕</span>}
              </button>
            );
          })}
        </div>
      </div>

      {levels.map((n) =>
        all ? (
          <section key={n} className="panel">
            <h2 className="level-section-title">
              <button className="link" onClick={() => goTo(n)}>
                <span className="roman">{romanNumeral(n)}</span> {levelOf(catalog, n).name}
              </button>
            </h2>
            <ObjectiveGroups items={byLevel.get(n)!} axes={axes} tab={tab} onEdit={(id) => setEditing(state.custom.get(id) ?? null)} />
          </section>
        ) : (
          <section key={n} className="panel">
            <ObjectiveGroups items={byLevel.get(n)!} axes={axes} tab={tab} onEdit={(id) => setEditing(state.custom.get(id) ?? null)} />
          </section>
        ),
      )}
      {shown.length === 0 && (
        <p className="empty">
          {tab === "open" && inAxis.length > 0
            ? "Rien à faire ici : tout est validé. Bien joué."
            : "Aucun objectif ne correspond à ces filtres."}
        </p>
      )}
      {naCount > 0 && (
        <button className="link na-toggle" onClick={() => setShowNa(!showNa)}>
          {showNa ? "Masquer" : "Afficher"}{" "}
          {naCount > 1 ? `les ${naCount} objectifs non applicables` : "l'objectif non applicable"} à ton foyer
        </button>
      )}
    </div>
  );
}

function ObjectiveGroups({
  items,
  axes,
  tab,
  onEdit,
}: {
  items: Objective[];
  axes: Record<string, Axis>;
  tab: TabId;
  onEdit: (id: string) => void;
}) {
  const groups = GROUPS.map((g) => ({ ...g, items: items.filter(g.match) })).filter((g) => g.items.length > 0);
  return (
    <div className="objective-groups">
      {groups.map((g) => (
        // La clé inclut l'onglet : changer d'onglet remet chaque groupe dans son état par défaut.
        <details key={`${g.id}-${tab}`} className={`objective-group ${g.tone}`} open={g.id !== "na" && (g.id !== "done" || tab === "done")}>
          <summary>
            <span className="group-title">{g.title}</span>
            <span className="count">{g.items.length}</span>
          </summary>
          <ul className="objectives">
            {g.items.map((o) => (
              <ObjectiveRow key={o.id} o={o} axis={axes[o.axis]} onEdit={onEdit} />
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

function ObjectiveRow({ o, axis, onEdit }: { o: Objective; axis?: Axis; onEdit: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const done = isDone(o);
  // Atteint par un objet ou un talent : on ne décoche pas, on renvoie vers sa fiche.
  const proved = done && o.proofs.length > 0;
  const urgent = o.status === "expired" || o.status === "grace" || o.status === "expiring";
  const detailId = `obj-${o.id}`;

  // Une seule information sur la ligne : l'échéance si elle presse, sinon la nature de l'objectif.
  const meta: string[] = [];
  if (urgent) meta.push(o.expires_on ? `${STATUS_LABEL[o.status]} · ${o.status === "expired" ? "expiré le" : "échéance"} ${formatDate(o.expires_on)}` : STATUS_LABEL[o.status]);
  else if (o.kind === "stock" && !done) meta.push(`Stock · ${Math.round(o.progress * 100)} %`);
  else if (proved) meta.push(`Grâce à ${o.proofs[0].label}${o.proofs.length > 1 ? ` +${o.proofs.length - 1}` : ""}`);
  else meta.push(KIND_LABEL[o.kind]);
  if (o.custom) meta.push("Perso");

  return (
    <li className={`objective ${o.status}${open ? " open" : ""}`}>
      {o.kind === "stock" ? (
        <Link to="/inventaire" className={`tick ghost${done ? " on" : ""}`} title="Calculé depuis l'inventaire">
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
        <button className="objective-toggle" aria-expanded={open} aria-controls={detailId} onClick={() => setOpen(!open)}>
          <span className="item-title">
            {axis && (
              <span className="axis-icon" title={axis.name} aria-hidden>
                {axis.icon}
              </span>
            )}
            {o.title}
          </span>
          <span className={`objective-meta${urgent ? " urgent" : ""}`}>{meta.join(" · ")}</span>
          <span className="chevron" aria-hidden>
            ▾
          </span>
        </button>
        {open && (
          <div className="objective-detail" id={detailId}>
            {o.why && <p className="item-detail">{o.why}</p>}
            <dl className="facts">
              <dt>Statut</dt>
              <dd>{STATUS_LABEL[o.status]}</dd>
              <dt>Type</dt>
              <dd>
                {KIND_LABEL[o.kind]}
                {o.required ? ", requis" : ", bonus"}
                {o.custom ? ", perso" : ""}
              </dd>
              {axis && (
                <>
                  <dt>Axe</dt>
                  <dd>{axis.name}</dd>
                </>
              )}
              {o.revalidate_days ? (
                <>
                  <dt>Rythme</dt>
                  <dd>À refaire tous les {formatPeriod(o.revalidate_days)}</dd>
                </>
              ) : null}
              {o.due_month ? (
                <>
                  <dt>Calendrier</dt>
                  <dd>Chaque année avant le 1er {MONTHS[o.due_month - 1]}</dd>
                </>
              ) : null}
              {o.validated_at && (
                <>
                  <dt>Validé le</dt>
                  <dd>
                    {formatDate(o.validated_at)}
                    {o.source === "interview" ? " (interview)" : ""}
                  </dd>
                </>
              )}
              {o.expires_on && (
                <>
                  <dt>Échéance</dt>
                  <dd>{formatDate(o.expires_on)}</dd>
                </>
              )}
              {o.proofs.length > 0 && (
                <>
                  <dt>{done ? "Atteint grâce à" : "Prouvé par"}</dt>
                  <dd>
                    {o.proofs.map((p, i) => (
                      <span key={`${p.kind}:${p.id}`}>
                        {i > 0 && ", "}
                        <Link to={p.to}>{p.label}</Link>
                      </span>
                    ))}
                  </dd>
                </>
              )}
            </dl>
            {(o.status === "expiring" || o.status === "grace" || o.custom || o.kind === "stock") && (
              <div className="detail-actions">
                {(o.status === "expiring" || o.status === "grace") && (
                  <button onClick={() => void actions.validate(o.id)}>↻ Revalider maintenant</button>
                )}
                {o.kind === "stock" && <Link to="/inventaire">Voir les réserves</Link>}
                {o.custom && <button onClick={() => onEdit(o.id)}>Modifier</button>}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function CustomForm({
  initial,
  defaultLevel,
  onSaved,
  onClose,
}: {
  initial: CustomObjective | null;
  defaultLevel: number;
  /** Appelé avec le palier choisi, pour afficher l'objectif tout juste enregistré. */
  onSaved: (level: number) => void;
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
    onSaved(level);
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
