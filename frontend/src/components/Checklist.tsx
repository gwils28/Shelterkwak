import { Link } from "react-router-dom";
import type { Axis, ChecklistItem, ChecklistKind } from "../model";
import { actions } from "../store/hooks";

const GROUPS: { kinds: ChecklistKind[]; title: string; tone: string }[] = [
  { kinds: ["revalidate"], title: "À revalider", tone: "warn" },
  { kinds: ["stock_expired", "stock_expiring"], title: "Stocks à renouveler", tone: "warn" },
  { kinds: ["blocking"], title: "Pour poser le prochain tambour", tone: "main" },
  { kinds: ["optional"], title: "Bonus recommandés", tone: "soft" },
  { kinds: ["prepare"], title: "Préparer ton futur lieu de vie", tone: "soft" },
];

interface Props {
  items: ChecklistItem[];
  axes: Axis[];
  nextLevelName?: string;
  limit?: number;
}

export function Checklist({ items, axes, nextLevelName, limit = 8 }: Props) {
  const axisById = Object.fromEntries(axes.map((a) => [a.id, a]));

  if (items.length === 0) return <p className="empty">Rien à faire pour l'instant : la colonne est solide.</p>;

  return (
    <div className="checklist">
      {GROUPS.map((g) => {
        const group = items.filter((i) => g.kinds.includes(i.kind));
        if (group.length === 0) return null;
        return (
          <section key={g.title} className={`check-group ${g.tone}`}>
            <h3>
              {g.kinds[0] === "blocking" && nextLevelName ? `Pour atteindre « ${nextLevelName} »` : g.title}
              <span className="count">{group.length}</span>
            </h3>
            <ul>
              {group.slice(0, limit).map((i) => {
                const axis = i.axis ? axisById[i.axis] : undefined;
                const stockObjective = i.objective_kind === "stock";
                const canCheck = i.objective_id && i.kind !== "prepare" && !stockObjective;
                return (
                  <li key={`${i.kind}-${i.objective_id ?? i.stock_id}`}>
                    {canCheck ? (
                      <button
                        className="tick"
                        title={i.kind === "revalidate" ? "Revalider aujourd'hui" : "Marquer comme fait"}
                        onClick={() => void actions.validate(i.objective_id!)}
                      >
                        {i.kind === "revalidate" ? "↻" : "✓"}
                      </button>
                    ) : (
                      <Link className="tick ghost" to={i.stock_id || stockObjective ? "/inventaire" : "/objectifs"} title="Ouvrir">
                        →
                      </Link>
                    )}
                    <div>
                      <div className="item-title">
                        {axis && <span title={axis.name}>{axis.icon} </span>}
                        {i.title}
                        {i.level && <span className="lvl">niv. {i.level}</span>}
                      </div>
                      {i.detail && <div className="item-detail">{i.detail}</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
            {group.length > limit && (
              <Link className="more" to="/objectifs">
                + {group.length - limit} autre(s)
              </Link>
            )}
          </section>
        );
      })}
    </div>
  );
}
