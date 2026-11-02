import { useNavigate } from "react-router-dom";
import { AutonomyCards } from "../components/AutonomyCards";
import { AxisLevels } from "../components/AxisLevels";
import { Checklist } from "../components/Checklist";
import { Column, romanNumeral } from "../components/Column";
import { useFoyer } from "../store/hooks";

export function DashboardPage() {
  const { dashboard: data, catalog } = useFoyer();
  const navigate = useNavigate();
  if (!data) return null;

  const h = data.household;
  const current = data.tiers.find((t) => t.state === "current");
  const goal = h.goal_level;
  const alerts = (data.counts.expired ?? 0) + data.checklist.filter((i) => i.kind === "stock_expired").length;

  return (
    <div className="dashboard">
      <section className="panel column-panel">
        <Column tiers={data.tiers} level={data.level} goalLevel={goal} onSelect={(n) => navigate(`/objectifs?niveau=${n}`)} />
        <p className="hint">Clique un tambour pour voir ses objectifs. ◎ = palier visé.</p>
      </section>

      <div className="dashboard-side">
        <section className="panel level-panel">
          <div className="level-badge">{romanNumeral(data.level)}</div>
          <div>
            <div className="eyebrow">Niveau {data.level} sur 8</div>
            <h1>{data.level_info.name}</h1>
            <p>{data.level_info.summary}</p>
            {data.next_level_info && current && (
              <p className="next">
                Prochain palier : <strong>{data.next_level_info.name}</strong> — {current.required_done}/{current.required_total}{" "}
                objectifs requis ({Math.round(current.progress * 100)} %)
              </p>
            )}
            {goal && (
              <p className="goal">
                {data.level >= goal
                  ? `🎯 Objectif atteint : niveau ${goal}. Vise plus haut depuis l'onglet Foyer.`
                  : `🎯 Objectif : niveau ${goal} (${catalog.levels[goal - 1].name})${h.goal_horizon_months ? ` d'ici ${h.goal_horizon_months} mois` : ""} — encore ${goal - data.level} palier(s).`}
              </p>
            )}
            {alerts > 0 && <p className="warn-text">⚠ {alerts} élément(s) expiré(s) ou périmé(s) fragilisent la colonne.</p>}
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
