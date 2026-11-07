import { describe, expect, it } from "vitest";
import { builtTone, GROUND, HEIGHT, MONUMENTS, monumentOf, tierBottom, tierTop } from "./monument";
import { formatDays, formatPeriod, gaugePosition } from "./format";

describe("monument", () => {
  it("empile les paliers du bas vers le haut, posés sur le socle", () => {
    expect(tierTop(1)).toBeGreaterThan(tierTop(9));
    expect(tierBottom(2)).toBe(tierTop(1));
    expect(tierBottom(1)).toBe(GROUND);
    expect(GROUND).toBeLessThan(HEIGHT);
    expect(tierTop(9)).toBeGreaterThan(0);
  });

  it("donne une couleur propre à chaque palier acquis", () => {
    for (const { id: style } of MONUMENTS) {
      const fills = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => builtTone(style, n).fill));
      expect(fills.size).toBe(9);
    }
  });

  it("retombe sur la colonne pour un choix inconnu ou absent", () => {
    expect(monumentOf(undefined)).toBe("colonne");
    expect(monumentOf("obelisque")).toBe("colonne");
    expect(monumentOf("arbre")).toBe("arbre");
  });
});

describe("format", () => {
  it("affiche des jours puis des mois", () => {
    expect(formatDays(null)).toBe("—");
    expect(formatDays(0.5)).toBe("< 1 jour");
    expect(formatDays(3.9)).toBe("3 jours");
    expect(formatDays(91)).toBe("3,0 mois");
  });

  it("affiche une périodicité lisible", () => {
    expect(formatPeriod(180)).toBe("6 mois");
    expect(formatPeriod(365)).toBe("an");
    expect(formatPeriod(1095)).toBe("3 ans");
  });

  it("espace les repères de la jauge", () => {
    expect(gaugePosition(180)).toBe(100);
    expect(gaugePosition(14) - gaugePosition(3)).toBeGreaterThan(10);
    expect(gaugePosition(400)).toBe(100);
  });
});
