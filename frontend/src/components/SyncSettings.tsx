// Réglages de synchronisation et de sauvegarde, partagés par l'onglet Foyer et l'accueil
// (un nouvel appareil doit pouvoir rejoindre un foyer existant avant l'interview).

import { useRef, useState } from "react";
import { useSnapshot } from "../store/hooks";
import { STANDALONE, store } from "../store/store";
import { syncLabel } from "./SyncBadge";

type Mode = "none" | "same" | "custom";

const BACKUP_REMINDER_DAYS = 30;

/** Choix du serveur de synchronisation : aucun, celui qui sert l'app, ou un autre (Tailscale). */
export function ServerSettings() {
  const { server, sync } = useSnapshot();
  const initial: Mode = server.url === null ? "none" : server.url === "" ? "same" : "custom";
  const [mode, setMode] = useState<Mode>(initial);
  const [url, setUrl] = useState(server.url || "");
  const [token, setToken] = useState(server.token);
  const [saved, setSaved] = useState(false);
  const { text } = syncLabel(sync);
  const urlOk = mode !== "custom" || /^https:\/\/[^\s/]+/.test(url.trim()) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(url.trim());

  const save = async () => {
    await store.configureServer({ url: mode === "none" ? null : mode === "same" ? "" : url, token: mode === "none" ? "" : token });
    setSaved(true);
  };

  return (
    <div className="sync-settings">
      <p>
        <strong>{text}</strong>
        {sync.message && <span className="hint"> : {sync.message}</span>}
      </p>
      <fieldset className="sync-modes">
        <legend>Serveur de synchronisation</legend>
        <label className="check-line">
          <input type="radio" name="sync-mode" checked={mode === "none"} onChange={() => { setMode("none"); setSaved(false); }} />
          <span>Aucun : les données restent sur cet appareil (pense aux sauvegardes)</span>
        </label>
        {!STANDALONE && (
          <label className="check-line">
            <input type="radio" name="sync-mode" checked={mode === "same"} onChange={() => { setMode("same"); setSaved(false); }} />
            <span>Le serveur qui sert l'application</span>
          </label>
        )}
        <label className="check-line">
          <input type="radio" name="sync-mode" checked={mode === "custom"} onChange={() => { setMode("custom"); setSaved(false); }} />
          <span>Un autre serveur, par exemple ton PC derrière Tailscale</span>
        </label>
      </fieldset>
      {mode === "custom" && (
        <label className="field grow">
          Adresse du serveur
          <input
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://mon-pc.mon-tailnet.ts.net"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setSaved(false); }}
          />
        </label>
      )}
      {mode !== "none" && (
        <label className="field grow">
          Jeton (si le serveur en demande un)
          <input type="password" autoComplete="off" value={token} onChange={(e) => { setToken(e.target.value); setSaved(false); }} />
        </label>
      )}
      {mode === "custom" && !urlOk && <p className="hint warn-text">L'adresse doit commencer par https:// (Tailscale en fournit une avec « tailscale serve »).</p>}
      <div className="actions start">
        <button className="primary" disabled={!urlOk} onClick={() => void save()}>
          Enregistrer et synchroniser
        </button>
        {saved && <span className="hint">Réglage enregistré.</span>}
      </div>
    </div>
  );
}

/** Sauvegarde du journal dans un fichier et import, avec un rappel quand la dernière date. */
export function BackupActions() {
  const { ops, server, lastExportAt } = useSnapshot();
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const age = lastExportAt ? Math.floor((Date.now() - new Date(lastExportAt).getTime()) / 86_400_000) : null;
  const remind = server.url === null && ops.length > 0 && (age === null || age >= BACKUP_REMINDER_DAYS);

  const prepare = () => {
    if (exportUrl) URL.revokeObjectURL(exportUrl);
    setExportUrl(URL.createObjectURL(new Blob([store.exportJson()], { type: "application/json" })));
    void store.markExported();
  };
  const importFile = async (file: File) => {
    try {
      const added = await store.importJson(await file.text());
      setMsg(`${added} opération(s) importée(s).`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <div className="backup-actions">
      <p className={`hint${remind ? " warn-text" : ""}`}>
        Dernière sauvegarde sur cet appareil : {lastExportAt ? new Date(lastExportAt).toLocaleDateString("fr-FR") : "jamais"}.
        {remind && " Sans serveur, ce fichier est la seule copie de tes données hors de ce navigateur : télécharge-en une."}
      </p>
      <div className="actions start">
        <button onClick={prepare}>Préparer une sauvegarde</button>
        {exportUrl && (
          <a className="button-link" href={exportUrl} download={`shelterkwak-${new Date().toISOString().slice(0, 10)}.json`}>
            Télécharger la sauvegarde
          </a>
        )}
        <button onClick={() => fileInput.current?.click()}>Importer une sauvegarde</button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
            e.target.value = "";
          }}
        />
      </div>
      {msg && <p className="hint">{msg}</p>}
    </div>
  );
}
