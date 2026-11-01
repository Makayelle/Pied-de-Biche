// Vue « Fiche » : aperçu A4 à l'écran et export PDF via l'impression du navigateur.
import { h, picto } from './dom.js';
import { lien } from '../router.js';
import { insererFicheAjustee } from '../print/sheet.js';
import { demander } from './dialogue.js';
import * as store from '../data/store.js';

const LARGEUR_PAGE_PX = (210 / 25.4) * 96;

/** Aide affichée la première fois : comment obtenir un PDF sur mobile. */
async function aideImpression() {
  if (await store.lireMeta('aideImpressionVue')) return true;
  const contenu = h('div', { class: 'aide-pdf' },
    h('p', {}, 'L’app ouvre la fenêtre d’impression du téléphone. Pour obtenir un PDF :'),
    h('ul', {},
      h('li', {}, h('strong', {}, 'Android (Chrome) : '), 'en haut, choisissez l’imprimante « Enregistrer au format PDF », puis le bouton PDF.'),
      h('li', {}, h('strong', {}, 'iPhone (Safari) : '), 'touchez « Options » ou l’icône de partage, puis « Enregistrer dans Fichiers » ou envoyez-le directement.'),
      h('li', {}, h('strong', {}, 'Ordinateur : '), 'destination « Enregistrer au format PDF ».'),
    ),
    h('p', {}, 'Format A4 portrait, marges par défaut.'),
  );
  const r = await demander({
    titre: 'Enregistrer la fiche en PDF', contenu,
    boutons: [{ valeur: 'annuler', libelle: 'Annuler' }, { valeur: 'ok', libelle: 'Compris, continuer', style: 'bouton--principal' }],
  });
  if (r !== 'ok') return false;
  await store.ecrireMeta('aideImpressionVue', true);
  return true;
}

export function ecranFiche(racine, estimation) {
  const page = h('div', { class: 'ecran-fiche__page' });
  const cadre = h('div', { class: 'ecran-fiche__cadre' }, page);
  const info = h('p', { class: 'ecran-fiche__info' });

  const ecran = h('div', { class: 'ecran-fiche' },
    h('div', { class: 'ecran-fiche__barre' },
      h('a', { class: 'bouton-icone', href: lien({ ecran: 'estimation', id: estimation.id, etape: 'synthese' }), 'aria-label': 'Retour à la synthèse' }, picto('retour')),
      h('strong', {}, 'Fiche'),
      h('button', {
        type: 'button', class: 'bouton bouton--principal',
        onclick: async () => { if (await aideImpression()) window.print(); },
      }, 'Exporter en PDF'),
    ),
    info,
    h('main', { id: 'contenu' }, cadre),
  );
  racine.replaceChildren(ecran);

  // Mise à l'échelle de l'aperçu pour tenir dans la largeur de l'écran.
  const ajusterEchelle = () => {
    const dispo = Math.min(window.innerWidth - 24, LARGEUR_PAGE_PX);
    const echelle = dispo / LARGEUR_PAGE_PX;
    page.style.transform = `scale(${echelle})`;
    cadre.style.width = `${LARGEUR_PAGE_PX * echelle}px`;
    cadre.style.height = `${page.offsetHeight * echelle}px`;
  };

  store.photosDe(estimation.id).then(async (photos) => {
    const { fiche, niveau, pages } = insererFicheAjustee(page, estimation, photos);
    info.textContent = pages > 1
      ? 'Contenu important : la fiche tient sur deux pages.'
      : niveau > 0 ? 'Mise en page compacte pour tenir sur une page A4.' : 'Une page A4, prête à être enregistrée en PDF.';
    // Attendre le décodage des photos avant toute impression.
    await Promise.all([...fiche.querySelectorAll('img')].map((img) => img.decode().catch(() => {})));
    ajusterEchelle();
    ecran.dataset.prete = 'oui';
  });
  ajusterEchelle();
  window.addEventListener('resize', ajusterEchelle);
  return () => window.removeEventListener('resize', ajusterEchelle);
}
