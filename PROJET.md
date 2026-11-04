# Pied-de-Biche — Estimateur de rentabilité à la visite

> **Ce document est le cahier des charges du projet. Il s'adresse à Claude Code.**
> Lis-le entièrement avant d'écrire du code, puis propose un plan de mise en œuvre par jalons (§12) avant de commencer.

---

## 0. Consignes pour Claude Code

- **Langue :** interface, textes et commentaires de code métier en **français**.
- **Design :** utilise les **skills de design à ta disposition** (par exemple `frontend-design`) avant de concevoir l'interface. Le rendu doit être professionnel, sobre et pensé pour le terrain, pas un template générique.
- **Zéro dépendance externe :**
  - pas de framework, pas de CDN, pas de police distante, pas de bibliothèque PDF ;
  - HTML, CSS et JavaScript natifs uniquement (modules ES) ;
  - **aucune étape de build obligatoire** : le dépôt est servi tel quel par GitHub Pages.
- **Auto-portante :** l'app doit fonctionner **hors ligne** après le premier chargement (PWA installable sur l'écran d'accueil du téléphone).
- **Évolutivité :** c'est un outil métier qui va grandir. Sépare strictement le moteur de calcul, les données et l'interface (§9). Versionne le schéma de données dès la v1.
- **Qualité :** le moteur de calcul est couvert par des tests unitaires (runner natif `node --test`, sans dépendance).
- Pose des questions si un point de ce document est ambigu ou contradictoire.

---

## 1. Contexte et objectif

Deux associés préparent une activité d'**achat-revente de biens à rénover**, avec les travaux réalisés par eux-mêmes. Pendant une visite, ils doivent pouvoir estimer **en quelques minutes, sur mobile**, si un bien peut être rentable.

L'app permet de :
1. saisir les informations du bien et l'état de chaque pièce pendant la visite ;
2. obtenir une **estimation des travaux en fourchette basse, moyenne et haute**, basée sur une grille de prix standard et modifiable ;
3. calculer la **marge brute et la marge nette** selon le cadre fiscal choisi ;
4. **enregistrer** l'estimation sur le téléphone, la retrouver, l'exporter et l'importer ;
5. produire une **fiche PDF d'une page A4**, propre et imprimable, pour la partager.

**Utilisateurs :** les deux associés, sur smartphone (Android et iOS), parfois dans un bien sans réseau.

---

## 2. Identité : nom et logo

**Nom : « Pied-de-Biche »** (nom court PWA : `Pied-de-Biche`).
- C'est l'outil qu'on sort pour ouvrir, démonter, regarder sous la surface, comme l'app le fait avec un bien.
- Accroche : *« Voir sous la surface avant d'acheter. »*
- Alternatives si besoin : « Marge & Murs », « Estim'Brique ».

**Logo (à dessiner en SVG) :**
- Un pied-de-biche stylisé, dont l'extrémité recourbée forme le **toit d'une petite maison**.
- Un discret **symbole €** ou une flèche montante dans la maison.
- Trait épais et géométrique, lisible à 32 px.
- Palette suggérée : **orange brique** (accent) et **bleu ardoise** (base). Elle reste à affiner avec le skill de design.
- Livrables :
  - `favicon.svg` ;
  - icônes PWA 192 px et 512 px, dont une version **maskable** ;
  - `apple-touch-icon` 180 px.

---

## 3. Contraintes techniques

| Sujet | Exigence |
|---|---|
| Hébergement | GitHub Pages, chemins **relatifs** uniquement (le site est servi depuis `/<repo>/`) |
| Stack | HTML + CSS + JS natif (modules ES), sans build |
| Hors ligne | Service worker (cache des assets, stratégie *cache-first* versionnée) + `manifest.webmanifest` |
| Stockage | **IndexedDB** pour les estimations et les photos (localStorage est trop limité pour les photos) |
| Sécurité | CSP en balise meta : `default-src 'self'; img-src 'self' data: blob:` ; aucun appel réseau tiers |
| Compatibilité | Chrome Android et Safari iOS récents ; desktop en bonus |
| Formatage | `Intl.NumberFormat('fr-FR')` pour les montants (€) et les surfaces (m²) |
| Accessibilité | Zones tactiles ≥ 44 px, contrastes AA, libellés sur tous les champs, mode sombre |

