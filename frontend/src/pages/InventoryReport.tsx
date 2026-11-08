import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AutonomyCards } from "../components/AutonomyCards";
import { addDays } from "../engine/dates";
import type { Catalog } from "../engine/types";
import { formatDate, formatDays, formatNumber, gaugePosition, MONTHS } from "../lib/format";
import {
  autonomyProjection,
  buildCards,
  byLocation,
  type Card,
  DONE_STATUSES,
  expiriesByMonth,
  nextSteps,
  type Projection,
} from "../lib/inventory";
import type { StockData } from "../model";
import { useFoyer } from "../store/hooks";

const SHORT_MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** Catégorie d'autonomie → emplacement de couleur (fixe : la couleur suit la catégorie). */
function seriesSlot(catalog: Catalog, category: string): number {
  return catalog.categories.findIndex((c) => c.id === category) + 1;
}

export function InventoryReport() {
  const { catalog, dashboard, state, objectives, today } = useFoyer();
  const soon = addDays(today, 30);
  const horizon = addDays(today, 365);
  const cards = useMemo(
    () => (dashboard ? buildCards(catalog, state.items, state.stock, dashboard.autonomy, objectives, soon) : []),
    [catalog, state, dashboard, objectives, soon],
  );
  if (!dashboard) return null;

  const stock = [...state.stock.values()];
  const relevant = cards.filter((c) => c.relevant);
  const owned = relevant.filter((c) => c.owned);
  const tracked = dashboard.autonomy.filter((a) => a.days !== null);
  const weakest = [...tracked].sort((a, b) => (a.days ?? 0) - (b.days ?? 0))[0];
  const linked = new Map(relevant.flatMap((c) => c.objectives).map((o) => [o.id, o]));
  const linkedDone = [...linked.values()].filter((o) => DONE_STATUSES.includes(o.status)).length;
  const expired = stock.filter((s) => s.quantity > 0 && s.expires_on && s.expires_on < today);
  const expiring = stock.filter((s) => s.quantity > 0 && s.expires_on && s.expires_on >= today && s.expires_on <= soon);

  return (
    <div className="report viz">
      <section className="kpis" aria-label="Chiffres clés">
        <Kpi
          label="Maillon faible"
          value={weakest ? formatDays(weakest.days) : "—"}
          detail={weakest ? weakest.name : "Aucune réserve suivie"}
          status={weakest ? statusOfDays(weakest.days ?? 0) : null}
        />
        <Kpi label="Objets en place" value={`${owned.length} / ${relevant.length}`} detail="cartes qui concernent ton foyer" meter={relevant.length ? owned.length / relevant.length : 0} />
        <Kpi label="Objectifs servis validés" value={`${linkedDone} / ${linked.size}`} detail="objectifs liés à l'inventaire" meter={linked.size ? linkedDone / linked.size : 0} />
        <Kpi
          label="À surveiller"
          value={String(expired.length + expiring.length)}
          detail={`${expired.length} périmé${expired.length > 1 ? "s" : ""}, ${expiring.length} sous 30 jours`}
          status={expired.length ? "critical" : expiring.length ? "warning" : "good"}
        />
      </section>

      <section className="panel">
        <h2>Autonomie du foyer</h2>
        <p className="hint">Calculée sur les articles non périmés et les besoins journaliers de chaque membre. Repères : 3 j, 14 j, 3 mois, 6 mois.</p>
        <AutonomyCards autonomy={dashboard.autonomy} />
      </section>

      <section className="panel">
        <h2>Autonomie dans les 12 prochains mois</h2>
        <p className="hint">Sans rien consommer ni racheter : chaque marche est une péremption. C'est ce qu'il faut renouveler, et quand.</p>
        <ProjectionChart catalog={catalog} series={autonomyProjection(stock, dashboard.autonomy, today, horizon)} today={today} horizon={horizon} />
      </section>

      <div className="report-cols">
        <section className="panel">
          <h2>Prochains achats utiles</h2>
          <p className="hint">Ce qui remplit le plus vite un objectif encore ouvert, du niveau le plus bas au plus haut.</p>
          <NextSteps cards={cards} catalog={catalog} />
        </section>

        <section className="panel">
          <h2>Équipement par catégorie</h2>
          <p className="hint">Objets possédés sur ceux qui concernent ton foyer.</p>
          <Coverage catalog={catalog} cards={relevant} />
          <TierSpread catalog={catalog} cards={owned} />
        </section>
      </div>

      <div className="report-cols">
        <section className="panel">
          <h2>Péremptions, mois par mois</h2>
          <p className="hint">Nombre d'articles des réserves qui arrivent à leur date.</p>
          <ExpiryChart months={expiriesByMonth(stock, today)} />
          <ExpiryList articles={[...expired, ...expiring]} catalog={catalog} today={today} />
        </section>

        <section className="panel">
          <h2>Où sont rangées les choses</h2>
          <p className="hint">Objets et articles par emplacement déclaré. En crise, on doit tout retrouver dans le noir.</p>
          <Locations cards={cards} />
        </section>
      </div>
    </div>
  );
}

