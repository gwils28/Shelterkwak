// Icônes de la navigation : traits simples, couleur héritée du lien (actif ou non).

const common = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function IconMonument() {
  return (
    <svg {...common} aria-hidden>
      <path d="M3 21h18M5 18h14M6 8h12M5 5.5 12 3l7 2.5" />
      <path d="M8 8v10M12 8v10M16 8v10" />
    </svg>
  );
}

export function IconObjectives() {
  return (
    <svg {...common} aria-hidden>
      <rect x="4" y="3.5" width="16" height="17" rx="3" />
      <path d="m8 9 1.6 1.6L12.5 7.8M8 15.5l1.6 1.6 2.9-2.8M15 9h1.5M15 15.5h1.5" />
    </svg>
  );
}

export function IconStock() {
  return (
    <svg {...common} aria-hidden>
      <path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16Z" />
      <path d="M3.5 8 12 12.5 20.5 8M12 12.5v8" />
    </svg>
  );
}

export function IconJourney() {
  return (
    <svg {...common} aria-hidden>
      <path d="M4 19.5h16" />
      <path d="m4.5 16 4.5-5 3.5 3 6.5-8" />
      <path d="M15.5 6H19v3.5" />
    </svg>
  );
}

export function IconHousehold() {
  return (
    <svg {...common} aria-hidden>
      <path d="M4 11 12 4l8 7" />
      <path d="M6 9.5V20h12V9.5" />
      <circle cx="12" cy="14.5" r="2.2" />
    </svg>
  );
}

export function IconSkills() {
  return (
    <svg {...common} aria-hidden>
      <circle cx="12" cy="4.5" r="2" />
      <circle cx="5.5" cy="12" r="2" />
      <circle cx="18.5" cy="12" r="2" />
      <circle cx="12" cy="19.5" r="2" />
      <path d="M10.7 6 6.8 10.5M13.3 6l3.9 4.5M6.8 13.5l3.9 4.5M17.2 13.5 13.3 18" />
    </svg>
  );
}
