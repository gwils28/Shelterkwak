import { describe, expect, it } from "vitest";
import { columnHeight, drumGeometry } from "./column";
import { formatDays, formatPeriod, gaugePosition } from "./format";

describe("colonne", () => {
  it("empile les tambours du bas vers le haut en s'affinant", () => {
    const d1 = drumGeometry(1);
    const d8 = drumGeometry(8);
    expect(d1.y).toBeGreaterThan(d8.y);
    expect(d1.width).toBeGreaterThan(d8.width);
    expect(d1.y + d1.height).toBeLessThanOrEqual(columnHeight());
    expect(drumGeometry(2).y + drumGeometry(2).height).toBe(d1.y);
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
