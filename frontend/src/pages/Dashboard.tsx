import { type CSSProperties, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AutonomyCards } from "../components/AutonomyCards";
import { AxisLevels } from "../components/AxisLevels";
import { Checklist } from "../components/Checklist";
import { Column, romanNumeral } from "../components/Column";
import { LevelInfo } from "../components/LevelInfo";
import { CATALOG } from "../engine/catalog";
import { history } from "../engine/replay";
import { levelOf, MAX_LEVEL } from "../engine/types";
import { MONUMENTS, monumentOf, SCENE } from "../lib/monument";
import { animationsEnabled } from "../lib/prefs";
import { useFoyer } from "../store/hooks";

/** Accueil : le monument en grand dans sa scène, puis ce qu'il y a à faire maintenant. */
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
  const monument = monumentOf(h.monument);
  const current = data.tiers.find((t) => t.state === "current");
  const goal = h.goal_level;
  const alerts = (data.counts.expired ?? 0) + data.checklist.filter((i) => i.kind === "stock_expired").length;
  const next = data.checklist.slice(0, 3);
  const pct = current ? Math.round(current.progress * 100) : 100;

  return (
    <div className="home">
      <section
        className={`hero scene-${monument}`}
        style={{ "--scene": SCENE[monument] } as CSSProperties}
        aria-label={MONUMENTS.find((m) => m.id === monument)?.name}
      >
        <header className="hero-head">
          <div className="level-badge">{romanNumeral(data.level)}</div>
          <div className="hero-title">
            <div className="eyebrow">
              Niveau {data.level} sur {MAX_LEVEL}
            </div>
            <h1>
              {data.level_info.name} <LevelInfo level={data.level_info} />
            </h1>
            {data.next_level_info && current && (
              <div className="hero-progress">
                <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                  <span style={{ width: `${pct}%` }} />
                </div>
                <small>
                  {current.required_done}/{current.required_total} vers « {data.next_level_info.name} »
                  {goal && data.level < goal ? ` · 🎯 niveau ${goal}` : ""}
                </small>
              </div>
            )}
          </div>
        </header>
        <Column
          tiers={data.tiers}
          level={data.level}
          goalLevel={goal}
          monument={monument}
          animated={animationsEnabled()}
          onSelect={(n) => navigate(`/objectifs?niveau=${n}`)}
        />
        <p className="hint">Touche un palier pour voir ses objectifs · ◎ palier visé</p>
      </section>

      <div className="home-side">
        <section className="panel next-step">
          <div className="section-head">
            <h2>Prochaine étape</h2>
            <Link to="/objectifs">Tout voir</Link>
          </div>
          <p className="hint">{data.level_info.summary}</p>
          <Checklist items={next} axes={catalog.axes} nextLevelName={data.next_level_info?.name} limit={3} />
        </section>

        {(goal || best > data.level || inGrace > 0 || alerts > 0) && (
          <section className="panel notices">
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
              <p className="warn-text">⏳ {inGrace} validation(s) en sursis : le palier est fissuré mais tient encore. Refais-les avant qu'il ne tombe.</p>
            )}
            {alerts > 0 && <p className="warn-text">⚠ {alerts} élément(s) expiré(s) ou périmé(s) font baisser le monument.</p>}
          </section>
        )}

        <section className="panel">
          <h2>Autonomie</h2>
          <AutonomyCards autonomy={data.autonomy} />
        </section>

        <details className="panel fold">
          <summary>
            <h2>Toute la checklist</h2>
            <span className="count">{data.checklist.length}</span>
          </summary>
          <Checklist items={data.checklist} axes={catalog.axes} nextLevelName={data.next_level_info?.name} />
        </details>

        <details className="panel fold">
          <summary>
            <h2>Niveau par axe</h2>
          </summary>
          <p className="hint">Le niveau global est bloqué par le maillon faible (surligné).</p>
          <AxisLevels axes={data.axis_levels} level={data.level} />
        </details>
      </div>
    </div>
  );
}