---

## 4. Parcours utilisateur

Navigation par **étapes** (onglets ou stepper), avec saisie libre dans n'importe quel ordre et **sauvegarde automatique**.

1. **Accueil** : liste des estimations (photo, adresse, date, marge centrale, pastille de couleur), bouton « Nouvelle estimation », recherche et tri.
2. **Le bien** : informations générales.
3. **Pièces** : liste dynamique des pièces avec leur état.
4. **Gros postes** : travaux globaux (toiture, électricité, chauffage…).
5. **Financement & revente** : plan de financement, portage, prix de revente.
6. **Synthèse** : résultats en 3 scénarios, indicateurs, export PDF.

**Bandeau permanent** en bas d'écran, visible à toutes les étapes : marge nette du scénario central et pourcentage, mis à jour en direct, avec code couleur par rapport à l'objectif.

**Saisie terrain :** gros champs, claviers numériques (`inputmode="decimal"`), valeurs par défaut intelligentes, boutons de choix plutôt que listes déroulantes quand c'est possible.

---

## 5. Données saisies

### 5.1 Le bien
- Adresse, commune, type (maison, appartement, immeuble), année de construction approximative.
- Surface habitable, surface de terrain, nombre de pièces, nombre de niveaux.
- DPE (A à G, ou inconnu).
- Source (agence, notaire / succession, particulier, autre) et contact.
- Prix affiché et **prix d'achat visé** (négocié).
- **Cadre fiscal de l'estimation : `RP` (résidence principale en nom propre) ou `MDB` (société marchand de biens).** Ce choix pilote les frais d'acquisition et la fiscalité (§7).
- Notes libres et photos (§6).

### 5.2 Pièces (liste dynamique)
Pour chaque pièce :
- Nom et type : séjour, chambre, cuisine, salle de bain, WC, entrée / couloir, cellier, garage, combles, autre.
- Surface en m².
- **État**, sur 4 niveaux :
  - **Bon** : rien à faire ;
  - **À rafraîchir** : peinture, petits travaux ;
  - **À rénover** : sols, murs, plafonds, reprises ;
  - **À refaire entièrement** : tout, hors structure.
- Pour la cuisine et la salle de bain : forfait d'équipement (aucun, partiel, complet).
- Mode de réalisation : **« Nous-mêmes »** (matériaux seuls) ou **« Artisan »** (fourni-posé).
- Photo(s) et note.

### 5.3 Gros postes (globaux au bien)
Chaque poste a les champs suivants : case « à prévoir », quantité (m², unités ou forfait), mode « Nous-mêmes » / « Artisan », et **un indicateur « structurel »** (qui déclenche la dommages-ouvrage, §7).

Postes concernés : toiture, façade / ravalement, isolation des combles, isolation des murs (ITE ou ITI), menuiseries (par fenêtre), électricité complète, plomberie complète, chauffage (PAC air-eau, chaudière gaz, poêle, radiateurs électriques), VMC, assainissement, ouverture de mur porteur ou IPN, démolition et évacuation, divers.

---

## 6. Photos

- Capture via `<input type="file" accept="image/*" capture="environment">`, avec possibilité d'en ajouter plusieurs.
- **Compression côté client** via canvas (côté long de 1600 px environ, JPEG de qualité 0,7 environ) avant stockage dans IndexedDB.
- Génération d'une miniature pour les listes.
- Rattachement d'une photo au bien ou à une pièce, avec légende facultative.
- Possibilité de choisir les photos à inclure dans le PDF (4 au maximum par défaut).

---

## 7. Moteur de calcul

