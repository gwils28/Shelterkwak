// Dates civiles au format ISO « AAAA-MM-JJ » : comparables comme des chaînes, sans fuseau.

export type IsoDate = string;

export function addDays(d: IsoDate, days: number): IsoDate {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day + days)).toISOString().slice(0, 10);
}

/** Date locale du jour (et non UTC) : c'est le jour vécu par l'utilisateur. */
export function localToday(now: Date = new Date()): IsoDate {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export const DATE_MAX: IsoDate = "9999-12-31";
