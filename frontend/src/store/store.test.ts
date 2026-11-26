import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import type { Op } from "../engine/replay";
import { Store } from "./store";

/** Serveur en mémoire qui suit le protocole de POST /api/sync. */
function fakeServer() {
  const log: Op[] = [];
  let online = true;
  const handler = async (_url: unknown, init?: RequestInit): Promise<Response> => {
    if (!online) throw new TypeError("Failed to fetch");
    const body = JSON.parse(String(init?.body));
    for (const op of body.ops as Op[]) if (!log.some((o) => o.id === op.id)) log.push(op);
    const after = log.slice(body.cursor);
    return new Response(JSON.stringify({ cursor: log.length, ops: after.filter((o) => o.device !== body.device) }), {
      status: 200,
    });
  };
  return { log, handler: handler as typeof fetch, setOnline: (v: boolean) => (online = v) };
}

let n = 0;
async function device(server: ReturnType<typeof fakeServer>) {
  const s = new Store(`test-${n++}`, "/api/sync", server.handler);
  await s.init();
  return s;
}

describe("store et synchronisation", () => {
  it("garde le journal entre deux ouvertures", async () => {
    const server = fakeServer();
    const name = `persist-${n++}`;
    const a = new Store(name, "/api/sync", server.handler);
    await a.init();
    await a.append("reset", {});
    const b = new Store(name, "/api/sync", server.handler);
    await b.init();
    expect(b.getSnapshot().ops).toHaveLength(1);
    expect(b.deviceId).toBe(a.deviceId);
  });

  it("fait converger deux appareils, y compris après une période hors ligne", async () => {
    const server = fakeServer();
    let phoneOnline = true;
    const phone = new Store(`phone-${n++}`, "/api/sync", (async (url: unknown, init?: RequestInit) => {
      if (!phoneOnline) throw new TypeError("Failed to fetch");
      return server.handler(url as string, init);
    }) as typeof fetch);
    await phone.init();
    const pc = await device(server);

    await phone.append("stock.upsert", { id: "s1", name: "Eau", category: "eau", quantity: 6, unit_label: "L", amount_per_unit: 1, expires_on: null });
    await phone.sync();
    expect(phone.getSnapshot().sync).toMatchObject({ status: "synced", pending: 0 });

    phoneOnline = false;
    await phone.append("stock.delete", { id: "s1" });
    await phone.sync();
    expect(phone.getSnapshot().sync).toMatchObject({ status: "offline", pending: 1 });

    await pc.sync();
    expect(pc.getSnapshot().ops.map((o) => o.type)).toEqual(["stock.upsert"]);

    phoneOnline = true;
    await pc.append("validation.set", { objective_id: "eau.pastilles", validated_at: "2026-11-02", note: "", source: "manual" });
    await phone.sync();
    await pc.sync();
    await phone.sync(); // récupère l'opération que le PC vient d'envoyer
    const ids = (s: Store) => s.getSnapshot().ops.map((o) => o.id).sort();
    expect(ids(phone)).toEqual(ids(pc));
    expect(server.log).toHaveLength(3);
  });

  it("signale l'absence de serveur", async () => {
    const s = new Store(`noserver-${n++}`, "/api/sync", (async () => new Response("", { status: 404 })) as typeof fetch);
    await s.init();
    await s.sync();
    expect(s.getSnapshot().sync.status).toBe("no-server");
  });

  it("n'appelle aucun serveur quand il n'y en a pas, et garde le réglage", async () => {
    const calls: string[] = [];
    const name = `local-${n++}`;
    const s = new Store(name, "/api/sync", (async (url: unknown) => {
      calls.push(String(url));
      return new Response("", { status: 500 });
    }) as typeof fetch);
    await s.init();
    await s.configureServer({ url: null, token: "" });
    await s.append("reset", {});
    await s.sync();
    expect(calls).toEqual([]);
    expect(s.getSnapshot().sync).toMatchObject({ status: "no-server", pending: 1 });
    const again = new Store(name, "/api/sync", (async () => new Response("", { status: 500 })) as typeof fetch);
    await again.init();
    expect(again.getSnapshot().server).toEqual({ url: null, token: "" });
  });

  it("envoie le jeton au serveur configuré et renvoie tout le journal en changeant de serveur", async () => {
    const first = fakeServer();
    const second = fakeServer();
    const seen: { url: string; auth: string | null }[] = [];
    const s = new Store(`remote-${n++}`, "/api/sync", (async (url: unknown, init?: RequestInit) => {
      const auth = new Headers(init?.headers).get("Authorization");
      seen.push({ url: String(url), auth });
      return (String(url).startsWith("https://deux") ? second : first).handler(url as string, init);
    }) as typeof fetch);
    await s.init();
    await s.append("reset", {});
    await s.configureServer({ url: "https://un.example.ts.net/", token: " secret " });
    expect(seen.at(-1)).toEqual({ url: "https://un.example.ts.net/api/sync", auth: "Bearer secret" });
    expect(first.log).toHaveLength(1);
    await s.configureServer({ url: "https://deux.example.ts.net", token: "" });
    expect(seen.at(-1)).toEqual({ url: "https://deux.example.ts.net/api/sync", auth: null });
    expect(second.log).toHaveLength(1); // le journal déjà envoyé au premier serveur part aussi au second
    expect(s.getSnapshot().sync).toMatchObject({ status: "synced", pending: 0 });
  });

  it("signale un jeton refusé", async () => {
    const s = new Store(`token-${n++}`, "/api/sync", (async () => new Response("", { status: 401 })) as typeof fetch);
    await s.init();
    await s.sync();
    expect(s.getSnapshot().sync).toMatchObject({ status: "error", message: expect.stringContaining("Jeton") });
  });

  it("envoie un gros journal en plusieurs fois", async () => {
    const server = fakeServer();
    let requests = 0;
    const s = new Store(`big-${n++}`, "/api/sync", (async (url: unknown, init?: RequestInit) => {
      requests++;
      return server.handler(url as string, init);
    }) as typeof fetch);
    await s.init();
    const ops = Array.from({ length: 2500 }, (_, i) => ({ id: `op-${i}`, device: "autre", at: "2026-11-02T10:00:00.000Z", type: "reset" as const, payload: {} }));
    await s.merge(ops, false);
    for (let i = 0; i < 3; i++) await s.sync();
    expect(requests).toBe(3);
    expect(server.log).toHaveLength(2500);
    expect(s.getSnapshot().sync.pending).toBe(0);
  });

  it("retient la date de la dernière sauvegarde", async () => {
    const name = `export-${n++}`;
    const s = new Store(name, "/api/sync", fakeServer().handler);
    await s.init();
    expect(s.getSnapshot().lastExportAt).toBeNull();
    await s.markExported("2026-11-26T10:00:00.000Z");
    const again = new Store(name, "/api/sync", fakeServer().handler);
    await again.init();
    expect(again.getSnapshot().lastExportAt).toBe("2026-11-26T10:00:00.000Z");
  });

  it("exporte et réimporte le journal sans doublon", async () => {
    const server = fakeServer();
    const a = await device(server);
    await a.append("reset", {});
    const b = await device(server);
    expect(await b.importJson(a.exportJson())).toBe(1);
    expect(await b.importJson(a.exportJson())).toBe(0);
    await expect(b.importJson("{}")).rejects.toThrow("sauvegarde");
  });
});
