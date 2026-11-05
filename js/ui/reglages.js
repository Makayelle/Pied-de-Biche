// Écran Réglages : grille de prix, coefficients, frais, objectifs, affichage, sauvegarde.
// Les modifications s'appliquent aux NOUVELLES estimations ; une estimation existante garde
// sa copie des réglages, sauf action explicite « Recalculer avec les réglages actuels ».
import { h, picto, format } from './dom.js';
import { champNombre, choix, interrupteur } from './composants.js';
import { confirmer, notifier } from './dialogue.js';
import { exporterTout, exporterReglages } from './partage.js';
import { choisirTheme } from './theme.js';
import { afficherAccueilDemarrage } from './demarrage.js';
import { APP_VERSION } from '../version.js';
import { reglagesParDefaut, ETATS, UNITES, CATEGORIES_ELEMENTS, prixElements } from '../calc/defaults.js';
import * as store from '../data/store.js';

const THEMES = [
  { valeur: 'auto', libelle: 'Auto' },
  { valeur: 'clair', libelle: 'Clair' },
  { valeur: 'sombre', libelle: 'Sombre' },
];

let minuteur = null;

/** Sauvegarde différée des réglages. */
function sauver(r) {
  clearTimeout(minuteur);
  minuteur = setTimeout(() => store.enregistrerReglages(r), 400);
}

/** Ligne « bas / moyen / haut » pour un prix de la grille. */
function trio(libelle, objet, unite, r, aide) {
  const avert = h('p', { class: 'champ__aide champ__aide--alerte', hidden: true }, 'Attention : bas ≤ moyen ≤ haut attendu.');
  const verifier = () => { avert.hidden = objet.bas <= objet.moyen && objet.moyen <= objet.haut; };
  const champ = (f, l) => champNombre({
    libelle: l, unite: '€', valeur: objet[f],
    onChange: (v) => { objet[f] = v ?? 0; verifier(); sauver(r); },
  });
  verifier();
  return h('fieldset', { class: 'trio' },
    h('legend', { class: 'trio__libelle' }, libelle, unite ? h('span', { class: 'trio__unite' }, ` · ${unite}`) : null),
    aide ? h('p', { class: 'champ__aide' }, aide) : null,
    h('div', { class: 'trio__champs' }, champ('bas', 'Bas'), champ('moyen', 'Moyen'), champ('haut', 'Haut')),
    avert,
  );
}

/** Champ en pourcentage lié à objet[cle]. */
const pourcent = (libelle, objet, cle, r, aide) => champNombre({
  libelle, unite: '%', echelle: 100, valeur: objet[cle], aide,
  onChange: (v) => { objet[cle] = v ?? 0; sauver(r); },
});

function section(titre, ouvert, ...contenu) {
  return h('details', { class: 'carte repli', open: ouvert || false },
    h('summary', { class: 'repli__titre' }, titre),
    h('div', { class: 'repli__contenu' }, ...contenu));
}

/** Bloc repliable d'un équipement : éléments par catégorie, pose, total complet artisan. */
function equipementReglages(eq, r) {
  const total = h('p', { class: 'champ__aide' });
  const majTotal = () => {
    const tous = Object.keys(eq.elements);
    const t = (f) => format.euros(prixElements(eq, tous, f) + (eq.pose[f] ?? 0));
    total.textContent = `Complet artisan : ${t('bas')} / ${t('moyen')} / ${t('haut')} (bas / moyen / haut).`;
  };
  majTotal();
  const parCategorie = CATEGORIES_ELEMENTS
    .map((cat) => [cat, Object.values(eq.elements).filter((el) => el.categorie === cat.id)])
    .filter(([, els]) => els.length);
  // Les champs enregistrent à la sortie : le total est recalculé juste après.
  return h('details', { class: 'repli repli--imbrique', onfocusout: () => setTimeout(majTotal) },
    h('summary', { class: 'repli__titre' }, eq.libelle),
    h('div', { class: 'repli__contenu' },
      total,
      ...parCategorie.flatMap(([cat, els]) => [
        h('p', { class: 'trio__categorie' }, cat.libelle),
        ...els.map((el) => trio(el.libelle, el, 'prix d’achat', r)),
      ]),
      h('p', { class: 'trio__categorie' }, 'Pose'),
      trio('Pose et raccordements', eq.pose, 'fourni-posé', r),
    ));
}