Le moteur est fait de **fonctions pures** (sans DOM), dans `js/calc/`. Il prend en entrée une estimation et des réglages, et renvoie un objet de résultats. Chaque formule est testée.

### 7.1 Travaux
- **Pièce :** `surface × prix_m²[type d'état][bas | moyen | haut]` + forfaits éventuels (équipement de cuisine ou de salle de bain).
- **Gros poste :** `quantité × prix unitaire[bas | moyen | haut]`.
- **Mode « Nous-mêmes » :** on applique le **coefficient matériaux** des réglages (par défaut 40 % du prix artisan), configurable par catégorie.
- **Aléas :** en pourcentage du total (par défaut 15 %).
- **Temps de travail estimé** en heures (facultatif), pour calculer la rémunération horaire implicite.

### 7.2 Coût de revient

```
Coût de revient =
    prix d'achat
  + frais d'acquisition   (RP : ~7,5 % par défaut · MDB : ~2,5 % par défaut, droits réduits ~0,7 % + émoluments)
  + frais d'agence acquéreur (si applicables)
  + travaux (+ aléas)
  + dommages-ouvrage      (% des travaux, si au moins un poste est structurel ; activable dans les 2 régimes)
  + coût du financement   (intérêts sur la durée de portage, frais de dossier et de garantie, assurance emprunteur)
  + portage               (taxe foncière au prorata, assurance PNO ou habitation, énergie et abonnements, charges de copropriété) × durée
```

**Financement :** saisie de l'apport, du montant emprunté, du taux, de la durée de portage en mois et des frais. Calcul simplifié des intérêts sur la durée de portage. En RP, ajout des **indemnités de remboursement anticipé** (plafonnées légalement à 6 mois d'intérêts et 3 % du capital restant dû).

### 7.3 Revente
- Prix de revente : **saisi directement**, ou calculé à partir d'un `prix au m² du secteur × surface`.
- Frais de vente : agence (%), diagnostics, déménagement en RP.

### 7.4 Marges

```
Marge brute = prix de revente − frais de vente − coût de revient
```

**Marge nette selon le régime :**
- **RP :** la plus-value est **exonérée**, sous condition de résidence principale effective. Marge nette = marge brute. Affiche un rappel discret : *« Exonération conditionnée à une résidence principale réelle »*.
- **MDB :** on applique l'**IS** à la marge brute (15 % jusqu'à 42 500 €, puis 25 %, seuils modifiables dans les réglages). Marge nette = marge brute − IS. En information secondaire, affiche le net après une éventuelle distribution (flat tax de 30 %).

### 7.5 Indicateurs de la synthèse
- Marge brute et marge nette, en € et en **% du coût de revient** (objectif réglable, par défaut 20 %).
- Marge nette en % du prix de revente.
- Rendement sur apport, et rendement annualisé selon la durée totale de l'opération.
- **Prix d'achat maximum** pour atteindre la marge cible. C'est un calcul inverse, très utile en négociation.
- Rémunération horaire implicite (marge nette divisée par les heures estimées), si les heures sont renseignées.
- Pastille de couleur :
  - **vert** : au moins à l'objectif ;
  - **orange** : entre 10 % et l'objectif ;
  - **rouge** : sous 10 % (seuils réglables).

### 7.6 Trois scénarios

| | Optimiste | Central | Pessimiste |
|---|---|---|---|
| Travaux | Fourchette basse | Fourchette moyenne | Fourchette haute |
| Prix de revente | Saisi | Saisi | Saisi − 5 % (réglable) |
| Durée de portage | Saisie | Saisie | Saisie + 3 mois (réglable) |

---

## 8. Grille de prix par défaut (modifiable)

> Valeurs **indicatives** en € TTC, fourni-posé par un artisan, ordre de grandeur France 2025-2026. **Elles sont à recalibrer** avec nos devis réels et nos RETEX. Elles doivent vivre dans `js/calc/defaults.js` (ou un JSON), être éditables depuis l'écran **Réglages**, exportables et importables, et **chaque estimation garde une copie de la grille utilisée** pour rester reproductible.