// ---------- Chiffres clés ----------

type Status = "good" | "warning" | "critical";
const STATUS: Record<Status, { icon: string; label: string }> = {
  good: { icon: "✓", label: "Correct" },
  warning: { icon: "!", label: "À renforcer" },
  critical: { icon: "✕", label: "Urgent" },
};

function statusOfDays(days: number): Status {
  return days < 3 ? "critical" : days < 14 ? "warning" : "good";
}

function Kpi({ label, value, detail, status = null, meter }: { label: string; value: string; detail: string; status?: Status | null; meter?: number }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      {meter !== undefined && (
        <span className="meter" aria-hidden>
          <span style={{ width: `${Math.round(meter * 100)}%` }} />
        </span>
      )}
      <span className="kpi-detail">
        {status && (
          <span className={`status status-${status}`}>
            <span aria-hidden>{STATUS[status].icon}</span> {STATUS[status].label}
          </span>
        )}
        {detail}
      </span>
    </div>
  );
}

// ---------- Projection d'autonomie (lignes en escalier, une couleur par catégorie) ----------

const H = 220;
const PAD = { l: 44, r: 96, t: 12, b: 28 };

/** Largeur réelle du conteneur : le graphique se redessine au lieu de s'étirer (texte à taille fixe). */
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

function ProjectionChart({ catalog, series, today, horizon }: { catalog: Catalog; series: Projection[]; today: string; horizon: string }) {
  const [hover, setHover] = useState<{ x: number; date: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [wrapRef, W] = useWidth<HTMLDivElement>();
  if (!series.length) return <p className="empty">Aucune réserve suivie pour ton foyer.</p>;

  const t0 = Date.parse(today);
  const span = Date.parse(horizon) - t0;
  const max = Math.max(14, ...series.flatMap((s) => s.points.map((p) => p.days))) * 1.15;
  const x = (d: string) => PAD.l + ((Date.parse(d) - t0) / span) * (W - PAD.l - PAD.r);
  const y = (days: number) => H - PAD.b - (gaugePosition(days, max) / 100) * (H - PAD.t - PAD.b);
  const valueAt = (s: Projection, d: string) => [...s.points].reverse().find((p) => p.date <= d)?.days ?? s.points[0].days;
  const ticks = [3, 7, 14, 30, 60, 90, 180, 365].filter((t) => t <= max);
  const monthTicks = Array.from({ length: W < 480 ? 4 : 12 }, (_, i) => addMonths(today, i * (W < 480 ? 3 : 1) + 1));

  // Étiquettes directes en bout de ligne, écartées pour ne pas se chevaucher.
  const ends = series
    .map((s) => ({ s, y: y(s.points[s.points.length - 1].days) }))
    .sort((a, b) => a.y - b.y)
    .reduce<{ s: Projection; y: number }[]>((acc, e) => [...acc, { ...e, y: acc.length ? Math.max(e.y, acc[acc.length - 1].y + 14) : e.y }], []);

  const onMove = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const ratio = Math.min(1, Math.max(0, (px - PAD.l) / (W - PAD.l - PAD.r)));
    const date = new Date(t0 + ratio * span).toISOString().slice(0, 10);
    setHover({ x: x(date), date });
  };

  return (
    <figure className="chart">
      <ul className="legend" aria-label="Légende">
        {series.map((s) => (
          <li key={s.category}>
            <i className={`swatch s${seriesSlot(catalog, s.category)}`} />
            {s.name}
          </li>
        ))}
      </ul>
      <div className="chart-wrap" ref={wrapRef}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Autonomie projetée par catégorie sur douze mois"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t} className="grid">
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
              <text x={PAD.l - 6} y={y(t)} dy="0.32em" textAnchor="end">
                {t < 30 ? `${t} j` : t < 365 ? `${Math.round(t / 30)} m` : "1 an"}
              </text>
            </g>
          ))}
          <line className="axis" x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} />
          {monthTicks.map((d) => (
            <text key={d} className="tick" x={x(d)} y={H - 8} textAnchor="middle">
              {SHORT_MONTHS[Number(d.slice(5, 7)) - 1]}
            </text>
          ))}
          {series.map((s) => (
            <path key={s.category} className={`line s${seriesSlot(catalog, s.category)}`} d={stepPath(s.points, x, y)} />
          ))}
          {ends.map(({ s, y: ly }) => (
            <g key={s.category}>
              <circle className={`dot s${seriesSlot(catalog, s.category)}`} cx={W - PAD.r} cy={y(s.points[s.points.length - 1].days)} r={4} />
              <text className="end-label" x={W - PAD.r + 10} y={ly} dy="0.32em">
                {s.name.split(" ")[0]}
              </text>
            </g>
          ))}
          {hover && <line className="crosshair" x1={hover.x} x2={hover.x} y1={PAD.t} y2={H - PAD.b} />}
          {hover &&
            series.map((s) => (
              <circle key={s.category} className={`dot s${seriesSlot(catalog, s.category)}`} cx={hover.x} cy={y(valueAt(s, hover.date))} r={4} />
            ))}
        </svg>
        {hover && (
          <div className="tooltip" style={{ left: `${(hover.x / W) * 100}%` }}>
            <strong>{formatDate(hover.date)}</strong>
            {series.map((s) => (
              <span key={s.category}>
                <i className={`swatch s${seriesSlot(catalog, s.category)}`} /> {s.name} : {formatDays(valueAt(s, hover.date))}
              </span>
            ))}
          </div>
        )}
      </div>
      <details className="table-view">
        <summary>Voir en tableau</summary>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              {series.map((s) => (
                <th key={s.category}>{s.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort().map((d) => (
              <tr key={d}>
                <td>{formatDate(d)}</td>
                {series.map((s) => (
                  <td key={s.category}>{formatDays(valueAt(s, d))}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function stepPath(points: { date: string; days: number }[], x: (d: string) => number, y: (v: number) => number): string {
  return points.map((p, i) => (i === 0 ? `M${x(p.date)},${y(p.days)}` : `H${x(p.date)}V${y(p.days)}`)).join("");
}

function addMonths(iso: string, n: number): string {
  const [yy, mm] = iso.split("-").map(Number);
  const m = mm - 1 + n;
  return `${yy + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}-01`;
}

// ---------- Prochains achats ----------

function NextSteps({ cards, catalog }: { cards: Card[]; catalog: Catalog }) {
  const steps = nextSteps(cards).slice(0, 6);
  if (!steps.length) return <p className="empty">Rien d'urgent : chaque objectif lié à l'inventaire est rempli.</p>;
  return (
    <ol className="next-steps">
      {steps.map(({ card, target, objective }) => (
        <li key={card.item.id}>
          <Link to={`/inventaire?objet=${card.item.id}`} className="next-step">
            <span className="inv-icon" aria-hidden>
              {card.item.icon}
            </span>
            <span>
              <strong>{card.item.name}</strong>
              <span className="item-detail">
                {card.owned ? "Passer au niveau " : "Acquérir au niveau "}
                <span className={`tier-pill tier-${target.tier}`}>{catalog.item_tiers.find((t) => t.id === target.tier)?.name}</span>
              </span>
              <span className="item-detail">
                Remplit : {objective.title} · niveau {objective.level}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

// ---------- Couverture par catégorie et niveaux ----------

function Coverage({ catalog, cards }: { catalog: Catalog; cards: Card[] }) {
  return (
    <ul className="bars">
      {catalog.item_groups.map((g) => {
        const all = cards.filter((c) => c.item.group === g.id);
        if (!all.length) return null;
        const n = all.filter((c) => c.owned).length;
        return (
          <li key={g.id} title={`${g.name} : ${n} sur ${all.length}`}>
            <span className="bar-label">
              <span aria-hidden>{g.icon}</span> {g.name}
            </span>
            <span className="meter">
              <span style={{ width: `${(n / all.length) * 100}%` }} />
            </span>
            <span className="bar-value">
              {n}/{all.length}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function TierSpread({ catalog, cards }: { catalog: Catalog; cards: Card[] }) {
  const counts = catalog.item_tiers.map((t) => ({ tier: t, n: cards.filter((c) => c.tier?.tier === t.id).length }));
  const max = Math.max(1, ...counts.map((c) => c.n));
  return (
    <>
      <h3 className="sub">Niveau des objets possédés</h3>
      <ul className="bars tiers">
        {counts.map(({ tier, n }) => (
          <li key={tier.id} title={`${tier.name} : ${n}`}>
            <span className="bar-label">
              <span className={`tier-pill tier-${tier.id}`}>{tier.name}</span>
            </span>
            <span className="meter plain">
              <span style={{ width: `${(n / max) * 100}%` }} />
            </span>
            <span className="bar-value">{n}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

// ---------- Péremptions ----------

function ExpiryChart({ months }: { months: { month: string; articles: StockData[] }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [wrapRef, W] = useWidth<HTMLDivElement>();
  const max = Math.max(1, ...months.map((m) => m.articles.length));
  const h = 120;
  const slot = W / months.length;
  const bw = Math.min(24, slot * 0.6);
  return (
    <figure className="chart">
      <div className="chart-wrap" ref={wrapRef}>
        <svg viewBox={`0 0 ${W} ${h + 24}`} role="img" aria-label="Articles qui périment par mois sur douze mois" onPointerLeave={() => setHover(null)}>
          <line className="axis" x1={0} x2={W} y1={h} y2={h} />
          {months.map((m, i) => {
            const n = m.articles.length;
            const bh = (n / max) * (h - 16);
            const cx = slot * i + slot / 2;
            return (
              <g key={m.month} onPointerEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={n ? 0 : -1}>
                <rect className="hit" x={slot * i} y={0} width={slot} height={h + 24} />
                {n > 0 && <path className={`col${hover === i ? " on" : ""}`} d={roundedTop(cx - bw / 2, h, bw, bh)} />}
                {n > 0 && (
                  <text className="col-label" x={cx} y={h - bh - 4} textAnchor="middle">
                    {n}
                  </text>
                )}
                <text className="tick" x={cx} y={h + 16} textAnchor="middle">
                  {SHORT_MONTHS[Number(m.month.slice(5)) - 1]}
                </text>
              </g>
            );
          })}
        </svg>
        {hover !== null && months[hover].articles.length > 0 && (
          <div className="tooltip" style={{ left: `${((slot * hover + slot / 2) / W) * 100}%` }}>
            <strong>
              {MONTHS[Number(months[hover].month.slice(5)) - 1]} {months[hover].month.slice(0, 4)}
            </strong>
            {months[hover].articles.map((s) => (
              <span key={s.id}>
                {s.name} · {formatDate(s.expires_on)}
              </span>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}

function roundedTop(x: number, base: number, w: number, h: number): string {
  const r = Math.min(4, h, w / 2);
  return `M${x},${base}V${base - h + r}Q${x},${base - h} ${x + r},${base - h}H${x + w - r}Q${x + w},${base - h} ${x + w},${base - h + r}V${base}Z`;
}

function ExpiryList({ articles, catalog, today }: { articles: StockData[]; catalog: Catalog; today: string }) {
  if (!articles.length) return <p className="hint">Rien de périmé, rien qui périme dans les 30 jours.</p>;
  const sorted = [...articles].sort((a, b) => (a.expires_on ?? "").localeCompare(b.expires_on ?? ""));
  return (
    <ul className="expiry-list">
      {sorted.map((s) => {
        const past = (s.expires_on ?? "") < today;
        return (
          <li key={s.id}>
            <span className={`status status-${past ? "critical" : "warning"}`}>
              <span aria-hidden>{past ? "✕" : "!"}</span> {past ? "Périmé" : "Bientôt"}
            </span>
            <span>
              {s.name} <span className="hint">· {formatNumber(s.quantity)} {s.unit_label} · {catalog.categories.find((c) => c.id === s.category)?.name}</span>
            </span>
            <span className="hint">{formatDate(s.expires_on)}</span>
          </li>
        );
      })}
    </ul>
  );
}

// ---------- Emplacements ----------

function Locations({ cards }: { cards: Card[] }) {
  const places = byLocation(cards);
  if (!places.length) return <p className="empty">Rien n'est encore déclaré dans l'inventaire.</p>;
  return (
    <ul className="locations">
      {places.map(({ location, names }) => (
        <li key={location || "—"} className={location ? "" : "unplaced"}>
          <strong>
            {location || "Emplacement non précisé"} <span className="count">{names.length}</span>
          </strong>
          <span className="chips">
            {names.map((n) => (
              <span key={n} className="chip">
                {n}
              </span>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}
