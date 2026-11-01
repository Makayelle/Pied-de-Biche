// Écran d'accueil : liste des estimations.
import { h, picto, format } from './dom.js';
import { lien } from '../router.js';
import { creer, lister } from '../data/store.js';
import { calculerEstimation } from '../calc/engine.js';
import { LIBELLES_VERDICT } from './etape.js';

const fmtDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

function carteEstimation(e) {
  const r = calculerEstimation(e);
  const c = r.scenarios.central;
  const v = c.verdict;
  const titre = e.bien.adresse || 'Adresse non renseignée';
  return h('li', {},
    h('a', { class: 'estimation', href: lien({ ecran: 'estimation', id: e.id, etape: 'bien' }) },
      h('span', { class: 'estimation__titre' }, titre),
      h('span', { class: 'estimation__meta' }, [e.bien.commune, fmtDate.format(new Date(e.modifieLe))].filter(Boolean).join(' · ')),
      h('span', { class: 'estimation__resultat' },
        h('span', { class: 'chiffre' }, r.complet ? format.euros(c.margeNette) : '—'),
        h('span', { class: `pastille pastille--${v === 'incomplet' ? 'neutre' : v}` }, LIBELLES_VERDICT[v]),
      ),
    ),
  );
}

export function ecranAccueil() {
  const estimations = lister();
  const liste = h('ul', { class: 'liste-estimations' }, estimations.map(carteEstimation));

  const filtrer = (texte) => {
    const t = texte.trim().toLocaleLowerCase('fr');
    const visibles = estimations.filter((e) => `${e.bien.adresse} ${e.bien.commune}`.toLocaleLowerCase('fr').includes(t));
    liste.replaceChildren(...visibles.map(carteEstimation));
  };

  return [
    h('h1', {}, 'Mes estimations'),
    h('p', { class: 'accroche' }, 'Voir sous la surface avant d’acheter.'),

    h('button', {
      type: 'button', class: 'bouton bouton--principal bouton--large',
      onclick: () => { location.hash = lien({ ecran: 'estimation', id: creer().id, etape: 'bien' }); },
    }, picto('plus'), 'Nouvelle estimation'),

    estimations.length > 0
      ? [
        h('div', { class: 'outils-liste' },
          h('label', { class: 'visuellement-cache', for: 'recherche' }, 'Rechercher une estimation'),
          h('input', {
            id: 'recherche', class: 'champ-recherche', type: 'search',
            placeholder: 'Rechercher (adresse, commune…)', oninput: (ev) => filtrer(ev.target.value),
          }),
        ),
        liste,
      ]
      : h('div', { class: 'vide' },
        picto('chantier'),
        h('strong', {}, 'Aucune estimation pour l’instant'),
        h('span', {}, 'Lancez une estimation au début de votre prochaine visite.'),
      ),

    h('p', { class: 'rappel' },
      picto('info'),
      h('span', {}, 'Version de test : les estimations ne sont pas encore conservées après fermeture de l’app (sauvegarde sur le téléphone au jalon J4).'),
    ),
  ];
}
