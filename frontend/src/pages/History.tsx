import { useMemo } from "react";
import { CATALOG } from "../engine/catalog";
import { history as buildHistory, type Snapshot } from "../engine/replay";
import { MAX_LEVEL } from "../engine/types";
import { formatDate } from "../lib/format";
import { useFoyer } from "../store/hooks";

const EVENT_ICON: Record<string, string> = {
  level_changed: "▥",
  objective_validated: "✓",
  objective_unvalidated: "✕",
  stock_added: "+",
  stock_updated: "✎",
  stock_removed: "−",
  household_updated: "⌂",
  context_changed: "⇄",
  onboarding: "★",
  reset: "⟲",
  "household.set": "⌂",
  "validation.set": "✓",
  "validation.delete": "✕",
  "stock.upsert": "+",
  "stock.delete": "−",
  "custom.upsert": "✎",
  "custom.delete": "✕",
};

export function HistoryPage() {
  const { ops, today } = useFoyer();
  const h = useMemo(() => buildHistory(CATALOG, ops, today), [ops, today]);
  const journal = useMemo(() => [...h.journal].reverse(), [h]);
  return (
    <div className="page">
      <h1>Historique</h1>
      <section className="panel">
        <h2>Évolution du niveau</h2>
        <LevelChart snapshots={h.snapshots} levels={CATALOG.levels} />
      </section>
      <section className="panel">
        <h2>Journal</h2>
        <ul className="journal">
          {journal.map((e, i) => (
            <li key={`${e.op_id ?? e.at}-${i}`} className={e.type}>
              <span className="journal-icon">{EVENT_ICON[e.type] ?? "•"}</span>
              <span className="journal-date">{new Date(e.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
              <span>{e.message}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Courbe en escalier du niveau dans le temps. */
export function LevelChart({ snapshots, levels }: { snapshots: Snapshot[]; levels: { n: number; name: string }[] }) {
  if (snapshots.length === 0) return <p className="empty">Pas encore d'historique.</p>;
  const W = 720;
  const H = 260;
  const pad = { l: 150, r: 16, t: 12, b: 28 };
  const t0 = new Date(snapshots[0].at).getTime();
  const t1 = Math.max(Date.now(), t0 + 86400_000);
  const x = (t: number) => pad.l + ((t - t0) / (t1 - t0)) * (W - pad.l - pad.r);
  const y = (lv: number) => pad.t + ((MAX_LEVEL - lv) / MAX_LEVEL) * (H - pad.t - pad.b);
  let d = "";
  snapshots.forEach((s, i) => {
    const xs = x(new Date(s.at).getTime());
    d += i === 0 ? `M${xs},${y(s.level)}` : ` H${xs} V${y(s.level)}`;
  });
  d += ` H${x(t1)}`;
  return (
    <svg className="level-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Évolution du niveau">
      {levels.map((l) => (
        <g key={l.n}>
          <line x1={pad.l} x2={W - pad.r} y1={y(l.n)} y2={y(l.n)} className="grid" />
          <text x={pad.l - 8} y={y(l.n) + 4} textAnchor="end">
            {l.n} · {l.name}
          </text>
        </g>
      ))}
      <path d={d} className="line" />
      {snapshots.map((s) => (
        <circle key={`${s.at}-${s.level}`} cx={x(new Date(s.at).getTime())} cy={y(s.level)} r={4} className="dot">
          <title>{`${formatDate(s.at)} : niveau ${s.level} — ${s.cause}`}</title>
        </circle>
      ))}
      <text x={pad.l} y={H - 6}>
        {formatDate(snapshots[0].at)}
      </text>
      <text x={W - pad.r} y={H - 6} textAnchor="end">
        aujourd'hui
      </text>
    </svg>
  );
}
