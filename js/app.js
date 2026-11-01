// Démarrage de l'application et aiguillage des écrans.
import { analyserRoute, lien, ETAPES } from './router.js';
import { monterCoquille } from './ui/shell.js';
import { ecranAccueil } from './ui/accueil.js';
import { navigationEtapes, barreEtapes, bandeauMarge } from './ui/etape.js';
import { ecranSynthese } from './ui/ecran-synthese.js';
import { ecranFiche } from './ui/ecran-fiche.js';
import { ecranBien } from './ui/ecran-bien.js';
import { ecranPieces } from './ui/ecran-pieces.js';
import { ecranPostes } from './ui/ecran-postes.js';
import { ecranFinancement } from './ui/ecran-financement.js';
import { ecranReglages } from './ui/reglages.js';
import { creerContexte } from './ui/contexte.js';
import { enregistrerServiceWorker } from './ui/maj.js';
import { obtenir, charger } from './data/store.js';
import { h, libererUrls } from './ui/dom.js';

const racine = document.getElementById('app');

const ECRANS = {
  bien: ecranBien,
  pieces: ecranPieces,
  postes: ecranPostes,
  financement: ecranFinancement,
  synthese: ecranSynthese,
};

const introuvable = (texte) => ({
  contenu: [h('h1', {}, texte), h('p', {}, h('a', { href: lien({ ecran: 'accueil' }) }, 'Retour à l’accueil'))],
  titre: texte,
});

/**
 * Affiche l'écran correspondant au hash.
 * @param {{ conserverDefilement?: boolean, focus?: string|null }} opts
 */
let nettoyage = null;

function afficher({ conserverDefilement = false, focus = null } = {}) {
  const route = analyserRoute(location.hash);
  const defilement = window.scrollY;
  libererUrls();
  nettoyage?.();
  nettoyage = null;
  let vue;

  // La fiche a sa propre mise en page (aperçu A4), sans la coquille de l'app.
  if (route.ecran === 'fiche') {
    const estimation = obtenir(route.id);
    if (estimation) {
      nettoyage = ecranFiche(racine, estimation);
      document.title = `Fiche ${estimation.bien.adresse || ''} · Pied-de-Biche`;
      window.scrollTo(0, 0);
      return;
    }
  }

  switch (route.ecran) {
    case 'accueil':
      vue = { contenu: ecranAccueil({ rerendre: () => afficher({ conserverDefilement: true }) }), titre: 'Mes estimations' };
      break;
    case 'estimation': {
      const estimation = obtenir(route.id);
      if (!estimation) {
        vue = introuvable('Estimation introuvable');
        break;
      }
      const ctx = creerContexte(estimation, (o) => afficher({ conserverDefilement: true, ...o }));
      const etape = ETAPES.find((e) => e.id === route.etape);
      vue = {
        contenu: [...ECRANS[route.etape](ctx), navigationEtapes(route)],
        avant: barreEtapes(route.id, route.etape),
        bandeau: bandeauMarge(ctx),
        titre: etape.libelle,
      };
      break;
    }
    case 'reglages':
      vue = { contenu: ecranReglages(), titre: 'Réglages' };
      break;
    default:
      vue = introuvable('Page introuvable');
  }

  const { main } = monterCoquille(racine, { route, ...vue });
  document.title = `${vue.titre} · Pied-de-Biche`;

  // Rend visible l'étape courante dans la barre défilante.
  const etapeCourante = document.querySelector('.etapes [aria-current="step"]');
  if (etapeCourante) {
    const barre = etapeCourante.closest('ol');
    barre.scrollLeft = etapeCourante.parentElement.offsetLeft - (barre.clientWidth - etapeCourante.offsetWidth) / 2;
  }
  window.scrollTo(0, conserverDefilement ? defilement : 0);

  const cible = focus && document.querySelector(focus);
  if (cible) {
    cible.focus({ preventScroll: true });
    cible.scrollIntoView({ block: 'center' });
  } else if (!conserverDefilement && afficher.dejaAffiche) {
    // Accessibilité : focus sur le contenu après un changement d'écran.
    main.focus({ preventScroll: true });
  }
  afficher.dejaAffiche = true;
}

async function demarrer() {
  try {
    await charger();
  } catch (err) {
    console.error(err);
    racine.replaceChildren(h('p', { class: 'noscript' },
      'Impossible d\u2019ouvrir le stockage du téléphone (navigation privée\u00a0?). Les estimations ne pourront pas être enregistrées.'));
    return;
  }
  window.addEventListener('hashchange', () => afficher());
  afficher();
}

enregistrerServiceWorker();
demarrer();