**Pièces (€/m² de pièce)**

| État | Bas | Moyen | Haut |
|---|---|---|---|
| À rafraîchir | 30 | 60 | 100 |
| À rénover | 250 | 450 | 700 |
| À refaire entièrement | 700 | 1 100 | 1 600 |

**Forfaits d'équipement**

| Poste | Bas | Moyen | Haut |
|---|---|---|---|
| Cuisine équipée | 4 000 | 8 000 | 15 000 |
| Salle de bain complète | 5 000 | 9 000 | 15 000 |
| WC | 1 500 | 2 500 | 4 000 |

**Gros postes**

| Poste | Unité | Bas | Moyen | Haut |
|---|---|---|---|---|
| Électricité complète | €/m² habitable | 80 | 110 | 150 |
| Plomberie complète | €/m² habitable | 60 | 90 | 130 |
| PAC air-eau | forfait | 10 000 | 14 000 | 18 000 |
| Chaudière gaz | forfait | 4 000 | 5 500 | 7 000 |
| Fenêtre PVC double vitrage | unité | 500 | 800 | 1 200 |
| Isolation combles perdus | €/m² | 25 | 40 | 60 |
| ITE (isolation extérieure) | €/m² de façade | 120 | 170 | 220 |
| Réfection de toiture | €/m² | 120 | 180 | 250 |
| Ravalement de façade | €/m² | 40 | 70 | 110 |
| VMC | forfait | 800 | 1 500 | 3 000 |
| Assainissement individuel | forfait | 6 000 | 9 000 | 12 000 |
| Ouverture mur porteur + IPN (avec bureau d'études) | forfait | 3 000 | 5 000 | 8 000 |
| Démolition / évacuation | €/m² habitable | 15 | 30 | 50 |

**Autres réglages par défaut**

| Réglage | Valeur |
|---|---|
| Coefficient matériaux (« Nous-mêmes ») | 40 % |
| Aléas | 15 % |
| Frais d'acquisition RP | 7,5 % |
| Frais d'acquisition MDB | 2,5 % |
| Dommages-ouvrage | 4 % des travaux |
| IS | 15 % jusqu'à 42 500 €, 25 % au-delà |
| Marge cible | 20 % du coût de revient |
| Frais d'agence à la revente | 5 % |
| Abattement revente scénario pessimiste | 5 % |

Les réglages fiscaux doivent être clairement présentés comme **« à vérifier chaque année »**.

---

## 9. Architecture et évolutivité

```
/
├── index.html
├── manifest.webmanifest
├── sw.js
├── PROJET.md                 ← ce document
├── README.md
├── assets/
│   ├── logo.svg, favicon.svg
│   └── icons/ (192, 512, maskable, apple-touch)
├── css/
│   ├── tokens.css            ← design tokens (couleurs, typo, espacements, clair/sombre)
│   ├── app.css
│   └── print.css             ← mise en page de la fiche A4
├── js/
│   ├── app.js                ← démarrage, routeur par hash (#/estimation/<id>/pieces…)
│   ├── calc/
│   │   ├── engine.js         ← fonctions pures de calcul
│   │   └── defaults.js       ← grille et réglages par défaut
│   ├── data/
│   │   ├── db.js             ← accès IndexedDB (petit wrapper maison)
│   │   ├── schema.js         ← schéma + numéro de version
│   │   ├── migrations.js     ← migrations entre versions du schéma
│   │   └── io.js             ← export/import JSON
│   ├── ui/                   ← un module par écran + composants réutilisables
│   └── print/
│       └── sheet.js          ← construction de la fiche imprimable
└── tests/
    └── engine.test.js        ← node --test
```

**Principes :**
- Chaque estimation porte un `schemaVersion`. Toute évolution du modèle passe par une **migration**, jamais par une casse des données existantes.
- Le moteur de calcul ne connaît pas l'interface. On doit pouvoir l'appeler depuis un test Node.
- Le service worker est **versionné**. Une mise à jour affiche un bandeau « Nouvelle version disponible, recharger ».
- Les composants d'interface sont réutilisables (champ numérique avec unité, sélecteur d'état, carte de résultat).

