import { useMemo, useState } from "react";
import { Column, romanNumeral } from "../components/Column";
import { LevelInfo } from "../components/LevelInfo";
import { MembersEditor } from "../components/MembersEditor";
import { CATALOG } from "../engine/catalog";
import { type Answer, questionOptions } from "../engine/interview";
import { type ContextId, isAnimal, type Question } from "../engine/types";
import { visibleSections } from "../lib/interview";
import type { Dashboard, MemberIn } from "../model";
import { actions, buildOnboarding, type OnboardingPayload, previewOnboarding } from "../store/hooks";

type Step = "foyer" | "contexte" | "interview" | "resultat";

const CONTEXT_HELP: Record<ContextId, string> = {
  appartement: "Peu d'espace, pas de terrain : stocks, évacuation, réseau et compétences.",
  periurbain: "Un jardin : récupération d'eau, potager, un peu d'énergie autonome.",
  rural: "Du terrain : puits, production alimentaire, bois, autonomie forte possible.",
};

export function OnboardingPage() {
  const catalog = CATALOG;
  const [step, setStep] = useState<Step>("foyer");
  const [name, setName] = useState("Mon foyer");
  const [members, setMembers] = useState<MemberIn[]>([{ name: "", type: "adulte", conditions: [], medical: false }]);
  const [context, setContext] = useState<ContextId>("appartement");
  const [target, setTarget] = useState<ContextId | "">("");
  const [targetDate, setTargetDate] = useState("");
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [sectionIndex, setSectionIndex] = useState(0);
  const [result, setResult] = useState<{ payload: OnboardingPayload; dashboard: Dashboard } | null>(null);

  const sections = useMemo(() => visibleSections(catalog, answers, context, members), [catalog, answers, context, members]);

  const membersOk = members.some((m) => !isAnimal(catalog, m.type)) && members.every((m) => m.name.trim());
  const section = sections[Math.min(sectionIndex, sections.length - 1)];

  /** Une section passée sans rien cocher vaut réponse « rien » (sinon la question compte comme non posée). */
  const withSkipped = (): Record<string, Answer> => {
    const next = { ...answers };
    for (const q of section?.questions ?? []) if (q.type === "multi" && next[q.id] === undefined) next[q.id] = [];
    return next;
  };
  const nextSection = () => {
    setAnswers(withSkipped());
    setSectionIndex(sectionIndex + 1);
  };

  const finish = () => {
    const answers = withSkipped();
    setAnswers(answers);
    const payload = buildOnboarding(
      {
        name: name.trim() || "Mon foyer",
        context,
        target_context: target || null,
        target_date: target && targetDate ? targetDate : null,
        members: members.map((m) => ({ ...m, name: m.name.trim() })),
      },
      answers,
    );
    setResult({ payload, dashboard: previewOnboarding(payload) });
    setStep("resultat");
  };
  // Enregistrer l'interview fait basculer l'application sur la colonne.
  const openDashboard = () => result && void actions.commitOnboarding(result.payload);

  return (
    <div className="onboarding">
      <header className="onboarding-head">
        <h1>
          <span className="brand-mark">▥</span> Shelterkwak
        </h1>
        <p>Bâtis la colonne de résilience de ton foyer, tambour après tambour.</p>
        <ol className="steps">
          {(["foyer", "contexte", "interview", "resultat"] as Step[]).map((s, i) => (
            <li key={s} className={s === step ? "active" : ""}>
              {i + 1}. {{ foyer: "Ton foyer", contexte: "Ton lieu de vie", interview: "Interview", resultat: "Ton niveau" }[s]}
            </li>
          ))}
        </ol>
      </header>

      {step === "foyer" && (
        <section className="panel">
          <h2>Qui compose ton foyer ?</h2>
          <p className="hint">Les besoins (litres d'eau, calories, traitements) sont calculés pour chaque membre.</p>
          <label className="field">
            Nom du foyer
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <MembersEditor members={members} onChange={setMembers} types={catalog.member_types} conditions={catalog.member_conditions} />
          <div className="actions">
            <button className="primary" disabled={!membersOk} onClick={() => setStep("contexte")}>
              Continuer
            </button>
          </div>
        </section>
      )}

      {step === "contexte" && (
        <section className="panel">
          <h2>Où vis-tu aujourd'hui ?</h2>
          <div className="cards">
            {catalog.contexts.map((c) => (
              <button
                key={c.id}
                className={`card-choice${context === c.id ? " selected" : ""}`}
                onClick={() => setContext(c.id as ContextId)}
              >
                <strong>{c.name}</strong>
                <span>{CONTEXT_HELP[c.id as ContextId]}</span>
              </button>
            ))}
          </div>
          <h2>Prévois-tu de déménager ?</h2>
          <p className="hint">
            Les objectifs propres à ton futur lieu de vie te seront proposés en « Préparer la suite » : compétences et budget à
            anticiper dès maintenant.
          </p>
          <div className="row">
            <label className="field">
              Contexte visé
              <select value={target} onChange={(e) => setTarget(e.target.value as ContextId | "")}>
                <option value="">Pas de projet</option>
                {catalog.contexts
                  .filter((c) => c.id !== context)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            {target && (
              <label className="field">
                Échéance envisagée
                <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
              </label>
            )}
          </div>
          <div className="actions">
            <button onClick={() => setStep("foyer")}>Retour</button>
            <button className="primary" onClick={() => setStep("interview")}>
              Commencer l'interview
            </button>
          </div>
        </section>
      )}

      {step === "interview" && section && (
        <section className="panel">
          <div className="eyebrow">
            Étape {Math.min(sectionIndex, sections.length - 1) + 1} sur {sections.length} · {section.section}
          </div>
          {section.questions.map((q) => (
            <QuestionField key={q.id} q={q} options={questionOptions(catalog, q)} value={answers[q.id] ?? null} onChange={(v) => setAnswers({ ...answers, [q.id]: v })} />
          ))}
          <div className="actions">
            <button onClick={() => (sectionIndex === 0 ? setStep("contexte") : setSectionIndex(sectionIndex - 1))}>Retour</button>
            {sectionIndex < sections.length - 1 ? (
              <button className="primary" onClick={nextSection}>
                Suivant
              </button>
            ) : (
              <button className="primary" onClick={finish}>
                Estimer mon niveau
              </button>
            )}
          </div>
        </section>
      )}

      {step === "resultat" && result && (() => {
        const r = result.dashboard;
        return (
        <section className="panel result">
          <div className="result-column">
            <Column tiers={r.tiers} level={r.level} goalLevel={r.household.goal_level} />
          </div>
          <div>
            <div className="level-badge big">{romanNumeral(r.level)}</div>
            <h2>
              Niveau {r.level} : {r.level_info.name}
            </h2>
            <p>{r.level_info.summary}</p>
            {r.next_level_info && (
              <p>
                Pour poser le tambour suivant (<strong>{r.next_level_info.name}</strong>
                <LevelInfo level={r.next_level_info} />), il te reste{" "}
                {r.checklist.filter((i) => i.kind === "blocking").length} objectif(s) à valider. Ils t'attendent dans ta
                checklist.
              </p>
            )}
            <p className="hint">Tu pourras corriger tout ce que l'interview a déclaré dans les onglets Objectifs et Inventaire.</p>
            <div className="actions">
              <button className="primary" onClick={openDashboard}>
                Voir ma colonne
              </button>
            </div>
          </div>
        </section>
        );
      })()}
    </div>
  );
}

function QuestionField({
  q,
  options,
  value,
  onChange,
}: {
  q: Question;
  options: { value: string; label: string }[];
  value: Answer;
  onChange: (v: Answer) => void;
}) {
  const list = Array.isArray(value) ? value : [];
  return (
    <fieldset className="question">
      <legend>{q.text}</legend>
      {q.help && <p className="hint">{q.help}</p>}
      {q.type === "number" && (
        <label className="number">
          <input
            type="number"
            min={0}
            value={typeof value === "number" ? value : ""}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          />{" "}
          {q.unit}
        </label>
      )}
      {q.type !== "number" && (
        <div className={`options ${q.type}`}>
          {options.map((o) => {
            const checked = q.type === "multi" ? list.includes(o.value) : value === o.value;
            return (
              <label key={o.value} className={`option${checked ? " checked" : ""}`}>
                <input
                  type={q.type === "multi" ? "checkbox" : "radio"}
                  name={q.id}
                  checked={checked}
                  onChange={() =>
                    q.type === "multi"
                      ? onChange(checked ? list.filter((v) => v !== o.value) : [...list, o.value])
                      : onChange(o.value)
                  }
                />
                {o.label}
              </label>
            );
          })}
          {q.type === "multi" && (
            <label className={`option none${Array.isArray(value) && value.length === 0 ? " checked" : ""}`}>
              <input type="checkbox" checked={Array.isArray(value) && value.length === 0} onChange={() => onChange([])} />
              Rien de tout ça pour l'instant
            </label>
          )}
        </div>
      )}
    </fieldset>
  );
}
