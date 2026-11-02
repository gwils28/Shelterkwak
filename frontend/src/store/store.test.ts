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