---

## 10. Sauvegarde, historique, export et import

- Sauvegarde automatique (avec un *debounce*) dans IndexedDB.
- Liste des estimations : dupliquer (pratique pour comparer deux hypothèses), archiver, supprimer (avec confirmation).
- **Export :**
  - un fichier `.json` par estimation, photos incluses en base64 ;
  - un export global (toutes les estimations et les réglages) ;
  - téléchargement via `Blob` et `<a download>`, et **Web Share API** si elle est disponible, pour envoyer directement le fichier à l'associé.
- **Import** d'un fichier `.json` : validation du schéma, migration si la version est ancienne, gestion des doublons d'identifiant (proposer de remplacer ou de dupliquer).
- Rappel discret : les données restent sur le téléphone, donc il faut exporter régulièrement.

---

## 11. Fiche PDF (A4, une page)

**Méthode, sans bibliothèque :**
- Une vue dédiée **« Fiche »** est mise en page avec `print.css` (`@page { size: A4 portrait; margin: 10mm; }`).
- Le bouton « Exporter en PDF » appelle `window.print()`. L'utilisateur choisit alors « Enregistrer en PDF », disponible sur Android, iOS et desktop.
- Afficher une courte aide la première fois, pour expliquer comment enregistrer en PDF sur mobile.

**Contenu de la fiche (ordre indicatif) :**
1. **En-tête :** logo, nom de l'app, date, adresse du bien, badge du régime (RP ou MDB), pastille de verdict.
2. **Le bien :** type, surfaces, DPE, année, prix affiché et prix visé, avec 2 à 4 photos en vignettes.
3. **Travaux :** tableau compact par pièce et par poste (bas, moyen, haut), total avec aléas.
4. **Plan de financement et portage :** les principaux montants.
5. **Synthèse :** tableau des 3 scénarios (coût de revient, revente, marge brute, marge nette, % du coût de revient), et prix d'achat maximum pour la marge cible.
6. **Notes** (tronquées si nécessaire).
7. **Pied de page :** *« Estimation indicative, ne constitue pas un conseil financier ou fiscal »*, version de l'app.

