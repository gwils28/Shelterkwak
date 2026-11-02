import type { Autonomy } from "../api";
import { MILESTONES, formatDays, formatNumber, gaugePosition, unitLabel } from "../lib/format";

export function AutonomyCards({ autonomy }: { autonomy: Autonomy[] }) {
  return (
    <div className="autonomy-cards">
      {autonomy.map((a) => {
        const days = a.days ?? 0;
        const losing = a.days !== null && a.days_after_expiring !== null && a.days_after_expiring < a.days;
        return (
          <div key={a.category} className={`autonomy-card${a.days === null ? " na" : ""}`}>
            <div className="autonomy-head">
              <span>{a.name}</span>
              <strong>{formatDays(a.days)}</strong>
            </div>
            {a.days === null ? (
              <div className="item-detail">Non applicable à ton foyer</div>
            ) : (
              <>
                <div className="gauge">
                  <div className="gauge-fill" style={{ width: `${gaugePosition(days)}%` }} />
                  {MILESTONES.map((m) => (
                    <span key={m} className={`milestone${days >= m ? " reached" : ""}`} style={{ left: `${gaugePosition(m)}%` }}>
                      {m < 30 ? `${m} j` : `${m / 30} m`}
                    </span>
                  ))}
                </div>
                <div className="item-detail">
                  {formatNumber(a.total)} {unitLabel(a.unit, a.total)} · besoin {formatNumber(a.need_per_day)} {a.unit}/jour
                  {losing && <span className="warn-text"> · {formatDays(a.days_after_expiring)} hors produits qui périment bientôt</span>}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
