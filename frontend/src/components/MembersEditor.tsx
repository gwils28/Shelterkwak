import type { MemberIn, NamedId } from "../api";

interface Props {
  members: MemberIn[];
  types: NamedId[];
  onChange: (m: MemberIn[]) => void;
}

export function MembersEditor({ members, types, onChange }: Props) {
  const update = (i: number, patch: Partial<MemberIn>) => onChange(members.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  return (
    <div className="members">
      {members.map((m, i) => (
        <div key={i} className="member-row">
          <input placeholder="Prénom ou surnom" value={m.name} onChange={(e) => update(i, { name: e.target.value })} aria-label="Nom" />
          <select value={m.type} onChange={(e) => update(i, { type: e.target.value })} aria-label="Type">
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {m.type !== "animal" && (
            <label className="inline">
              <input type="checkbox" checked={m.medical} onChange={(e) => update(i, { medical: e.target.checked })} />
              Traitement médical régulier
            </label>
          )}
          <button className="icon" title="Retirer" disabled={members.length === 1} onClick={() => onChange(members.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...members, { name: "", type: "adulte", medical: false }])}>+ Ajouter un membre</button>
    </div>
  );
}
