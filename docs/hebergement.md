# Héberger Shelterkwak : front sur GitHub Pages, données chez soi

Deux façons d'utiliser l'application, cumulables :

| | Adresse | Données | Synchronisation |
|---|---|---|---|
| **Serveur maison** | `https://<pc>.<tailnet>.ts.net` (Tailscale) | sur chaque appareil et sur le PC | automatique avec le PC |
| **GitHub Pages** | https://gwils28.github.io/Shelterkwak/ | sur chaque appareil | aucune par défaut, ou avec un serveur indiqué dans l'onglet Foyer |

GitHub Pages ne sert que l'application (fichiers statiques, gratuit). Il ne reçoit aucune donnée :
le journal reste dans le navigateur, et ne part que vers le serveur choisi dans l'onglet Foyer.

## 1. Publier le front (une fois)

1. Sur GitHub : **Settings → Pages → Build and deployment → Source : GitHub Actions**.
2. Chaque push sur `main` qui touche `frontend/` ou `catalog/` republie l'application
   (`.github/workflows/pages.yml` : tests, build avec `VITE_BASE=/Shelterkwak/` et
   `VITE_STANDALONE=1`). L'onglet **Actions** permet aussi de la relancer à la main.

Cette version démarre **sans serveur** : un foyer qui la découvre garde tout sur son appareil et
fait ses sauvegardes depuis l'onglet Foyer (rappel au bout de 30 jours).

## 2. Synchroniser la version GitHub Pages avec le PC du foyer

Sur le PC, lancer le serveur en autorisant l'origine GitHub Pages et en fixant un jeton :

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(24))"   # génère un jeton, à garder
```

```bash
SHELTERKWAK_CORS_ORIGINS=https://gwils28.github.io SHELTERKWAK_TOKEN=<jeton> make run
```

```bash
tailscale serve --bg 8000
```

Sur chaque appareil (Tailscale actif) :

1. Ouvrir https://gwils28.github.io/Shelterkwak/ et installer l'application.
2. Nouvel appareil : sur le premier écran, « Ton foyer existe déjà sur un autre appareil ? ».
   Appareil déjà utilisé : onglet **Foyer → Synchronisation et sauvegarde**.
3. Choisir « Un autre serveur », saisir `https://<pc>.<tailnet>.ts.net` et le jeton, puis
   **Enregistrer et synchroniser**. Le foyer arrive avec son journal.

Le navigateur peut demander l'autorisation d'accéder aux appareils du réseau local : l'accepter
(la page publique parle à une adresse Tailscale privée).

## Bon à savoir

- **Le jeton** est facultatif. Sans `SHELTERKWAK_TOKEN`, le serveur accepte tout appel, comme
  avant ; c'est acceptable tant qu'il n'est joignable que par Tailscale (`serve`, jamais `funnel`).
  Avec un jeton, chaque appareil doit le saisir une fois, y compris celui qui ouvre l'app servie
  par le PC.
- **Deux adresses, deux copies** : l'app installée depuis le PC et celle installée depuis
  GitHub Pages ont chacune leur stockage. Elles ne partagent leurs données qu'à travers le serveur.
- **Changer de serveur** renvoie tout le journal au nouveau serveur, qui ignore ce qu'il connaît déjà.
- **Sans serveur**, vider les données du navigateur efface le foyer : la sauvegarde JSON est
  alors la seule copie. Installer l'application sur l'écran d'accueil limite les effacements
  automatiques (Safari sur iPhone efface les sites peu utilisés qui ne sont pas installés).
- **Pas de comptes** : le serveur garde un seul foyer. Un autre foyer qui veut se synchroniser
  héberge son propre serveur (ce dépôt) et l'indique dans son application.
