import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Route, Routes, useSearchParams } from "react-router-dom";
import { AutonomyCards } from "../components/AutonomyCards";
import { addDays } from "../engine/dates";
import type { ItemData } from "../engine/replay";
import type { Catalog, ItemBasis, ItemKind, ItemTier } from "../engine/types";
import { type Card, buildCards, DONE_STATUSES, tierObjectiveIds } from "../lib/inventory";
import { formatDate, formatDays, formatNumber, STATUS_LABEL, unitLabel } from "../lib/format";
import type { Objective, StockData } from "../model";
import { actions, useFoyer } from "../store/hooks";
import { InventoryReport } from "./InventoryReport";

const BASIS_LABEL: Record<ItemBasis, string> = {
  qualite: "Le niveau monte avec la qualité de l'objet",
  options: "Le niveau monte avec l'objet et ses options",
  quantite: "Le niveau monte avec la quantité",
  contenu: "Le niveau dépend de ce que contient le kit : chaque niveau ajoute son contenu minimal à celui du précédent",
  autonomie: "Le niveau monte avec l'autonomie du foyer",
};
const KIND_LABEL: Record<ItemKind, string> = { equipement: "Équipement", consommable: "Consommable", reserve: "Réserve" };
type Filter = "all" | "owned" | "missing";
const FILTERS: [Filter, string][] = [
  ["all", "Tout"],
  ["owned", "Possédés"],
  ["missing", "Manquants"],
];

export function InventoryPage() {
  return (
    <div className="page inventory">
      <div className="inv-head">
        <h1>Inventaire</h1>
        <nav className="subtabs" aria-label="Vues de l'inventaire">
          <NavLink to="/inventaire" end>
            Objets
          </NavLink>
          <NavLink to="/inventaire/etat-des-lieux">État des lieux</NavLink>
        </nav>
      </div>
      <Routes>
        <Route index element={<InventoryCards />} />
        <Route path="etat-des-lieux" element={<InventoryReport />} />
      </Routes>
    </div>
  );
}

