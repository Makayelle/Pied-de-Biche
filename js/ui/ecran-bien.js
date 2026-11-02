// Étape 1 — Le bien. En mode rapide, cette page suffit : travaux globaux et revente y sont saisis.
import { h, format } from './dom.js';
import { champNombre, champTexte, choix, section, duo } from './composants.js';
import { galeriePhotos } from './photos.js';
import { sortieCout } from './ecran-pieces.js';
import { ETATS } from '../calc/defaults.js';

const TYPES = [
  { valeur: 'maison', libelle: 'Maison' },
  { valeur: 'appartement', libelle: 'Appartement' },
  { valeur: 'immeuble', libelle: 'Immeuble' },
];
const DPE = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((l) => ({ valeur: l, libelle: l }))
  .concat({ valeur: 'inconnu', libelle: '?' });
const SOURCES = [
  { valeur: 'agence', libelle: 'Agence' },
  { valeur: 'notaire', libelle: 'Notaire / succession' },
  { valeur: 'particulier', libelle: 'Particulier' },
  { valeur: 'autre', libelle: 'Autre' },
];
const MODES_ESTIMATION = [
  { valeur: 'rapide', libelle: 'Rapide' },
  { valeur: 'detaille', libelle: 'Détaillée' },
];
const REALISATION = [
  { valeur: 'artisan', libelle: 'Artisan' },
  { valeur: 'nous', libelle: 'Nous-mêmes' },
];
const MODES_REVENTE = [
  { valeur: 'saisi', libelle: 'Prix saisi' },
  { valeur: 'm2', libelle: 'Prix au m²' },
];

/** Estimation rapide : travaux « à la louche » et revente, sur la même page. */
function sectionsRapides(ctx) {
  const { bien: b, revente: rv, reglages } = ctx.estimation;
  const pb = (cle) => ctx.poser(b, cle);
  const pr = (cle, opts) => ctx.poser(rv, cle, opts);
  const calcule = (fn) => {
    const el = h('p', { class: 'calcule' });
    ctx.lier((r) => { el.textContent = fn(r); });
    return el;
  };

  return [
    section('Travaux (estimation globale)',
      choix({
        libelle: 'État général', options: ETATS.map((e) => ({ valeur: e.id, libelle: e.libelle })),
        valeur: b.etatGeneral, onChange: pb('etatGeneral'),
      }),
      choix({ libelle: 'Réalisation', options: REALISATION, valeur: b.modeGeneral, onChange: pb('modeGeneral') }),
      h('p', { class: 'champ__aide' },
        `Surface habitable × prix au m² de l’état (grille des pièces), aléas de ${format.pourcent(reglages.aleas)} compris. « Nous-mêmes » : matériaux seuls.`),
      sortieCout(ctx, (r) => r.travaux.total),
    ),
    section('Revente',
      choix({ libelle: 'Prix de revente', options: MODES_REVENTE, valeur: rv.mode, onChange: pr('mode', { structure: true }) }),
      rv.mode === 'm2'
        ? champNombre({ libelle: 'Prix au m² du secteur', unite: '€/m²', valeur: rv.prixM2, onChange: pr('prixM2') })
        : champNombre({ libelle: 'Prix de revente estimé', unite: '€', valeur: rv.prix, onChange: pr('prix') }),
      rv.mode === 'm2'
        ? calcule((r) => (b.surfaceHabitable ? `Soit ${format.euros(r.scenarios.central.prixRevente)}` : 'Renseignez la surface habitable'))
        : null,
      champNombre({
        libelle: 'Frais d’agence à la revente', unite: '%', echelle: 100,
        valeur: rv.fraisAgencePct, onChange: pr('fraisAgencePct'),
      }),
      h('p', { class: 'champ__aide' }, 'Estimation rapide : sans prêt ni frais de portage. Passez en mode détaillé pour les intégrer.'),
    ),
  ];
}

export function ecranBien(ctx) {
  const e = ctx.estimation;
  const b = e.bien;
  const p = (cle) => ctx.poser(b, cle);
  const rapide = e.mode === 'rapide';

  return [
    h('h1', {}, 'Le bien'),
    h('p', { class: 'regime' }, h('span', { class: 'etiquette' }, 'Résidence principale'),
      ' Cadre fiscal de l’estimation (seul régime de la v1).'),

    h('section', { class: 'carte carte--mode' },
      choix({
        libelle: 'Type d’estimation', options: MODES_ESTIMATION, valeur: e.mode,
        onChange: (v) => ctx.changer((est) => { est.mode = v; }, { structure: true }),
      }),
      h('p', { class: 'champ__aide' }, rapide
        ? 'Rapide : une seule page, travaux estimés sur l’état général. Idéal pour un premier tri pendant la visite.'
        : 'Détaillée : pièce par pièce, gros postes, prêt et portage. Les données saisies sont conservées si vous changez de mode.'),
    ),

    section('Localisation',
      champTexte({ libelle: 'Adresse', valeur: b.adresse, autocomplete: 'street-address', onChange: p('adresse') }),
      champTexte({ libelle: 'Commune', valeur: b.commune, autocomplete: 'address-level2', onChange: p('commune') }),
    ),

    section('Caractéristiques',
      choix({ libelle: 'Type de bien', options: TYPES, valeur: b.type, onChange: p('type') }),
      duo(
        champNombre({ libelle: 'Surface habitable', unite: 'm²', valeur: b.surfaceHabitable, onChange: p('surfaceHabitable') }),
        champNombre({ libelle: 'Terrain', unite: 'm²', valeur: b.surfaceTerrain, onChange: p('surfaceTerrain') }),
      ),
      duo(
        champNombre({ libelle: 'Pièces', valeur: b.nbPieces, onChange: p('nbPieces') }),
        champNombre({ libelle: 'Niveaux', valeur: b.nbNiveaux, onChange: p('nbNiveaux') }),
      ),
      champNombre({ libelle: 'Année de construction (environ)', valeur: b.anneeConstruction, placeholder: 'ex. 1965', onChange: p('anneeConstruction') }),
      choix({ libelle: 'DPE', options: DPE, valeur: b.dpe, compact: true, onChange: p('dpe') }),
    ),

    section('Prix',
      duo(
        champNombre({ libelle: 'Prix affiché', unite: '€', valeur: b.prixAffiche, onChange: p('prixAffiche') }),
        champNombre({ libelle: 'Prix négocié', unite: '€', valeur: b.prixAchat, aide: 'Facultatif', onChange: p('prixAchat') }),
      ),
      h('p', { class: 'champ__aide' }, 'Sans prix négocié, le calcul se fait sur le prix affiché. La synthèse indique le prix d’achat maximum à viser.'),
    ),

    rapide ? sectionsRapides(ctx) : null,

    section('Source',
      choix({ libelle: 'Origine du bien', options: SOURCES, valeur: b.source, onChange: p('source') }),
      champTexte({ libelle: 'Contact', valeur: b.contact, placeholder: 'Nom, téléphone…', onChange: p('contact') }),
    ),

    section('Photos du bien', galeriePhotos(ctx, 'bien')),

    section('Notes',
      champTexte({ libelle: 'Notes de visite', valeur: b.notes, multiligne: true, onChange: p('notes') }),
    ),
  ];
}
