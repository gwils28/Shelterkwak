import { memberConditions } from "../engine/engine";
import type { MemberData } from "../engine/replay";
import { CATALOG } from "../engine/catalog";
import { isAnimal, type MemberCondition } from "../engine/types";
import type { MemberIn, NamedId } from "../model";

interface Props {
  members: MemberData[];
  types: NamedId[];
  conditions: MemberCondition[];
  onChange: (m: MemberIn[]) => void;
}

/** Membre normalisé : `conditions` toujours présent, `medical` gardé en double de « traitement ». */
function normalize(m: MemberData): MemberIn {
  const conditions = memberConditions(m);
  return { name: m.name, type: m.type, conditions, medical: conditions.includes("traitement") };
}

export function MembersEditor({ members, types, conditions, onChange }: Props) {
  const list = members.map(normalize);
  const update = (i: number, patch: Partial<MemberIn>) =>
    onChange(list.map((m, j) => (j === i ? normalize({ ...m, ...patch, medical: false }) : m)));
  const toggle = (i: number, id: string) => {
    const cur = list[i].conditions;
    update(i, { conditions: cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id] });
  };
  const nameOf = (id: string) => conditions.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="members">
      {list.map((m, i) => (
        <div key={i} className="member">
          <div className="member-row">
            <input placeholder="Prénom ou surnom" value={m.name} onChange={(e) => update(i, { name: e.target.value })} aria-label="Nom" />
            <select value={m.type} onChange={(e) => update(i, { type: e.target.value })} aria-label="Type">
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button className="icon" title="Retirer" disabled={list.length === 1} onClick={() => onChange(list.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
          {!isAnimal(CATALOG, m.type) && (
            <details className="member-health">
              <summary>
                Santé et particularités
                {m.conditions.length > 0 ? (
                  <span className="hint"> : {m.conditions.map(nameOf).join(", ")}</span>
                ) : (
                  <span className="hint"> : aucune</span>
                )}
              </summary>
              <p className="hint">Chaque particularité ajoute les objectifs et les réserves qu'elle implique.</p>
              <div className="condition-list">
                {conditions.map((c) => (
                  <label key={c.id} className="inline">
                    <input type="checkbox" checked={m.conditions.includes(c.id)} onChange={() => toggle(i, c.id)} />
                    {c.name}
                  </label>
                ))}
              </div>
            </details>
          )}
        </div>
      ))}
      <button onClick={() => onChange([...list, { name: "", type: "adulte", conditions: [], medical: false }])}>+ Ajouter un membre</button>
    </div>
  );
}
