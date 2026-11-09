import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { TalentData } from "../engine/replay";
import type { Catalog, Talent } from "../engine/types";
import { formatDate, STATUS_LABEL } from "../lib/format";
import { DONE_STATUSES } from "../lib/inventory";
import { buildTrees, dependentChain, forContext, missingChain, type TalentNode, type TalentState, type Tree, unlocks } from "../lib/talents";
import type { Objective } from "../model";
import { actions, useFoyer } from "../store/hooks";

const SPEC_KEY = "shelterkwak.specialite";
const ROMAN = ["I", "II", "III", "IV", "V"];
const STATE_LABEL: Record<TalentState, string> = { acquired: "acquis", available: "disponible", locked: "verrouillé" };

function rememberedSpecialty(): string | null {
  try {
    return localStorage.getItem(SPEC_KEY);
  } catch {
    return null;
  }
}

/** Onglet Compétences : une spécialité choisie à la fois, son arbre de talents et la fiche d'un talent. */
export function SkillsPage() {
  const { catalog: fullCatalog, state, objectives, today, context } = useFoyer();
  const [params, setParams] = useSearchParams();
  const catalog = useMemo(() => forContext(fullCatalog, context), [fullCatalog, context]);
  const trees = useMemo(() => buildTrees(catalog, state.talents), [catalog, state.talents]);
  // Un talent acquis est « à entretenir » quand un objectif lié a expiré ou est en sursis (PSC1, sauvegarde…).
  const stale = useMemo(() => {
    const lapsed = new Set(objectives.filter((o) => o.status === "expired" || o.status === "grace").map((o) => o.id));
    return new Set(catalog.talents.filter((t) => state.talents.has(t.id) && t.objectives.some((o) => lapsed.has(o))).map((t) => t.id));
  }, [catalog, objectives, state.talents]);
  const wanted = params.get("spe") ?? rememberedSpecialty();
  const tree = trees.find((t) => t.specialty.id === wanted) ?? trees[0];
  const openId = params.get("talent");
  const open = tree?.nodes.find((n) => n.talent.id === openId) ?? null;

  if (!tree) return null;
  const total = trees.reduce((n, t) => n + t.total, 0);
  const acquired = trees.reduce((n, t) => n + t.acquired, 0);
  const available = trees.reduce((n, t) => n + t.available, 0);

  const select = (id: string) => {
    try {
      localStorage.setItem(SPEC_KEY, id);
    } catch {
      // stockage indisponible : le choix vaut pour cette visite
    }
    setParams({ spe: id }, { replace: true });
  };
  const openTalent = (id: string | null) => setParams(id ? { spe: tree.specialty.id, talent: id } : { spe: tree.specialty.id }, { replace: !id });

  return (
    <div className="page skills">
      <header className="skills-head">
        <h1>Compétences</h1>
        <p className="skills-sub">
          <strong>{acquired}</strong> talent{acquired > 1 ? "s" : ""} acquis sur {total}
          {available > 0 && (
            <>
              {" · "}
              <span className="skills-ready">{available} à ta portée</span>
            </>
          )}
        </p>
      </header>

      <div className="spec-picker" role="tablist" aria-label="Spécialités">
        {trees.map((t) => (
          <SpecTab key={t.specialty.id} tree={t} selected={t === tree} onSelect={() => select(t.specialty.id)} />
        ))}
      </div>

      <section className={`spec-panel spec-${tree.specialty.id}`} role="tabpanel" aria-label={tree.specialty.name}>
        <SpecBanner tree={tree} catalog={catalog} />
        <TalentTree tree={tree} catalog={catalog} stale={stale} onOpen={openTalent} />
        <ul className="tree-legend" aria-label="Légende">
          <li>
            <i className="dot acquired" /> Acquis
          </li>
          <li>
            <i className="dot available" /> Disponible : ses prérequis sont acquis
          </li>
          <li>
            <i className="dot locked" /> Verrouillé
          </li>
          {stale.size > 0 && (
            <li>
              <span aria-hidden>⟳</span> À entretenir : un objectif lié a expiré
            </li>
          )}
        </ul>
      </section>

      {open && (
        <TalentSheet
          key={open.talent.id}
          node={open}
          stale={stale.has(open.talent.id)}
          tree={tree}
          catalog={catalog}
          acquired={state.talents}
          objectives={objectives}
          today={today}
          onOpen={openTalent}
          onClose={() => openTalent(null)}
        />
      )}
    </div>
  );
}