function InventoryCards() {
  const { catalog, dashboard, state, objectives, today } = useFoyer();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [params, setParams] = useSearchParams();
  const openId = params.get("objet");
  const setOpenId = (id: string | null) => setParams(id ? { objet: id } : {}, { replace: !id });

  const soon = addDays(today, 30);
  const cards = useMemo(
    () => (dashboard ? buildCards(catalog, state.items, state.stock, dashboard.autonomy, objectives, soon) : []),
    [catalog, state, dashboard, objectives, soon],
  );
  if (!dashboard) return null;

  const relevant = cards.filter((c) => c.relevant);
  const hidden = cards.length - relevant.length;
  const q = normalize(query.trim());
  const visible = (showAll ? cards : relevant).filter(
    (c) =>
      (filter === "all" || (filter === "owned") === c.owned) &&
      (!q || normalize(`${c.item.name} ${c.item.description}`).includes(q)),
  );
  const owned = relevant.filter((c) => c.owned).length;
  const open = cards.find((c) => c.item.id === openId) ?? null;

  return (
    <>
      <div className="inv-summary">
        <p className="hint">
          {owned} objet{owned > 1 ? "s" : ""} sur {relevant.length} pour ton foyer. Touche une carte pour la compléter.
        </p>
        <div className="inv-progress" role="progressbar" aria-label="Objets possédés" aria-valuemin={0} aria-valuemax={relevant.length} aria-valuenow={owned}>
          <span style={{ width: `${relevant.length ? (owned / relevant.length) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="inv-toolbar">
        <input type="search" placeholder="Chercher un objet…" aria-label="Chercher un objet" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="segmented" role="radiogroup" aria-label="Filtrer">
          {FILTERS.map(([id, label]) => (
            <button key={id} role="radio" aria-checked={filter === id} className={filter === id ? "on" : ""} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <nav className="inv-jump" aria-label="Catégories">
        {catalog.item_groups.map((g) => {
          const n = visible.filter((c) => c.item.group === g.id).length;
          return n ? (
            <a key={g.id} href={`#groupe-${g.id}`}>
              <span aria-hidden>{g.icon}</span> {g.name}
            </a>
          ) : null;
        })}
      </nav>

      {catalog.item_groups.map((g) => {
        const groupCards = visible.filter((c) => c.item.group === g.id);
        if (!groupCards.length) return null;
        const all = (showAll ? cards : relevant).filter((c) => c.item.group === g.id);
        return (
          <section key={g.id} id={`groupe-${g.id}`} className="inv-group" aria-labelledby={`titre-${g.id}`}>
            <h2 id={`titre-${g.id}`}>
              <span aria-hidden>{g.icon}</span> {g.name}
              <span className="count">
                {all.filter((c) => c.owned).length}/{all.length}
              </span>
            </h2>
            <ul className="inv-grid">
              {groupCards.map((c) => (
                <li key={c.item.id}>
                  <ItemCard card={c} catalog={catalog} onOpen={() => setOpenId(c.item.id)} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {visible.length === 0 && <p className="empty">Aucun objet ne correspond.</p>}

      {hidden > 0 && (
        <button className="link inv-more" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Masquer les objets qui ne concernent pas ton foyer" : `Voir aussi ${hidden} objet${hidden > 1 ? "s" : ""} qui ne concernent pas ton foyer`}
        </button>
      )}

      {open && <ItemSheet card={open} catalog={catalog} today={today} soon={soon} onClose={() => setOpenId(null)} />}
    </>
  );
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function tierName(catalog: Catalog, id: string): string {
  return catalog.item_tiers.find((t) => t.id === id)?.name ?? id;
}

function ItemCard({ card, catalog, onOpen }: { card: Card; catalog: Catalog; onOpen: () => void }) {
  const { item, owned, tier, data, autonomy } = card;
  const tierClass = owned ? (tier ? ` tier-${tier.tier}` : " tier-none") : "";
  let status: string;
  if (item.kind === "reserve") status = owned ? formatDays(autonomy?.days ?? 0) : "Vide";
  else if (!owned) status = "Manquant";
  else status = data && data.quantity > 1 ? `× ${formatNumber(data.quantity)}` : "Possédé";
  const label = `${item.name}, ${owned ? (tier ? `niveau ${tierName(catalog, tier.tier)}` : "possédé") : "manquant"}`;
  return (
    <button className={`inv-card${owned ? " owned" : " missing"}${tierClass}`} onClick={onOpen} aria-label={label} aria-haspopup="dialog">
      <span className="inv-icon" aria-hidden>
        {item.icon}
      </span>
      <span className="inv-name">{item.name}</span>
      <span className="inv-status">
        {owned && tier && <span className={`tier-pill tier-${tier.tier}`}>{tierName(catalog, tier.tier)}</span>}
        {owned && !tier && item.kind !== "reserve" && <span className="tier-pill tier-none">Niveau ?</span>}
        <span className="inv-qty">{status}</span>
      </span>
      {item.tiers.length > 1 && (
        <span className="tier-pips" aria-hidden>
          {item.tiers.map((t, i) => (
            <i key={t.tier} className={owned && tier && i <= item.tiers.indexOf(tier) ? `on tier-${t.tier}` : ""} />
          ))}
        </span>
      )}
      <span className="inv-meta" aria-hidden>
        {card.objectives.length > 0 && (
          <span className={card.done === card.objectives.length ? "ok-text" : ""}>
            🎯 {card.done}/{card.objectives.length}
          </span>
        )}
        {card.warn && <span className="warn-text">⏳ péremption</span>}
      </span>
    </button>
  );
}

function ItemSheet({ card, catalog, today, soon, onClose }: { card: Card; catalog: Catalog; today: string; soon: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const { item } = card;
  return (
    <dialog
      ref={ref}
      className="inv-sheet"
      aria-labelledby="fiche-titre"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
    >
      <div className="sheet-body">
        <header className={`sheet-head${card.owned ? ` owned tier-${card.tier?.tier ?? "none"}` : " missing"}`}>
          <span className="inv-icon" aria-hidden>
            {item.icon}
          </span>
          <div>
            <p className="eyebrow">
              {KIND_LABEL[item.kind]} · {catalog.item_groups.find((g) => g.id === item.group)?.name}
            </p>
            <h2 id="fiche-titre">{item.name}</h2>
          </div>
          <button className="icon sheet-close" onClick={() => ref.current?.close()} aria-label="Fermer">
            ✕
          </button>
        </header>
        {item.description && <p>{item.description}</p>}
        {item.kind === "reserve" ? (
          <ReserveDetail card={card} catalog={catalog} today={today} soon={soon} />
        ) : (
          <ItemDetail key={item.id} card={card} catalog={catalog} onDone={() => ref.current?.close()} />
        )}
      </div>
    </dialog>
  );
}

/** Équipement ou consommable : niveau, quantité, rangement, objectifs servis. */
function ItemDetail({ card, catalog, onDone }: { card: Card; catalog: Catalog; onDone: () => void }) {
  const { item, data } = card;
  const [draft, setDraft] = useState<ItemData>(
    data ?? { item_id: item.id, tier: item.tiers[0]?.tier ?? null, quantity: 1, location: null, note: "" },
  );
  const covered = tierObjectiveIds(item, draft.tier);
  const changed = JSON.stringify(data) !== JSON.stringify(draft);

  const save = () => {
    void actions.setItem(draft);
    onDone();
  };

  return (
    <>
      {item.tiers.length > 0 && (
        <fieldset className="tier-ladder">
          <legend>
            {data ? "Ton niveau" : "Choisis le niveau de ce que tu as"}
            <span className="hint">{BASIS_LABEL[item.basis]}.</span>
          </legend>
          {item.tiers.map((t, i) => (
            <TierRow
              key={t.tier}
              t={t}
              previous={i > 0 ? item.tiers[i - 1] : null}
              catalog={catalog}
              selected={draft.tier === t.tier}
              onSelect={() => setDraft({ ...draft, tier: t.tier })}
            />
          ))}
        </fieldset>
      )}

      <div className="row">
        <label className="field">
          Quantité
          <span className="stepper">
            <button type="button" aria-label="Retirer une unité" disabled={draft.quantity <= 1} onClick={() => setDraft({ ...draft, quantity: Math.max(1, draft.quantity - 1) })}>
              −
            </button>
            <input type="number" min={1} step="any" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: Math.max(1, Number(e.target.value) || 1) })} />
            <button type="button" aria-label="Ajouter une unité" onClick={() => setDraft({ ...draft, quantity: draft.quantity + 1 })}>
              +
            </button>
          </span>
        </label>
        <label className="field grow">
          Rangé où ?
          <input value={draft.location ?? ""} placeholder="cellier, sac d'évacuation, entrée…" onChange={(e) => setDraft({ ...draft, location: e.target.value || null })} />
        </label>
      </div>
      <label className="field">
        Note
        <input value={draft.note} placeholder="marque, date de vérification, ce qui manque…" onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
      </label>

      <LinkedObjectives objectives={card.objectives} covered={covered} />

      <div className="actions sheet-actions">
        {data && (
          <button
            className="link danger"
            onClick={() => {
              void actions.deleteItem(item.id);
              onDone();
            }}
          >
            Je ne l'ai plus
          </button>
        )}
        <button className="primary" disabled={!!data && !changed} onClick={save}>
          {data ? "Enregistrer" : "Je l'ai"}
        </button>
      </div>
    </>
  );
}

function TierRow({
  t,
  previous = null,
  catalog,
  selected,
  reached,
  onSelect,
}: {
  t: ItemTier;
  previous?: ItemTier | null;
  catalog: Catalog;
  selected?: boolean;
  reached?: boolean;
  onSelect?: () => void;
}) {
  const body = (
    <>
      <span className={`tier-pill tier-${t.tier}`}>{tierName(catalog, t.tier)}</span>
      <span className="tier-contents">
        {t.contents}
        {t.includes.length > 0 && (
          <>
            <span className="includes-lead">{previous ? `Tout le niveau ${tierName(catalog, previous.tier)}, plus :` : "Contenu minimal :"}</span>
            <ul className="includes">
              {t.includes.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </>
        )}
      </span>
      {(reached || selected) && (
        <span className="tier-check" aria-label={reached ? "atteint" : "choisi"}>
          ✓
        </span>
      )}
    </>
  );
  if (!onSelect) return <div className={`tier-row${reached ? " reached" : ""} tier-${t.tier}`}>{body}</div>;
  return (
    <label className={`tier-row selectable${selected ? " selected" : ""} tier-${t.tier}`}>
      <input type="radio" name="tier" checked={selected} onChange={onSelect} />
      {body}
    </label>
  );
}

function LinkedObjectives({ objectives, covered }: { objectives: Objective[]; covered: Set<string> }) {
  if (!objectives.length) return null;
  return (
    <section className="linked">
      <h3>Objectifs servis</h3>
      <ul>
        {objectives.map((o) => {
          const done = DONE_STATUSES.includes(o.status);
          return (
            <li key={o.id} className={covered.has(o.id) && !done ? "covered" : ""}>
              <span className={`badge status-${o.status}`}>{STATUS_LABEL[o.status]}</span>
              <span className="linked-title">
                {o.title} <span className="hint">· niveau {o.level}</span>
              </span>
              {!done && o.kind === "check" && covered.has(o.id) && (
                <button className="link" onClick={() => void actions.validate(o.id)}>
                  Valider
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {[...covered].some((id) => objectives.some((o) => o.id === id && !DONE_STATUSES.includes(o.status) && o.kind === "check")) && (
        <p className="hint">Les objectifs surlignés correspondent à ce niveau : valide-les quand c'est vérifié.</p>
      )}
    </section>
  );
}

// ---------- Réserves (articles comptés en jours d'autonomie) ----------

type StockIn = Omit<StockData, "id">;

const HINTS: Record<string, string> = {
  eau: "Ex. : 6 bouteilles de 1,5 L → quantité 6, contenu par unité 1,5 L.",
  alimentation:
    "Calories par unité (sur l'étiquette) : boîte de lentilles 400 g ≈ 400 kcal, paquet de pâtes 500 g ≈ 1 800 kcal, riz 1 kg ≈ 3 600 kcal.",
  traitements: "Nombre de jours de traitement par boîte.",
  cuisson: "Nombre de jours-personne par unité (une cartouche de gaz de 250 g ≈ 3 jours-personne).",
};

function ReserveDetail({ card, catalog, today, soon }: { card: Card; catalog: Catalog; today: string; soon: string }) {
  const { item, autonomy, articles } = card;
  const category = catalog.categories.find((c) => c.id === item.category)!;
  const empty: StockIn = { name: "", category: category.id, quantity: 1, unit_label: "", amount_per_unit: 1, expires_on: null, location: null };
  const [form, setForm] = useState<StockIn>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const rank = card.tier ? item.tiers.indexOf(card.tier) : -1;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void actions.upsertStock({ ...form, id: editing ?? undefined });
    setForm(empty);
    setEditing(null);
  };
  const edit = (s: StockData) => {
    setEditing(s.id);
    setForm({ name: s.name, category: s.category, quantity: s.quantity, unit_label: s.unit_label, amount_per_unit: s.amount_per_unit, expires_on: s.expires_on, location: s.location ?? null });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <>
      {autonomy && <AutonomyCards autonomy={[autonomy]} />}
      <div className="tier-ladder">
        <p className="legend">{BASIS_LABEL.autonomie}.</p>
        {item.tiers.map((t, i) => (
          <TierRow key={t.tier} t={t} catalog={catalog} reached={i <= rank} />
        ))}
      </div>
      <LinkedObjectives objectives={card.objectives} covered={new Set()} />

      <section>
        <h3>Articles ({articles.length})</h3>
        {articles.length === 0 ? (
          <p className="empty">Aucun article pour l'instant.</p>
        ) : (
          <ul className="articles">
            {articles.map((s) => {
              const st = s.expires_on && s.expires_on < today ? "expired" : s.expires_on && s.expires_on <= soon ? "expiring" : "";
              const total = s.quantity * s.amount_per_unit;
              return (
                <li key={s.id} className={st}>
                  <div>
                    <strong>{s.name}</strong>
                    <div className="item-detail">
                      {formatNumber(s.quantity)} {s.unit_label} · {formatNumber(total)} {unitLabel(category.unit, total)}
                      {s.location && ` · ${s.location}`}
                    </div>
                    <div className={`item-detail${st ? " warn-text" : ""}`}>
                      {s.expires_on ? `Péremption ${formatDate(s.expires_on)}` : "Sans date de péremption"}
                      {st === "expired" && " · périmé, ne compte plus"}
                      {st === "expiring" && " · bientôt"}
                    </div>
                  </div>
                  <div className="row-actions">
                    <button className="icon" title="Consommer une unité" aria-label={`Consommer une unité de ${s.name}`} disabled={s.quantity <= 0} onClick={() => void actions.upsertStock({ ...s, quantity: Math.max(0, s.quantity - 1) })}>
                      −1
                    </button>
                    <button className="link" onClick={() => edit(s)}>
                      Modifier
                    </button>
                    <button className="link danger" onClick={() => void actions.deleteStock(s.id)}>
                      Retirer
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <form ref={formRef} className="stock-form" onSubmit={submit}>
        <h3>{editing ? "Modifier l'article" : "Ajouter un article"}</h3>
        <label className="field grow">
          Article
          <input required value={form.name} placeholder="Packs d'eau, conserves de lentilles…" onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <div className="row">
          <label className="field">
            Quantité
            <input type="number" min={0} step="any" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
          </label>
          <label className="field">
            Unité
            <input value={form.unit_label} placeholder="bouteille, boîte…" onChange={(e) => setForm({ ...form, unit_label: e.target.value })} />
          </label>
          <label className="field">
            Contenu par unité ({category.unit})
            <input type="number" min={0} step="any" required value={form.amount_per_unit} onChange={(e) => setForm({ ...form, amount_per_unit: Number(e.target.value) })} />
          </label>
        </div>
        <div className="row">
          <label className="field">
            Péremption
            <input type="date" value={form.expires_on ?? ""} onChange={(e) => setForm({ ...form, expires_on: e.target.value || null })} />
          </label>
          <label className="field grow">
            Emplacement
            <input value={form.location ?? ""} placeholder="cellier, sous l'évier, cave…" onChange={(e) => setForm({ ...form, location: e.target.value || null })} />
          </label>
        </div>
        <p className="hint">{HINTS[category.id]}</p>
        <div className="actions">
          {editing && (
            <button type="button" onClick={() => { setEditing(null); setForm(empty); }}>
              Annuler
            </button>
          )}
          <button className="primary">{editing ? "Enregistrer" : "Ajouter"}</button>
        </div>
      </form>
    </>
  );
}
