import type { Status } from "../api";

export const STATUS_LABEL: Record<Status, string> = {
  na: "Non applicable",
  todo: "À faire",
  done: "Validé",
  expiring: "À revalider bientôt",
  expired: "Expiré",
};

export function formatDays(days: number | null): string {
  if (days === null) return "—";
  if (days < 1) return days === 0 ? "0 jour" : "< 1 jour";
  if (days < 60) return `${Math.floor(days)} jour${Math.floor(days) > 1 ? "s" : ""}`;
  return `${(days / 30.4).toFixed(1).replace(".", ",")} mois`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatNumber(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

export function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const MILESTONES = [3, 14, 90, 180] as const;

export function formatPeriod(days: number): string {
  const months = Math.round(days / 30.4);
  if (months < 12) return `${months} mois`;
  const years = Math.round(months / 12);
  return years === 1 ? "an" : `${years} ans`;
}

/** Position (en %) sur la jauge d'autonomie : échelle racine carrée, 180 jours = 100 %. */
export function gaugePosition(days: number, max = 180): number {
  return Math.min(100, Math.sqrt(Math.max(0, days) / max) * 100);
}

export function unitLabel(unit: string, n: number): string {
  return unit === "jour" && n >= 2 ? "jours" : unit;
}