**Exigences de mise en page :**
- Tenir sur **une seule page A4 portrait** dans le cas standard (jusqu'à 8 pièces environ).
- Si le contenu dépasse : mode compact automatique (police réduite, travaux regroupés par catégorie, moins de photos). En dernier recours, un saut propre sur une 2e page, sans élément coupé.
- Le rendu doit rester lisible en **noir et blanc** : les couleurs servent d'accent, pas de seul support d'information.
- Tester l'impression réelle sur Chrome Android et Safari iOS.

---

## 12. Jalons proposés

1. **J1 — Socle :** structure du dépôt, design tokens (avec le skill de design), logo et icônes, PWA hors ligne, routeur, déploiement GitHub Pages.
2. **J2 — Moteur :** `engine.js` + `defaults.js` + tests unitaires complets.
3. **J3 — Saisie :** écrans Bien, Pièces, Gros postes, Financement & revente ; bandeau de marge en direct.
4. **J4 — Données :** IndexedDB, historique, duplication, export/import JSON, photos.
5. **J5 — Synthèse et fiche :** écran de synthèse avec les 3 scénarios, fiche A4 imprimable.
6. **J6 — Réglages et finitions :** édition de la grille de prix, mode sombre, accessibilité, aide au premier lancement.

---

## 13. Critères d'acceptation

- [ ] Aucune requête réseau vers un domaine tiers (vérifiable dans les outils de développement).
- [ ] Fonctionne en mode avion après une première visite, et s'installe sur l'écran d'accueil.
- [ ] Une estimation complète (bien + 6 pièces + 3 gros postes) se saisit en **moins de 5 minutes** sur mobile.
- [ ] Les résultats des tests du moteur correspondent à des calculs vérifiés à la main (au moins un cas RP et un cas MDB).
- [ ] La fiche standard tient sur une page A4 et s'enregistre en PDF sur Android et iOS.
- [ ] Un export JSON réimporté sur un autre téléphone redonne une estimation identique, photos comprises.
- [ ] Modifier la grille de prix ne change pas les estimations déjà enregistrées, sauf action explicite « recalculer avec la grille actuelle ».

---

## 14. Pistes d'évolution (hors v1)

- Comparateur de plusieurs biens côte à côte.
- Grille de prix calibrée automatiquement à partir de nos chantiers réels (RETEX).
- Checklist de visite : points de vigilance (humidité, fissures, amiante, plomb, toiture, tableau électrique).
- Génération d'un vrai fichier PDF natif (écrit à la main, toujours sans dépendance) pour un partage en un clic.
- Synchronisation entre associés (par fichier partagé, ou back-end léger plus tard).
- Mode « offre » : génération d'une argumentation chiffrée pour la négociation.

---

## 15. Décisions prises (novembre 2026)

| # | Sujet | Décision |
|---|---|---|
| 1 | Forfait WC | Le forfait d'équipement s'applique aussi aux **WC** (aucun / partiel / complet), en plus de la cuisine et de la salle de bain. |
| 2 | Postes sans prix (ITI, poêle, radiateurs électriques, divers…) | Valeurs indicatives ajoutées à la grille par défaut, toutes **modifiables dans l'onglet Réglages**. |
| 3 | Base de la dommages-ouvrage | **Travaux hors aléas**, au coût effectivement chiffré (matériaux seuls pour « Nous-mêmes »). Option dans les réglages pour inclure les aléas. |
| 4 | Coefficient matériaux par catégorie | Trois coefficients : **pièces**, **équipements**, **gros postes** (40 % par défaut chacun). Le coefficient « équipements » est remplacé par les coefficients de pose de la décision 13. |
| 5 | Rendement annualisé | Calculé sur la **durée de portage**. |
| 6 | IRA en RP | Calcul simplifié sur le **capital emprunté** (plafond : min(6 mois d'intérêts, 3 %)). |
| 7 | TVA en MDB | Hors périmètre v1 (prix TTC, revente d'ancien supposée exonérée), mention sur la fiche. |
| 8 | Flat tax | **31,4 %** (2026), réglage modifiable « à vérifier chaque année ». |
| 9 | Périmètre v1 | **Régime RP uniquement.** Le modèle de données garde un champ `regime` (valeur `RP`) et le moteur est découpé pour accueillir le MDB plus tard sans migration cassante. |
| 10 | Prix d'achat | Le « prix d'achat visé » devient un **prix négocié facultatif**. Sans lui, le calcul se fait sur le **prix affiché** ; la synthèse donne le prix d'achat maximum à viser. |
| 11 | Modes d'estimation | **Rapide** (une page : surface, état général, réalisation, prix affiché, revente ; sans prêt ni portage) ou **Détaillée** (l'existant). Passage de l'un à l'autre sans perte. Schéma de données v2 (migration automatique). |
| 12 | Préconisations | La synthèse indique le **prix d'achat à viser** (et sa version prudente) et le **budget travaux à ne pas dépasser** au prix retenu, pour la marge cible. |
| 13 | Décomposition des équipements | Le prix « complet » d'une cuisine, d'une salle de bain ou de WC = **électroménager ou sanitaires** + **mobilier** (prix d'achat, plein tarif dans les deux modes) + **pose et raccordements** (fourni-posé). En « Nous-mêmes », seule la pose est réduite, avec un **coefficient par pièce** (cuisine 20 %, salle de bain 40 %, WC 30 %). En « Partiel » : éléments cochés + pose **au prorata** de leur prix, si bien que tout cocher revient au complet. Une seule cuvette de WC (à poser ou suspendue). |
