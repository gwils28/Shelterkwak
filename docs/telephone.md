# Installer Shelterkwak sur un téléphone Android

L'application s'installe sur le téléphone comme une app (PWA) et fonctionne **sans réseau** :
le moteur, le catalogue et tes données vivent sur le téléphone. Le serveur du PC sert à
l'installer, à **synchroniser** le téléphone et le PC, et de **sauvegarde**.

Pour qu'Android accepte l'installation et le stockage hors ligne, l'adresse doit être en HTTPS.
[Tailscale](https://tailscale.com) donne au PC une adresse HTTPS privée, joignable depuis le
téléphone à la maison comme dehors, sans rien ouvrir sur Internet.

## 1. Une fois, sur le PC

1. Installer Tailscale et se connecter.
2. Dans la console d'administration Tailscale, onglet **DNS** : activer **MagicDNS** et
   **HTTPS Certificates**.
3. Lancer Shelterkwak puis le publier sur le réseau privé :

```bash
make run
```

```bash
tailscale serve --bg 8000
```

`tailscale serve status` affiche l'adresse, de la forme `https://<nom-du-pc>.<tailnet>.ts.net`.
`serve` (et non `funnel`) la réserve aux appareils de ton compte Tailscale.

## 2. Une fois, sur le téléphone

1. Installer l'app Tailscale (Play Store) et se connecter avec le même compte.
2. Ouvrir l'adresse du PC dans **Chrome**.
3. Menu ⋮ → **Installer l'application** (ou « Ajouter à l'écran d'accueil »).

L'icône de la colonne apparaît sur l'écran d'accueil. L'app demande à Android de conserver
ses données (stockage persistant).

## Au quotidien

- **Sans réseau** (mode avion, PC éteint, Tailscale coupé) : tout fonctionne ; le badge en haut
  indique « Hors ligne · N modif. en attente ».
- **Dès que le PC est joignable** : la synchronisation est automatique (au démarrage, au retour
  du réseau, 2 s après chaque modification, puis chaque minute). Toucher le badge la force.
- **Sur le PC**, ouvre la même adresse (ou http://127.0.0.1:8000) : le navigateur du PC est un
  appareil comme un autre, synchronisé avec le téléphone.
- **Conflits** : si le même élément est modifié sur deux appareils, la modification la plus
  récente l'emporte.
- **Sauvegarde sans PC** : onglet Foyer → « Préparer une sauvegarde » télécharge le journal en
  JSON ; « Importer une sauvegarde » le fusionne sur un autre appareil, sans doublon.

## Mises à jour

Après un `git pull`, relancer `make run` : le téléphone récupère la nouvelle version à la
prochaine ouverture avec le réseau, sans perdre ses données.
