// Coquille de l'app : en-tête, zone de contenu, bandeau de marge.
import { h, picto } from './dom.js';
import { lien } from '../router.js';

// Logo en ligne pour hériter des couleurs du thème (mêmes tracés que assets/logo.svg).
const LOGO = `
  <rect x="18" y="32" width="27" height="24" rx="2" fill="var(--logo-maison)"/>
  <path d="M23 50 L29.5 43.5 L33.5 47.5 L40 41" fill="none" stroke="var(--logo-accent)" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M35 39.6 L41.6 39.4 L41.4 46" fill="none" stroke="var(--logo-accent)" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M11 32 L32 12.5 L53 32 L53 56" fill="none" stroke="var(--logo-accent)" stroke-width="7" stroke-linecap="square" stroke-linejoin="round"/>
  <path d="M11.4 31.7 L9.7 35.7 L7.2 33.1 Z" fill="var(--logo-fond)"/>
  <path d="M49 60 L57 60 L57 54.5 Z" fill="var(--logo-fond)"/>`;

function logo() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = LOGO;
  return svg;
}

/**
 * Monte la coquille et y insère le contenu de l'écran.
 * @param {HTMLElement} racine
 * @param {{ route: object, contenu: Node[], avant?: Node, bandeau?: Node }} options
 */
export function monterCoquille(racine, { route, contenu, avant = null, bandeau = null }) {
  const main = h('main', { id: 'contenu', class: 'contenu', tabindex: '-1' }, contenu);

  const coquille = h('div', { class: `coquille${bandeau ? ' avec-bandeau' : ''}` },
    h('header', { class: 'entete' },
      h('div', { class: 'entete__barre' },
        h('a', { class: 'marque', href: lien({ ecran: 'accueil' }), 'aria-label': 'Pied-de-Biche, accueil' },
          logo(), h('span', {}, 'Pied-de-Biche')),
        h('a', {
          class: 'bouton-icone', href: lien({ ecran: 'reglages' }), 'aria-label': 'Réglages',
          'aria-current': route.ecran === 'reglages' ? 'page' : false,
        }, picto('reglages')),
      ),
    ),
    avant,
    main,
    bandeau,
  );

  racine.replaceChildren(coquille);
  return { main };
}
