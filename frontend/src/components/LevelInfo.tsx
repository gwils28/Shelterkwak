import { useEffect, useRef, useState } from "react";

interface LevelLike {
  n: number;
  name: string;
  horizon: string;
  summary: string;
}

/** Ce que représente un niveau, en une phrase et un horizon. */
export function LevelInfoText({ level }: { level: LevelLike }) {
  return (
    <>
      <strong>
        Niveau {level.n} · {level.name}
      </strong>
      {level.horizon !== "0" && <span className="level-info-horizon">Horizon : {level.horizon}</span>}
      <span>{level.summary}</span>
    </>
  );
}

/** Bouton « i » cliquable à côté d'un nom de niveau, qui ouvre un résumé. */
export function LevelInfo({ level }: { level: LevelLike }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className="level-info" ref={ref}>
      <button
        type="button"
        className="info-button"
        aria-label={`Ce que représente le niveau ${level.name}`}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        i
      </button>
      {open && (
        <span className="level-info-pop" role="note">
          <LevelInfoText level={level} />
        </span>
      )}
    </span>
  );
}
