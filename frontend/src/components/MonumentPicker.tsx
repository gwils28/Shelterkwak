import { CATALOG } from "../engine/catalog";
import { levelOf, MAX_LEVEL } from "../engine/types";
import { type MonumentStyle, MONUMENTS } from "../lib/monument";
import type { Tier } from "../model";
import { Column } from "./Column";

/** Aperçu : 5 paliers acquis, le 6e à moitié, de quoi voir couleurs et gris côte à côte. */
const DEMO: Tier[] = Array.from({ length: MAX_LEVEL }, (_, i) => {
  const n = i + 1;
  const info = levelOf(CATALOG, n);
  const state = n <= 5 ? "built" : n === 6 ? "current" : "future";
  return {
    n,
    state,
    required_total: 10,
    required_done: state === "built" ? 10 : state === "current" ? 5 : 0,
    optional_total: 0,
    optional_done: 0,
    cracked: false,
    progress: state === "built" ? 1 : state === "current" ? 0.5 : 0,
    name: info.name,
    horizon: info.horizon,
    summary: info.summary,
  };
});

export function MonumentPicker({ value, onChange }: { value: MonumentStyle; onChange: (m: MonumentStyle) => void }) {
  return (
    <div className="monument-picker" role="radiogroup" aria-label="Choix du monument">
      {MONUMENTS.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={value === m.id}
          className={`card-choice monument-choice${value === m.id ? " selected" : ""}`}
          onClick={() => onChange(m.id)}
        >
          <Column tiers={DEMO} level={5} compact monument={m.id} />
          <strong>{m.name}</strong>
          <span>{m.hint}</span>
        </button>
      ))}
    </div>
  );
}
