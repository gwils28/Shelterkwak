// Modes opératoires de partage, dans l'onglet Foyer : faire rejoindre le foyer à un proche,
// et faire essayer l'application à un autre foyer. Rien de propre au foyer n'est écrit dans le
// code (l'app est publiée sur GitHub Pages) : l'adresse du serveur est lue sur l'appareil, le
// jeton n'est jamais affiché.

import { useState } from "react";
import { useSnapshot } from "../store/hooks";

/** Version publique, sans serveur : celle qu'on envoie à un autre foyer. */
export const PUBLIC_URL = "https://gwils28.github.io/Shelterkwak/";

const INVITATION = `Je te fais essayer Shelterkwak, une app pour préparer son foyer aux crises (coupures, intempéries, évacuation...). Elle marche hors ligne et tes données restent sur ton téléphone.

1. Ouvre ${PUBLIC_URL}
2. Installe-la : sur Android, menu ⋮ puis « Installer l'application » ; sur iPhone, bouton Partager puis « Sur l'écran d'accueil ».
3. Ouvre-la depuis l'icône et fais l'interview (ne touche pas à « Ton foyer existe déjà »).
4. Une fois par mois : onglet Foyer, « Préparer une sauvegarde », puis garde le fichier. C'est la seule copie de tes données hors du téléphone.`;

function isLocal(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?/.test(url);
}

function CopyButton({ text, label = "Copier" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      // presse-papiers refusé (http hors localhost) : le texte reste sélectionnable à l'écran
    }
  };
  return (
    <button type="button" onClick={() => void copy()}>
      {done ? "Copié ✓" : label}
    </button>
  );
}

export function ShareGuide() {
  const { server } = useSnapshot();
  const address = server.url === null ? null : server.url || window.location.origin;
  const canShare = typeof navigator.share === "function";

  return (
    <div className="share-guide">
      <details>
        <summary>👥 Ajouter un membre du foyer sur son téléphone</summary>
        {address === null ? (
          <>
            <p className="hint">
              Cet appareil n'a pas de serveur : pas de synchronisation automatique. Pour retrouver le foyer sur un autre
              téléphone, passe par une sauvegarde.
            </p>
            <ol>
              <li>Ici : « Préparer une sauvegarde » puis « Télécharger la sauvegarde », et envoie-toi le fichier.</li>
              <li>
                Sur l'autre téléphone : ouvre <a href={PUBLIC_URL}>{PUBLIC_URL}</a>, installe l'app, puis sur le premier écran
                « Ton foyer existe déjà sur un autre appareil ? » et « Importer une sauvegarde ».
              </li>
              <li>Les deux téléphones vivent ensuite chacun leur vie : refais l'échange quand il faut les remettre d'accord.</li>
            </ol>
            <p className="hint">Pour une synchronisation automatique, il faut un serveur : voir docs/hebergement.md dans le dépôt.</p>
          </>
        ) : (
          <>
            <p className="hint">
              Il utilise le même serveur que cet appareil : il lui faut l'accès au réseau Tailscale et le jeton.
            </p>
            <ol>
              <li>
                <strong>Celui qui gère le serveur</strong> l'invite sur Tailscale : console d'administration, onglet Users,
                « Invite users » (ou onglet Machines, le PC, « Share » pour ne partager que lui).
              </li>
              <li>Sur son téléphone : installer l'app Tailscale, accepter l'invitation, se connecter.</li>
              <li>
                Tailscale activé, ouvrir dans Chrome l'adresse du serveur :
                <span className="share-address">
                  <code>{address}</code> <CopyButton text={address} />
                </span>
                {isLocal(address) && (
                  <span className="hint warn-text">
                    {" "}
                    Cette adresse n'existe que sur ce PC : donne plutôt son adresse Tailscale (commande « tailscale serve status »).
                  </span>
                )}
              </li>
              <li>Menu ⋮ puis « Installer l'application ».</li>
              <li>
                Ouvrir l'app, toucher « Ton foyer existe déjà sur un autre appareil ? », garder « Le serveur qui sert
                l'application », saisir le jeton, puis « Enregistrer et synchroniser ». <strong>Ne pas faire l'interview</strong> :
                elle créerait un autre foyer.
              </li>
            </ol>
            <p className="hint">
              Le jeton se transmet de vive voix ou par un gestionnaire de mots de passe, pas par SMS. Si deux personnes modifient le
              même élément, la modification la plus récente l'emporte. La synchronisation se fait quand le serveur est allumé et
              Tailscale actif ; sinon les modifications attendent.
            </p>
          </>
        )}
      </details>

      <details>
        <summary>🏡 Faire essayer l'application à un autre foyer</summary>
        <p className="hint">
          Il utilise la version publique, sans serveur : ses données restent sur son téléphone, rien ne passe par ton serveur.
          Ne lui donne ni ton adresse de serveur ni ton jeton.
        </p>
        <ol>
          <li>
            Envoie-lui le lien <a href={PUBLIC_URL}>{PUBLIC_URL}</a> et les étapes, déjà rédigées ci-dessous.
          </li>
          <li>Il installe l'app (Android : menu ⋮, « Installer l'application » ; iPhone : Partager, « Sur l'écran d'accueil »).</li>
          <li>Il fait l'interview depuis l'icône, sans toucher à « Ton foyer existe déjà ».</li>
          <li>Il fait une sauvegarde par mois depuis son onglet Foyer (l'app le lui rappelle au bout de 30 jours).</li>
        </ol>
        <div className="actions start">
          {canShare && (
            <button type="button" className="primary" onClick={() => void navigator.share({ title: "Shelterkwak", text: INVITATION }).catch(() => {})}>
              Envoyer l'invitation
            </button>
          )}
          <CopyButton text={INVITATION} label="Copier le message" />
        </div>
        <p className="hint">
          Plusieurs téléphones dans son foyer : il passe d'un téléphone à l'autre par une sauvegarde (export puis import), ou
          héberge son propre serveur (docs/hebergement.md). L'app n'a pas encore été essayée sur iPhone.
        </p>
      </details>
    </div>
  );
}
