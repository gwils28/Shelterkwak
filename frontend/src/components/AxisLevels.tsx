import type { Dashboard } from "../api";

export function AxisLevels({ axes, level }: { axes: Dashboard["axis_levels"]; level: number }) {
  const weakest = Math.min(...axes.map((a) => a.level));
  return (
    <ul className="axis-levels">
      {axes.map((a) => (
        <li key={a.axis} className={a.level === weakest && a.level <= level ? "weak" : ""}>
          <span className="axis-name">
            {a.icon} {a.name}
          </span>
          <span className="bar" aria-label={`niveau ${a.level} sur 8`}>
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} className={i < a.level ? "on" : ""} />
            ))}
          </span>
          <span className="axis-level">{a.level}</span>
        </li>
      ))}
    </ul>
  );
}
