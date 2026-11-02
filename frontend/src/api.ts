// Client de l'API Shelterkwak (backend FastAPI, préfixe /api).

export type ContextId = "appartement" | "periurbain" | "rural";
export type Status = "na" | "todo" | "done" | "expiring" | "expired";

export interface Level {
  n: number;
  name: string;
  horizon: string;
  summary: string;
}
export interface Axis {
  id: string;
  name: string;
  icon: string;
}
export interface NamedId {
  id: string;
  name: string;
}
export interface Category {
  id: string;
  name: string;
  unit: string;
}
export interface CatalogInfo {
  levels: Level[];
  axes: Axis[];
  contexts: NamedId[];
  member_types: NamedId[];
  categories: Category[];
  objective_count: number;
}

export interface Option {
  value: string;
  label: string;
  tags?: string[];
  validates?: string[];
}
export interface ShowIf {
  context_in?: ContextId[] | null;
  tags_any?: string[] | null;
  answer?: { question: string; includes: string } | null;
}
export interface Question {
  id: string;
  section: string;
  type: "single" | "multi" | "number";
  text: string;
  help: string;
  unit: string;
  show_if: ShowIf | null;
  options: Option[];
}
export type Answer = string | string[] | number | null;

export interface MemberIn {
  name: string;
  type: string;
  medical: boolean;
}
export interface Member extends MemberIn {
  id: number;
}
export interface Household {
  name: string;
  context: ContextId;
  target_context: ContextId | null;
  target_date: string | null;
  tags: string[];
  derived_tags: string[];
  priority_axes: string[];
  goal_level: number | null;
  goal_horizon_months: number | null;
  created_at: string;
  members: Member[];
}
export interface HouseholdIn {
  name: string;
  context: ContextId;
  target_context: ContextId | null;
  target_date: string | null;
  members: MemberIn[];
  tags: string[];
  priority_axes: string[];
  goal_level: number | null;
  goal_horizon_months: number | null;
}

export interface Tier {
  n: number;
  name: string;
  horizon: string;
  state: "built" | "current" | "future";
  required_total: number;
  required_done: number;
  optional_total: number;
  optional_done: number;
  cracked: boolean;
  progress: number;
}
export interface Autonomy {
  category: string;
  name: string;
  unit: string;
  need_per_day: number;
  total: number;
  days: number | null;
  days_after_expiring: number | null;
}
export type ChecklistKind = "revalidate" | "stock_expired" | "stock_expiring" | "blocking" | "optional" | "prepare";
export interface ChecklistItem {
  kind: ChecklistKind;
  title: string;
  detail: string;
  objective_id: string | null;
  objective_kind: "check" | "skill" | "stock" | null;
  stock_id: number | null;
  axis: string | null;
  level: number | null;
}
export interface Dashboard {
  household: Household;
  level: number;
  level_info: Level;
  next_level_info: Level | null;
  tiers: Tier[];
  axis_levels: { axis: string; name: string; icon: string; level: number }[];
  autonomy: Autonomy[];
  checklist: ChecklistItem[];
  counts: Partial<Record<Status, number>>;
}

export interface Objective {
  id: string;
  axis: string;
  level: number;
  title: string;
  description: string;
  why: string;
  kind: "check" | "skill" | "stock";
  required: boolean;
  contexts: ContextId[];
  requires_tags: string[];
  revalidate_days: number | null;
  stock: { category: string; min_days: number } | null;
  status: Status;
  progress: number;
  validated_at: string | null;
  expires_on: string | null;
  source: string | null;
  note: string;
}

export interface StockIn {
  name: string;
  category: string;
  quantity: number;
  unit_label: string;
  amount_per_unit: number;
  expires_on: string | null;
}
export interface StockItem extends StockIn {
  id: number;
  created_at: string;
}

export interface HistoryEvent {
  id: number;
  at: string;
  type: string;
  message: string;
}
export interface Snapshot {
  id: number;
  at: string;
  level: number;
  cause: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      message = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch {
      /* corps non JSON */
    }
    throw new ApiError(res.status, message);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  catalog: () => request<CatalogInfo>("GET", "/catalog"),
  interview: () => request<Question[]>("GET", "/interview"),
  household: () => request<Household>("GET", "/household"),
  updateHousehold: (body: HouseholdIn) => request<Household>("PUT", "/household", body),
  onboarding: (body: {
    name: string;
    context: ContextId;
    target_context: ContextId | null;
    target_date: string | null;
    members: MemberIn[];
    answers: Record<string, Answer>;
  }) => request<Dashboard>("POST", "/onboarding", body),
  reset: () => request<void>("POST", "/reset"),
  dashboard: () => request<Dashboard>("GET", "/dashboard"),
  objectives: () => request<Objective[]>("GET", "/objectives"),
  validate: (id: string) => request<unknown>("POST", `/objectives/${id}/validation`, {}),
  unvalidate: (id: string) => request<void>("DELETE", `/objectives/${id}/validation`),
  stock: () => request<StockItem[]>("GET", "/stock"),
  addStock: (body: StockIn) => request<StockItem>("POST", "/stock", body),
  updateStock: (id: number, body: StockIn) => request<StockItem>("PUT", `/stock/${id}`, body),
  deleteStock: (id: number) => request<void>("DELETE", `/stock/${id}`),
  history: () => request<{ events: HistoryEvent[]; snapshots: Snapshot[] }>("GET", "/history"),
};
