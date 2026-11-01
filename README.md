# Pied-de-Biche

> Voir sous la surface avant d'acheter.

Estimateur de rentabilité **à la visite** pour l'achat-revente de biens à rénover : saisie du bien et de l'état des pièces sur mobile, estimation des travaux en trois fourchettes, marge brute et nette, fiche PDF A4.

Le cahier des charges complet est dans [`PROJET.md`](PROJET.md).

## Principes

- **Zéro dépendance** : HTML, CSS et JavaScript natifs (modules ES), aucun build. Le dépôt est servi tel quel par GitHub Pages.
- **Hors ligne** : PWA installable, service worker *cache-first* versionné.
- **Données locales** : tout reste sur le téléphone (IndexedDB). Exporter régulièrement.
- **Périmètre v1** : régime **résidence principale (RP)** uniquement. Le régime marchand de biens viendra plus tard.

## Lancer en local

```sh
npm run serve        # ou : python3 -m http.server 8000
# puis ouvrir http://localhost:8000/
```

Le service worker exige `localhost` ou HTTPS.

## Tests

```sh
npm test             # node --test, aucune installation nécessaire (Node ≥ 22)
```

Les tests vérifient le routeur, et que chaque fichier de l'app est bien mis en cache pour le hors-ligne, sans aucune URL vers un domaine tiers.

## Publier une nouvelle version

1. Incrémenter la version **dans les deux fichiers** : `js/version.js` (`APP_VERSION`) et `sw.js` (`VERSION`). Un test vérifie qu'elles sont identiques.
2. Tout nouveau fichier de l'app doit être ajouté à la liste `ASSETS` de `sw.js` (un test échoue sinon).
3. Fusionner sur la branche publiée : GitHub Pages met le site à jour, et les téléphones affichent « Nouvelle version disponible ».

## Icônes

Les PNG de `assets/icons/` sont générés depuis les SVG avec `node tools/icons.mjs` (outil de développement, nécessite Playwright ; non requis pour l'app).

## Structure

```
index.html, manifest.webmanifest, sw.js
assets/   logo, favicon, icônes PWA
css/      tokens.css (thèmes clair/sombre), app.css, print.css
js/       app.js (démarrage), router.js, version.js
js/ui/    un module par écran + utilitaires DOM
js/calc/  moteur de calcul (jalon J2)
js/data/  IndexedDB, schéma, migrations, import/export (jalon J4)
tests/    node --test
```