export function ecranReglages({ rerendre }) {
  const r = structuredClone(store.reglages());
  const g = r.grille;

  return [
    h('h1', {}, 'Réglages'),
    h('p', { class: 'rappel' }, picto('info'),
      h('span', {}, 'Ces valeurs s’appliquent aux nouvelles estimations. Une estimation déjà enregistrée garde sa grille, sauf si vous la recalculez depuis sa synthèse.')),

    section('Grille : pièces (€/m²)', false,
      ...ETATS.filter((e) => e.id !== 'bon').map((e) => trio(e.libelle, g.pieces[e.id], '€/m² de pièce', r)),
    ),

    section('Grille : équipements', false,
      h('p', { class: 'champ__aide' }, 'Complet = éléments (prix d’achat, plein tarif dans les deux modes) + pose et raccordements (fourni-posé artisan). En « Nous-mêmes », seule la pose est réduite (coefficients de pose ci-dessous). En « Partiel », la pose est comptée au prorata des éléments cochés.'),
      ...Object.values(g.equipements).map((eq) => equipementReglages(eq, r)),
      pourcent('Équipement « partiel » sans élément choisi', r, 'coefEquipementPartiel', r,
        'Part du complet, pour les estimations créées avant le choix des éléments'),
    ),

    section('Grille : gros postes', false,
      h('p', { class: 'champ__aide' }, 'Prix fourni-posé par un artisan, en € TTC.'),
      ...Object.entries(g.postes).filter(([cle]) => cle !== 'divers').map(([, p]) => trio(p.libelle, p, UNITES[p.unite], r)),
    ),

    section('Coefficients des travaux', false,
      h('p', { class: 'champ__aide' }, 'Mode « Nous-mêmes » : part du prix artisan correspondant aux matériaux seuls.'),
      h('div', { class: 'duo' },
        pourcent('Matériaux : pièces', r.coefMateriaux, 'pieces', r),
        pourcent('Matériaux : gros postes', r.coefMateriaux, 'postes', r),
      ),
      h('p', { class: 'champ__aide' }, 'Pose et raccordements des équipements : part fournitures (raccords, câbles, joints, carrelage…).'),
      h('div', { class: 'duo' },
        pourcent('Pose : cuisine', r.coefMateriaux.pose, 'cuisine', r),
        pourcent('Pose : salle de bain', r.coefMateriaux.pose, 'sdb', r),
      ),
      pourcent('Pose : WC', r.coefMateriaux.pose, 'wc', r),
      h('div', { class: 'duo' },
        pourcent('Aléas', r, 'aleas', r, 'Sur le total des travaux'),
        pourcent('Dommages-ouvrage', r.dommagesOuvrage, 'taux', r, 'Des travaux'),
      ),
      interrupteur({
        libelle: 'Dommages-ouvrage calculée aléas compris', coche: r.dommagesOuvrage.inclureAleas,
        onChange: (v) => { r.dommagesOuvrage.inclureAleas = v; sauver(r); },
      }),
    ),

    section(h('span', {}, 'Frais et fiscalité (RP) ', h('span', { class: 'etiquette' }, 'À vérifier chaque année')), false,
      champNombre({
        libelle: 'Année de référence des valeurs', valeur: r.anneeReference,
        onChange: (v) => { r.anneeReference = v; sauver(r); },
      }),
      h('div', { class: 'duo' },
        pourcent('Frais d’acquisition', r.fraisAcquisition, 'RP', r, 'Droits et émoluments'),
        pourcent('Agence à la revente', r, 'fraisAgenceRevente', r, 'Valeur proposée'),
      ),
      h('div', { class: 'duo' },
        champNombre({
          libelle: 'IRA : mois d’intérêts', unite: 'mois', valeur: r.ira.moisInterets,
          onChange: (v) => { r.ira.moisInterets = v ?? 0; sauver(r); },
        }),
        pourcent('IRA : plafond', r.ira, 'plafondCapital', r, 'Du capital restant dû'),
      ),
    ),

    section('Objectifs et scénarios', false,
      h('div', { class: 'duo' },
        pourcent('Marge cible', r.objectifs, 'margeCible', r, 'En % du coût de revient (vert)'),
        pourcent('Seuil d’alerte', r.objectifs, 'seuilAlerte', r, 'En dessous : rouge'),
      ),
      h('div', { class: 'duo' },
        pourcent('Pessimiste : revente', r.scenarios, 'abattementRevente', r, 'Abattement sur le prix'),
        champNombre({
          libelle: 'Pessimiste : portage', unite: 'mois', valeur: r.scenarios.moisSupplementaires, aide: 'Mois supplémentaires',
          onChange: (v) => { r.scenarios.moisSupplementaires = v ?? 0; sauver(r); },
        }),
      ),
    ),

    h('section', { class: 'carte' },
      h('h2', { class: 'carte__titre' }, 'Affichage'),
      (() => {
        const el = h('div');
        store.lireMeta('theme').then((t) => el.replaceChildren(choix({
          libelle: 'Thème', options: THEMES, valeur: t ?? 'auto', onChange: choisirTheme,
        })));
        return el;
      })(),
      h('button', { type: 'button', class: 'bouton bouton--secondaire', onclick: afficherAccueilDemarrage }, picto('info'), 'Revoir l’aide de démarrage'),
    ),

    h('section', { class: 'carte' },
      h('h2', { class: 'carte__titre' }, 'Sauvegarde'),
      h('p', {}, 'Toutes les estimations, leurs photos et les réglages dans un seul fichier. L’import se fait depuis l’accueil.'),
      h('div', { class: 'sauvegarde sauvegarde--serre' },
        h('button', { type: 'button', class: 'bouton bouton--secondaire', onclick: exporterTout }, picto('export'), 'Tout exporter'),
        h('button', { type: 'button', class: 'bouton bouton--secondaire', onclick: () => exporterReglages(r) }, picto('export'), 'Exporter les réglages'),
      ),
      h('button', {
        type: 'button', class: 'bouton bouton--danger-discret bouton--plein',
        onclick: async () => {
          if (!await confirmer({
            titre: 'Revenir aux valeurs par défaut ?',
            texte: 'La grille de prix et tous les réglages reprennent leurs valeurs d’origine. Les estimations enregistrées ne changent pas.',
            libelle: 'Réinitialiser', danger: true,
          })) return;
          clearTimeout(minuteur);
          await store.enregistrerReglages(reglagesParDefaut());
          notifier('Réglages réinitialisés');
          rerendre();
        },
      }, 'Réinitialiser les réglages'),
    ),

    h('p', { class: 'pied-version' }, `Pied-de-Biche · version ${APP_VERSION} · valeurs ${r.anneeReference ?? ''}`),
  ];
}