function SpecTab({ tree, selected, onSelect }: { tree: Tree; selected: boolean; onSelect: () => void }) {
  const { specialty, acquired, total, title } = tree;
  const pct = Math.round((acquired / total) * 100);
  return (
    <button role="tab" aria-selected={selected} className={`spec-tab spec-${specialty.id}${selected ? " selected" : ""}`} onClick={onSelect}>
      <span className="spec-emblem" aria-hidden>
        {specialty.icon}
      </span>
      <span className="spec-tab-text">
        <span className="spec-tab-name">{specialty.name}</span>
        <span className="spec-tab-title">{title ?? "Pas encore commencé"}</span>
      </span>
      <span className="spec-meter" aria-label={`${acquired} talents sur ${total}`}>
        <span className="spec-meter-bar">
          <i style={{ width: `${pct}%` }} />
        </span>
        <span className="spec-meter-count">
          {acquired}/{total}
        </span>
      </span>
    </button>
  );
}

function SpecBanner({ tree, catalog }: { tree: Tree; catalog: Catalog }) {
  const { specialty, rank, title, available } = tree;
  const next = rank < 5 ? specialty.titles[rank] : null;
  return (
    <div className="spec-banner">
      <span className="spec-emblem large" aria-hidden>
        {specialty.icon}
      </span>
      <div className="spec-banner-text">
        <p className="eyebrow">{rank ? `Rang ${ROMAN[rank - 1]} · ${catalog.talent_ranks[rank - 1]}` : "Aucun talent pour l'instant"}</p>
        <h2>
          {specialty.name}
          {title && <span className="spec-title">{title}</span>}
        </h2>
        <p>{specialty.description}</p>
        <p className="spec-next">
          {next ? (
            <>
              Prochain titre : <strong>{next}</strong> au rang {ROMAN[rank]}
            </>
          ) : (
            <>Rang de maître atteint 🏆</>
          )}
          {available > 0 && (
            <>
              {" · "}
              {available} talent{available > 1 ? "s" : ""} à ta portée
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/** Mesure la largeur disponible pour placer les nœuds et tracer les liaisons au pixel près. */
function useWidth<T extends HTMLElement>(fallback = 640): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

const ROW_H = 150; // hauteur d'un rang
const NODE_Y = 58; // centre du nœud dans le rang
const R = 30; // rayon d'un nœud (le maître est plus grand)
const R_MASTER = 36;
const LABEL_H = 46; // place du nom sous un nœud (deux lignes)

function TalentTree({ tree, catalog, stale, onOpen }: { tree: Tree; catalog: Catalog; stale: Set<string>; onOpen: (id: string) => void }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const cols = tree.specialty.branches.length;
  const pos = (t: Talent) => ({ x: (W * (t.col - 0.5)) / cols, y: (t.row - 1) * ROW_H + NODE_Y, r: t.row === 5 ? R_MASTER : R });
  const byId = new Map(tree.nodes.map((n) => [n.talent.id, n]));
  const H = 5 * ROW_H;
  const nodes = [...tree.nodes].sort((a, b) => a.talent.row - b.talent.row || a.talent.col - b.talent.col);

  return (
    <div className="talent-tree" ref={ref} style={{ height: H + 34 }}>
      <div className="tree-branches" aria-hidden style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {tree.specialty.branches.map((b) => (
          <span key={b}>{b}</span>
        ))}
      </div>
      <div className="tree-body" style={{ height: H }}>
        {catalog.talent_ranks.map((name, i) => (
          <div key={name} className={`tree-rank${i < tree.rank ? " reached" : ""}`} style={{ top: i * ROW_H, height: ROW_H }} aria-hidden>
            <span>
              {ROMAN[i]} · {name}
            </span>
          </div>
        ))}
        <svg className="tree-links" width={W} height={H} aria-hidden>
          {tree.nodes.flatMap((n) =>
            n.talent.requires.map((r) => {
              const parent = byId.get(r);
              if (!parent) return null;
              const a = pos(parent.talent);
              const b = pos(n.talent);
              const y1 = a.y + a.r + LABEL_H; // sous le nom du talent
              const y2 = b.y - b.r - 4;
              const mid = (y1 + y2) / 2;
              const cls = parent.state !== "acquired" ? "locked" : n.state === "acquired" ? "acquired" : "open";
              // Un lien qui saute un rang dans la même branche contourne le talent intermédiaire.
              const skip = a.x === b.x && n.talent.row - parent.talent.row > 1;
              const dx = ((n.talent.col === cols ? -1 : 1) * 0.42 * W) / cols;
              const d = skip
                ? `M${a.x},${y1} C${a.x + dx},${y1 + 50} ${b.x + dx},${y2 - 50} ${b.x},${y2}`
                : `M${a.x},${y1} C${a.x},${mid} ${b.x},${mid} ${b.x},${y2}`;
              return <path key={`${r}>${n.talent.id}`} className={cls} d={d} />;
            }),
          )}
        </svg>
        {nodes.map((n) => {
          const p = pos(n.talent);
          return <TalentNodeButton key={n.talent.id} node={n} stale={stale.has(n.talent.id)} x={p.x} y={p.y} width={W / cols} onOpen={() => onOpen(n.talent.id)} />;
        })}
      </div>
    </div>
  );
}

function TalentNodeButton({
  node,
  stale,
  x,
  y,
  width,
  onOpen,
}: {
  node: TalentNode;
  stale: boolean;
  x: number;
  y: number;
  width: number;
  onOpen: () => void;
}) {
  const { talent, state } = node;
  const master = talent.row === 5;
  return (
    <button
      className={`talent-node ${state}${master ? " master" : ""}`}
      style={{ left: x, top: y, width: Math.min(150, width - 8) }}
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`${talent.name}, ${STATE_LABEL[state]}${stale ? ", à entretenir" : ""}`}
    >
      <span className="talent-orb">
        <span className="talent-icon" aria-hidden>
          {talent.icon}
        </span>
        {state === "acquired" && (
          <span className={`talent-badge ${stale ? "stale" : "ok"}`} aria-hidden>
            {stale ? "⟳" : "✓"}
          </span>
        )}
        {state === "locked" && (
          <span className="talent-badge lock" aria-hidden>
            🔒
          </span>
        )}
      </span>
      <span className="talent-name">{talent.name}</span>
    </button>
  );
}

// ---------- Fiche d'un talent ----------

function TalentSheet({
  node,
  stale,
  tree,
  catalog,
  acquired,
  objectives,
  today,
  onOpen,
  onClose,
}: {
  node: TalentNode;
  stale: boolean;
  tree: Tree;
  catalog: Catalog;
  acquired: ReadonlyMap<string, TalentData>;
  objectives: Objective[];
  today: string;
  onOpen: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const { talent, state, data } = node;
  const { specialty } = tree;
  const states = new Map(tree.nodes.map((n) => [n.talent.id, n.state]));
  const linked = talent.objectives.map((id) => objectives.find((o) => o.id === id)).filter((o): o is Objective => !!o);
  const next = unlocks(catalog, talent.id);

  return (
    <dialog
      ref={ref}
      className={`inv-sheet talent-sheet spec-${specialty.id}`}
      aria-labelledby="talent-titre"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
    >
      <div className="sheet-body">
        <header className="sheet-head">
          <span className={`talent-orb ${state}${talent.row === 5 ? " master" : ""}`} aria-hidden>
            <span className="talent-icon">{talent.icon}</span>
          </span>
          <div>
            <p className="eyebrow">
              {specialty.name} · Rang {ROMAN[talent.row - 1]} {catalog.talent_ranks[talent.row - 1]} · {specialty.branches[talent.col - 1]}
            </p>
            <h2 id="talent-titre">{talent.name}</h2>
            <span className={`talent-status ${state}`}>
              {state === "acquired" ? (data?.acquired_on ? `Acquis le ${formatDate(data.acquired_on)}` : "Acquis") : state === "available" ? "Disponible" : "Verrouillé"}
            </span>
          </div>
          <button className="icon sheet-close" onClick={() => ref.current?.close()} aria-label="Fermer">
            ✕
          </button>
        </header>

        {talent.description && <p>{talent.description}</p>}
        {stale && (
          <p className="caution" role="note">
            <strong>⟳ À entretenir.</strong> Un objectif lié a expiré : refais la formation ou la vérification, puis revalide l'objectif ci-dessous.
          </p>
        )}
        <div className="talent-criteria">
          <h3>Pour le cocher</h3>
          <p>{talent.criteria}</p>
        </div>

        {(talent.requires.length > 0 || next.length > 0) && (
          <div className="talent-links">
            {talent.requires.length > 0 && <TalentChips label="Prérequis" ids={talent.requires} catalog={catalog} states={states} onOpen={onOpen} />}
            {next.length > 0 && <TalentChips label="Débloque" ids={next.map((t) => t.id)} catalog={catalog} states={states} onOpen={onOpen} />}
          </div>
        )}

        <TalentObjectives objectives={linked} acquired={state === "acquired"} />

        {state === "acquired" ? (
          <AcquiredForm key={data?.acquired_on ?? ""} talent={talent} data={data!} catalog={catalog} acquired={acquired} onDone={() => ref.current?.close()} />
        ) : (
          <LearnForm talent={talent} catalog={catalog} acquired={acquired} today={today} onDone={() => ref.current?.close()} />
        )}
      </div>
    </dialog>
  );
}

function TalentChips({
  label,
  ids,
  catalog,
  states,
  onOpen,
}: {
  label: string;
  ids: string[];
  catalog: Catalog;
  states: Map<string, TalentState>;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="talent-chips">
      <h3>{label}</h3>
      <ul>
        {ids.map((id) => {
          const t = catalog.talents.find((x) => x.id === id);
          const s = states.get(id) ?? "locked";
          if (!t) return null;
          return (
            <li key={id}>
              <button className={`talent-chip ${s}`} onClick={() => onOpen(id)} aria-label={`${t.name}, ${STATE_LABEL[s]}`}>
                <span aria-hidden>{s === "acquired" ? "✓" : s === "locked" ? "🔒" : t.icon}</span> {t.name}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TalentObjectives({ objectives, acquired }: { objectives: Objective[]; acquired: boolean }) {
  if (!objectives.length) return null;
  return (
    <section className="linked">
      <h3>Objectifs liés</h3>
      <ul>
        {objectives.map((o) => {
          const done = DONE_STATUSES.includes(o.status);
          return (
            <li key={o.id} className={acquired && !done ? "covered" : ""}>
              <span className={`badge status-${o.status}`}>{STATUS_LABEL[o.status]}</span>
              <span className="linked-title">
                {o.title} <span className="hint">· niveau {o.level}</span>
              </span>
              {acquired && !done && o.status !== "na" && (
                <button className="link" onClick={() => void actions.validate(o.id)}>
                  Valider
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="hint">
        {acquired
          ? "Cocher un talent ne valide rien tout seul : valide l'objectif s'il est rempli pour ton foyer."
          : "Ce talent aide à remplir ces objectifs du foyer."}
      </p>
    </section>
  );
}

function LearnForm({
  talent,
  catalog,
  acquired,
  today,
  onDone,
}: {
  talent: Talent;
  catalog: Catalog;
  acquired: ReadonlyMap<string, TalentData>;
  today: string;
  onDone: () => void;
}) {
  const [on, setOn] = useState(today);
  const chain = missingChain(catalog, talent.id, acquired);
  const before = chain.slice(0, -1);
  const learn = () => {
    void actions.learnTalents(
      chain.map((t) => t.id),
      on || null,
    );
    onDone();
  };
  return (
    <div className="talent-learn">
      {before.length > 0 && (
        <div className="talent-missing">
          <p>
            <strong>
              Il manque {before.length} talent{before.length > 1 ? "s" : ""} avant celui-ci
            </strong>{" "}
            : {before.map((t) => t.name).join(", ")}.
          </p>
          <p className="hint">Si tu les maîtrises déjà, coche-les en même temps.</p>
        </div>
      )}
      <div className="row">
        <label className="field">
          Acquis le
          <input type="date" value={on} max={today} onChange={(e) => setOn(e.target.value)} />
        </label>
      </div>
      <div className="actions sheet-actions">
        <button className="primary" onClick={learn}>
          {before.length ? `Cocher les ${chain.length} talents` : "J'ai acquis ce talent"}
        </button>
      </div>
    </div>
  );
}

function AcquiredForm({
  talent,
  data,
  catalog,
  acquired,
  onDone,
}: {
  talent: Talent;
  data: TalentData;
  catalog: Catalog;
  acquired: ReadonlyMap<string, TalentData>;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<TalentData>({ ...data, acquired_on: data.acquired_on ?? null, note: data.note ?? "" });
  const [confirm, setConfirm] = useState(false);
  const changed = draft.acquired_on !== (data.acquired_on ?? null) || draft.note !== (data.note ?? "");
  const chain = dependentChain(catalog, talent.id, acquired);
  const dependents = chain.filter((t) => t.id !== talent.id);
  const forget = () => {
    void actions.forgetTalents(chain.map((t) => t.id));
    onDone();
  };
  return (
    <div className="talent-learn">
      <div className="row">
        <label className="field">
          Acquis le
          <input type="date" value={draft.acquired_on ?? ""} onChange={(e) => setDraft({ ...draft, acquired_on: e.target.value || null })} />
        </label>
        <label className="field grow">
          Note
          <input value={draft.note} placeholder="formation, organisme, à revoir…" onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
        </label>
      </div>
      {confirm && (
        <div className="talent-missing danger-box" role="alert">
          <p>
            <strong>
              {dependents.length} talent{dependents.length > 1 ? "s" : ""} en dépend{dependents.length > 1 ? "ent" : ""}
            </strong>{" "}
            : {dependents.map((t) => t.name).join(", ")}. {dependents.length > 1 ? "Ils seront retirés" : "Il sera retiré"} aussi.
          </p>
          <div className="actions">
            <button className="link" onClick={() => setConfirm(false)}>
              Annuler
            </button>
            <button className="danger" onClick={forget}>
              Retirer {chain.length} talents
            </button>
          </div>
        </div>
      )}
      <div className="actions sheet-actions">
        {!confirm && (
          <button className="link danger" onClick={() => (dependents.length ? setConfirm(true) : forget())}>
            Retirer ce talent
          </button>
        )}
        <button
          className="primary"
          disabled={!changed}
          onClick={() => {
            void actions.setTalent(draft);
            onDone();
          }}
        >
          Enregistrer
        </button>
      </div>
    </div>
  );
}
