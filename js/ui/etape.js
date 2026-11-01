// Écrans de saisie d'une estimation (contenu réel au jalon J3).
import { h, picto } from './dom.js';
import { ETAPES, lien, voisines } from '../router.js';

const APERCU = {
  bien: {
    titre: 'Le bien',
    points: ['Adresse, commune, type et année de construction', 'Surfaces, nombre de pièces et de niveaux, DPE',
      'Source et contact', 'Prix affiché et prix d’achat visé', 'Notes et photos'],
  },
  pieces: {
    titre: 'Pièces',
    points: ['Liste dynamique des pièces avec leur surface', 'État : bon, à rafraîchir, à rénover, à refaire entièrement',
      'Forfait d’équipement cuisine, salle de bain et WC', 'Réalisation « Nous-mêmes » ou « Artisan »'],
  },
  postes: {
    titre: 'Gros postes',
    points: ['Toiture, façade, isolation, menuiseries', 'Électricité, plomberie, chauffage, VMC, assainissement',
      'Mur porteur / IPN, démolition, divers', 'Indicateur « structurel » pour la dommages-ouvrage'],
  },
  financement: {
    titre: 'Financement & revente',
    points: ['Apport, emprunt, taux et frais', 'Durée et coûts de portage', 'Prix de revente saisi ou calculé au m²',
      'Frais de vente'],
  },
  synthese: {
    titre: 'Synthèse',
    points: ['Trois scénarios : optimiste, central, pessimiste', 'Marge brute et nette, rendement sur apport',
      'Prix d’achat maximum pour la marge cible', 'Export de la fiche PDF'],
  },
};

export function barreEtapes(id, etapeCourante) {
  return h('nav', { class: 'etapes', 'aria-label': 'Étapes de l’estimation' },
    h('ol', {}, ETAPES.map((e, i) =>
      h('li', {},
        h('a', {
          href: lien({ ecran: 'estimation', id, etape: e.id }),
          'aria-current': e.id === etapeCourante ? 'step' : false,
        }, h('span', { class: 'num', 'aria-hidden': 'true' }, i + 1), e.libelle),
      ),
    )),
  );
}

export function ecranEtape({ id, etape }) {
  const apercu = APERCU[etape];
  const { precedente, suivante } = voisines(etape);

  return [
    h('h1', {}, apercu.titre),
    h('div', { class: 'carte' },
      h('p', {}, h('span', { class: 'etiquette' }, 'Bientôt')),
      h('p', {}, 'Cet écran permettra de saisir :'),
      h('ul', {}, apercu.points.map((p) => h('li', {}, p))),
    ),
    h('div', { class: 'navigation-etapes' },
      precedente
        ? h('a', { class: 'bouton bouton--secondaire', href: lien({ ecran: 'estimation', id, etape: precedente.id }) },
          picto('retour'), precedente.libelle)
        : h('a', { class: 'bouton bouton--secondaire', href: lien({ ecran: 'accueil' }) }, picto('retour'), 'Accueil'),
      suivante
        ? h('a', { class: 'bouton bouton--principal', href: lien({ ecran: 'estimation', id, etape: suivante.id }) },
          suivante.libelle, picto('suivant'))
        : null,
    ),
  ];
}

/** Bandeau permanent : marge nette du scénario central (calcul branché au J3). */
export function bandeauMarge() {
  return h('aside', { class: 'bandeau-marge', 'aria-label': 'Marge nette, scénario central' },
    h('div', { class: 'bandeau-marge__interieur', 'aria-live': 'polite' },
      h('div', {},
        h('div', { class: 'bandeau-marge__libelle' }, 'Marge nette · central'),
        h('div', { class: 'bandeau-marge__valeur chiffre' }, '— €'),
      ),
      h('div', { class: 'bandeau-marge__pct' },
        h('span', { class: 'pastille pastille--neutre' }, 'À compléter'),
      ),
    ),
  );
}
