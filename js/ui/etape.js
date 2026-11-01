// Écrans de saisie d'une estimation (contenu réel au jalon J3).
import { h, picto, format } from './dom.js';
import { ETAPES, lien, voisines } from '../router.js';

const APERCU = {
  synthese: {
    titre: 'Synthèse',
    points: ['Trois scénarios : optimiste, central, pessimiste', 'Marge brute et nette, rendement sur apport',
      'Prix d\u2019achat maximum pour la marge cible', 'Export de la fiche PDF'],
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

export function ecranApercu(etape) {
  const apercu = APERCU[etape];
  return [
    h('h1', {}, apercu.titre),
    h('div', { class: 'carte' },
      h('p', {}, h('span', { class: 'etiquette' }, 'Jalon J5')),
      h('p', {}, 'Cet écran présentera\u00a0:'),
      h('ul', {}, apercu.points.map((p) => h('li', {}, p))),
    ),
  ];
}

export function navigationEtapes({ id, etape }) {
  const { precedente, suivante } = voisines(etape);
  return h('div', { class: 'navigation-etapes' },
      precedente
        ? h('a', { class: 'bouton bouton--secondaire', href: lien({ ecran: 'estimation', id, etape: precedente.id }) },
          picto('retour'), precedente.libelle)
        : h('a', { class: 'bouton bouton--secondaire', href: lien({ ecran: 'accueil' }) }, picto('retour'), 'Accueil'),
      suivante
        ? h('a', { class: 'bouton bouton--principal', href: lien({ ecran: 'estimation', id, etape: suivante.id }) },
          suivante.libelle, picto('suivant'))
        : null,
  );
}

export const LIBELLES_VERDICT = {
  ok: 'Objectif atteint',
  vigilance: 'À surveiller',
  alerte: 'Insuffisant',
  incomplet: 'À compléter',
};

/** Bandeau permanent : marge nette du scénario central, mise à jour en direct. */
export function bandeauMarge(ctx) {
  const valeur = h('div', { class: 'bandeau-marge__valeur chiffre' });
  const pct = h('span', { class: 'bandeau-marge__taux chiffre' });
  const pastille = h('span', { class: 'pastille' });

  ctx.lier((r) => {
    const c = r.scenarios.central;
    const v = c.verdict;
    valeur.textContent = r.complet ? format.euros(c.margeNette) : '— €';
    pct.textContent = r.complet && c.pctCoutRevient != null ? `${format.pourcent(c.pctCoutRevient)} du coût` : '';
    pastille.className = `pastille pastille--${v === 'incomplet' ? 'neutre' : v}`;
    pastille.textContent = LIBELLES_VERDICT[v];
  });

  return h('aside', { class: 'bandeau-marge', 'aria-label': 'Marge nette, scénario central' },
    h('div', { class: 'bandeau-marge__interieur', 'aria-live': 'polite', 'aria-atomic': 'true' },
      h('div', {},
        h('div', { class: 'bandeau-marge__libelle' }, 'Marge nette · central'),
        valeur,
      ),
      h('div', { class: 'bandeau-marge__pct' }, pastille, pct),
    ),
  );
}
