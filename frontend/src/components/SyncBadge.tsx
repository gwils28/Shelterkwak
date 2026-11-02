import type { SyncInfo } from "../store/store";
import { store } from "../store/store";

function ago(iso: string | null): string {
  if (!iso) return "jamais";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `il y a ${h} h` : `il y a ${Math.round(h / 24)} j`;
}

export function syncLabel(s: SyncInfo): { text: string; tone: "ok" | "warn" | "muted" } {
  const pending = s.pending > 0 ? ` · ${s.pending} modif. en attente` : "";
  switch (s.status) {
    case "syncing":
      return { text: "Synchronisation…", tone: "muted" };
    case "synced":
      return { text: `Synchronisé ${ago(s.lastSyncAt)}${pending}`, tone: s.pending ? "warn" : "ok" };
    case "offline":
      return { text: `Hors ligne${pending}`, tone: s.pending ? "warn" : "muted" };
    case "no-server":
      return { text: `Sans serveur${pending}`, tone: "muted" };
    case "error":
      return { text: `Erreur de synchro${pending}`, tone: "warn" };
    default:
      return { text: s.lastSyncAt ? `Synchronisé ${ago(s.lastSyncAt)}${pending}` : `Pas encore synchronisé${pending}`, tone: "muted" };
  }
}

export function SyncBadge({ sync }: { sync: SyncInfo }) {
  const { text, tone } = syncLabel(sync);
  return (
    <button className={`sync-badge ${tone}`} onClick={() => void store.sync()} title={sync.message ?? "Synchroniser maintenant"}>
      <span className="dot" aria-hidden />
      {text}
    </button>
  );
}
