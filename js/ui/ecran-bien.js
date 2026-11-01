// Étape 1 — Le bien.
import { h } from './dom.js';
import { champNombre, champTexte, choix, section, duo } from './composants.js';

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

export function ecranBien(ctx) {
  const b = ctx.estimation.bien;
  const p = (cle) => ctx.poser(b, cle);

  return [
    h('h1', {}, 'Le bien'),
    h('p', { class: 'regime' }, h('span', { class: 'etiquette' }, 'Résidence principale'),
      ' Cadre fiscal de l’estimation (seul régime de la v1).'),

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
        champNombre({ libelle: 'Prix d’achat visé', unite: '€', valeur: b.prixAchat, aide: 'Négocié, hors frais', onChange: p('prixAchat') }),
      ),
    ),

    section('Source',
      choix({ libelle: 'Origine du bien', options: SOURCES, valeur: b.source, onChange: p('source') }),
      champTexte({ libelle: 'Contact', valeur: b.contact, placeholder: 'Nom, téléphone…', onChange: p('contact') }),
    ),

    section('Notes',
      champTexte({ libelle: 'Notes de visite', valeur: b.notes, multiligne: true, onChange: p('notes') }),
      h('p', { class: 'champ__aide' }, 'Les photos arrivent au jalon J4.'),
    ),
  ];
}
