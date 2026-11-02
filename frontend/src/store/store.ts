// Journal d'opérations local (IndexedDB) et synchronisation avec le serveur du PC.
//
// Chaque modification est ajoutée au journal sur l'appareil, immédiatement visible, puis
// envoyée au serveur dès que possible. Le serveur renvoie les opérations des autres appareils.

import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import type { Op, OpType } from "../engine/replay";

interface StoredOp extends Op {
  synced: 0 | 1;
}

interface Schema extends DBSchema {
  ops: { key: string; value: StoredOp };
  meta: { key: string; value: string | number };
}

export type SyncStatus = "idle" | "syncing" | "synced" | "offline" | "no-server" | "error";

export interface SyncInfo {
  status: SyncStatus;
  pending: number;
  lastSyncAt: string | null;
  message: string | null;
}

export interface Snapshot {
  ready: boolean;
  ops: Op[];
  version: number;
  sync: SyncInfo;
}

const SYNC_DELAY_MS = 2000;
const SYNC_INTERVAL_MS = 60_000;

export function newId(): string {
  // randomUUID n'existe que dans un contexte sécurisé (https ou localhost) ; repli sinon.
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  return [...b].map((x, i) => ([4, 6, 8, 10].includes(i) ? "-" : "") + x.toString(16).padStart(2, "0")).join("");
}

export class Store {
  private db: IDBPDatabase<Schema> | null = null;
  private ops = new Map<string, StoredOp>();
  private listeners = new Set<() => void>();
  private snapshot: Snapshot;
  private device = "";
  private cursor = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private syncing: Promise<void> | null = null;
  private info: SyncInfo = { status: "idle", pending: 0, lastSyncAt: null, message: null };

  constructor(
    private readonly dbName = "shelterkwak",
    private readonly endpoint = "/api/sync",
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {
    this.snapshot = { ready: false, ops: [], version: 0, sync: this.info };
  }

  async init(): Promise<void> {
    this.db = await openDB<Schema>(this.dbName, 1, {
      upgrade(db) {
        db.createObjectStore("ops", { keyPath: "id" });
        db.createObjectStore("meta");
      },
    });
    for (const op of await this.db.getAll("ops")) this.ops.set(op.id, op);
    let device = (await this.db.get("meta", "device")) as string | undefined;
    if (!device) {
      device = newId();
      await this.db.put("meta", device, "device");
    }
    this.device = device;
    this.cursor = Number((await this.db.get("meta", "cursor")) ?? 0);
    this.info = { ...this.info, lastSyncAt: ((await this.db.get("meta", "lastSyncAt")) as string) ?? null };
    this.emit(true);
  }

  get deviceId(): string {
    return this.device;
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): Snapshot => this.snapshot;

  private emit(ready = this.snapshot.ready): void {
    const pending = [...this.ops.values()].filter((o) => !o.synced).length;
    this.info = { ...this.info, pending };
    const ops = [...this.ops.values()].map(({ synced: _synced, ...op }) => op);
    this.snapshot = { ready, ops, version: this.snapshot.version + 1, sync: this.info };
    this.listeners.forEach((fn) => fn());
  }

  private setSync(patch: Partial<SyncInfo>): void {
    this.info = { ...this.info, ...patch };
    this.snapshot = { ...this.snapshot, sync: this.info };
    this.listeners.forEach((fn) => fn());
  }

  /** Ajoute une opération créée sur cet appareil. */
  async append(type: OpType, payload: Record<string, unknown>): Promise<Op> {
    const op: StoredOp = { id: newId(), device: this.device, at: new Date().toISOString(), type, payload, synced: 0 };
    this.ops.set(op.id, op);
    await this.db?.put("ops", op);
    this.emit();
    this.scheduleSync();
    return op;
  }

  /** Fusionne des opérations venues d'ailleurs (serveur ou import). */
  async merge(ops: Op[], synced: boolean): Promise<number> {
    let added = 0;
    const tx = this.db?.transaction("ops", "readwrite");
    for (const op of ops) {
      if (this.ops.has(op.id)) continue;
      const stored: StoredOp = { ...op, synced: synced ? 1 : 0 };
      this.ops.set(op.id, stored);
      await tx?.store.put(stored);
      added++;
    }
    await tx?.done;
    if (added) this.emit();
    return added;
  }

  exportJson(): string {
    return JSON.stringify({ format: "shelterkwak-journal", version: 1, ops: this.snapshot.ops }, null, 1);
  }

  async importJson(text: string): Promise<number> {
    const data = JSON.parse(text);
    if (data?.format !== "shelterkwak-journal" || !Array.isArray(data.ops)) {
      throw new Error("Ce fichier n'est pas une sauvegarde Shelterkwak.");
    }
    const added = await this.merge(data.ops as Op[], false);
    this.scheduleSync();
    return added;
  }

  scheduleSync(delay = SYNC_DELAY_MS): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.sync(), delay);
  }

  /** Démarre la synchronisation automatique (au retour du réseau et à intervalle régulier). */
  startAutoSync(): () => void {
    const onOnline = () => this.scheduleSync(0);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void this.sync();
    }, SYNC_INTERVAL_MS);
    window.addEventListener("online", onOnline);
    void this.sync();
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
    };
  }

  async sync(): Promise<void> {
    if (this.syncing) return this.syncing;
    this.syncing = this.doSync().finally(() => {
      this.syncing = null;
    });
    return this.syncing;
  }

  private async doSync(): Promise<void> {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.setSync({ status: "offline", message: null });
      return;
    }
    const outgoing = [...this.ops.values()].filter((o) => !o.synced);
    this.setSync({ status: "syncing" });
    let res: Response;
    try {
      res = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device: this.device,
          cursor: this.cursor,
          ops: outgoing.map(({ synced: _s, ...op }) => op),
        }),
      });
    } catch {
      this.setSync({ status: "offline", message: null });
      return;
    }
    if (res.status === 404 || res.status === 405) {
      this.setSync({ status: "no-server", message: "Aucun serveur de synchronisation à cette adresse." });
      return;
    }
    if (!res.ok) {
      this.setSync({ status: "error", message: `Le serveur a refusé la synchronisation (${res.status}).` });
      return;
    }
    const data = (await res.json()) as { cursor: number; ops: Op[] };
    const tx = this.db?.transaction("ops", "readwrite");
    for (const op of outgoing) {
      const current = this.ops.get(op.id);
      if (current) {
        current.synced = 1;
        await tx?.store.put(current);
      }
    }
    await tx?.done;
    await this.merge(data.ops, true);
    this.cursor = data.cursor;
    const now = new Date().toISOString();
    await this.db?.put("meta", this.cursor, "cursor");
    await this.db?.put("meta", now, "lastSyncAt");
    this.emit();
    this.setSync({ status: "synced", lastSyncAt: now, message: null });
  }
}

export const store = new Store();
