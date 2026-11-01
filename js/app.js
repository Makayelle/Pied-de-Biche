// Démarrage de l'application et aiguillage des écrans.
import { analyserRoute, ETAPES } from './router.js';
import { monterCoquille } from './ui/shell.js';
import { ecranAccueil } from './ui/accueil.js';
import { ecranEtape, barreEtapes, bandeauMarge } from './ui/etape.js';
import { ecranReglages } from './ui/reglages.js';
import { enregistrerServiceWorker } from './ui/maj.js';
import { h } from './ui/dom.js';

const racine = document.getElementById('app');

function afficher() {
  const route = analyserRoute(location.hash);
  let vue;

  switch (route.ecran) {
    case 'accueil':
      vue = { contenu: ecranAccueil(), titre: 'Mes estimations' };
      break;
    case 'estimation': {
      const etape = ETAPES.find((e) => e.id === route.etape);
      vue = {
        contenu: ecranEtape(route),
        avant: barreEtapes(route.id, route.etape),
        bandeau: bandeauMarge(),
        titre: etape.libelle,
      };
      break;
    }
    case 'reglages':
      vue = { contenu: ecranReglages(), titre: 'Réglages' };
      break;
    default:
      vue = {
        contenu: [h('h1', {}, 'Page introuvable'), h('p', {}, h('a', { href: '#/' }, 'Retour à l’accueil'))],
        titre: 'Page introuvable',
      };
  }

  const { main } = monterCoquille(racine, { route, ...vue });
  document.title = `${vue.titre} · Pied-de-Biche`;
  window.scrollTo(0, 0);
  // Accessibilité : on place le focus sur le contenu après un changement d'écran.
  if (afficher.dejaAffiche) main.focus({ preventScroll: true });
  afficher.dejaAffiche = true;
}

window.addEventListener('hashchange', afficher);
afficher();
enregistrerServiceWorker();
