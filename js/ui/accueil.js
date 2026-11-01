// Écran d'accueil : liste des estimations (branchée sur IndexedDB au jalon J4).
import { h, picto } from './dom.js';
import { lien } from '../router.js';

/** Identifiant court et lisible, sans dépendance. */
function nouvelId() {
  const alea = crypto.getRandomValues(new Uint32Array(2));
  return `e${Date.now().toString(36)}${alea[0].toString(36)}`;
}

export function ecranAccueil() {
  return [
    h('h1', {}, 'Mes estimations'),
    h('p', { class: 'accroche' }, 'Voir sous la surface avant d’acheter.'),

    h('a', {
      class: 'bouton bouton--principal bouton--large',
      href: '#',
      onclick: (ev) => {
        ev.preventDefault();
        location.hash = lien({ ecran: 'estimation', id: nouvelId(), etape: 'bien' });
      },
    }, picto('plus'), 'Nouvelle estimation'),

    h('div', { class: 'outils-liste' },
      h('label', { class: 'visuellement-cache', for: 'recherche' }, 'Rechercher une estimation'),
      h('input', {
        id: 'recherche', class: 'champ-recherche', type: 'search',
        placeholder: 'Rechercher (adresse, commune…)', disabled: true,
      }),
    ),

    h('div', { class: 'vide' },
      picto('chantier'),
      h('strong', {}, 'Aucune estimation pour l’instant'),
      h('span', {}, 'Lancez une estimation au début de votre prochaine visite.'),
    ),

    h('p', { class: 'rappel' },
      picto('info'),
      h('span', {}, 'Vos données restent sur ce téléphone. Pensez à les exporter régulièrement pour les partager avec votre associé.'),
    ),
  ];
}
