import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { LevelInfo } from "../components/LevelInfo";
import { AutonomyCards } from "../components/AutonomyCards";
import { AxisLevels } from "../components/AxisLevels";
import { Checklist } from "../components/Checklist";
import { Column, romanNumeral } from "../components/Column";
import { monumentOf } from "../lib/monument";
import { CATALOG } from "../engine/catalog";
import { history } from "../engine/replay";
import { levelOf, MAX_LEVEL } from "../engine/types";
import { useFoyer } from "../store/hooks";

export function DashboardPage() {
  const { dashboard: data, catalog, objectives, ops, today } = useFoyer();
  const navigate = useNavigate();
  const best = useMemo(() => Math.max(0, ...history(CATALOG, ops, today).snapshots.map((s) => s.level)), [ops, today]);
  if (!data) return null;
  const toRegain =
    best > data.level
      ? objectives.filter((o) => o.required && o.level <= best && (o.status === "todo" || o.status === "expired")).length
      : 0;
  const inGrace = data.counts.grace ?? 0;

  const h = data.household;
  const current = data.tiers.find((t) => t.state === "current");
  const goal = h.goal_level;
  const alerts = (data.counts.expired ?? 0) + data.checklist.filter((i) => i.kind === "stock_expired").length;

  return (
    <div className="dashboard">
      <section className="panel column-panel">
        <Column
          tiers={data.tiers}
          level={data.level}
          goalLevel={goal}
          monument={monumentOf(h.monument)}
          onSelect={(n) => navigate(`/objectifs?niveau=${n}`)}
        />
        <p className="hint">Clique un palier pour voir ses objectifs. ◎ = palier visé.</p>
      </section>

      <div className="dashboard-side">
        <section className="panel level-panel">
          <div className="level-badge">{romanNumeral(data.level)}</div>
          <div>
            <div className="eyebrow">Niveau {data.level} sur {MAX_LEVEL}</div>
            <h1>{data.level_info.name}</h1>
            <p>{data.level_info.summary}</p>
            {data.next_level_info && current && (
              <p className="next">
                Prochain palier : <strong>{data.next_level_info.name}</strong>
                <LevelInfo level={data.next_level_info} /> — {current.required_done}/{current.required_total}{" "}
                objectifs requis ({Math.round(current.progress * 100)} %)
              </p>
            )}
            {goal && (
              <p className="goal">
                {data.level >= goal ? (
                  `🎯 Objectif atteint : niveau ${goal}. Vise plus haut depuis l'onglet Foyer.`
                ) : (
                  <>
                    🎯 Objectif : niveau {goal} (<strong>{levelOf(catalog, goal).name}</strong>
                    <LevelInfo level={levelOf(catalog, goal)} />)
                    {h.goal_horizon_months ? ` d'ici ${h.goal_horizon_months} mois` : ""} — encore {goal - data.level} palier(s).
                  </>
                )}
              </p>
            )}
            {best > data.level && (
              <p className="best">
                🏛️ Meilleur niveau atteint : <strong>{levelOf(catalog, best).name}</strong> (niveau {best}). Encore {toRegain} action(s)
                pour le retrouver : tout ce que tu as appris reste acquis.
              </p>
            )}
            {inGrace > 0 && (
              <p className="warn-text">
                ⏳ {inGrace} validation(s) en sursis : le tambour est fissuré mais tient encore. Refais-les avant qu'il ne tombe.
              </p>
            )}
            {alerts > 0 && <p className="warn-text">⚠ {alerts} élément(s) expiré(s) ou périmé(s) font baisser la colonne.</p>}
          </div>
        </section>

        <section className="panel">
          <h2>Ta checklist</h2>
          <Checklist items={data.checklist} axes={catalog.axes} nextLevelName={data.next_level_info?.name} />
        </section>

        <section className="panel">
          <h2>Autonomie</h2>
          <AutonomyCards autonomy={data.autonomy} />
        </section>

        <section className="panel">
          <h2>Niveau par axe</h2>
          <p className="hint">Le niveau global est bloqué par le maillon faible (surligné).</p>
          <AxisLevels axes={data.axis_levels} level={data.level} />
        </section>
      </div>
    </div>
  );
}
