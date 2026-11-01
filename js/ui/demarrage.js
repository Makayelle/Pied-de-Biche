// Aide affichée au premier lancement (et accessible depuis les réglages).
import { h } from './dom.js';
import { demander } from './dialogue.js';
import * as store from '../data/store.js';

const ETAPES = [
  ['Pendant la visite', 'Touchez « Nouvelle estimation », puis renseignez le bien, les pièces et les gros postes. Tout est enregistré automatiquement, même sans réseau.'],
  ['En direct', 'Le bandeau en bas d’écran affiche la marge nette du scénario central et sa pastille : vert à l’objectif, orange à surveiller, rouge insuffisant.'],
  ['Pour décider', 'La synthèse compare trois scénarios et donne le prix d’achat maximum pour votre marge cible : utile pour négocier.'],
  ['Pour partager', 'Exportez la fiche en PDF, ou envoyez l’estimation (photos comprises) à votre associé, qui l’importe sur son téléphone.'],
];

export async function afficherAccueilDemarrage() {
  const contenu = h('div', { class: 'demarrage' },
    h('ol', { class: 'demarrage__etapes' }, ETAPES.map(([titre, texte]) =>
      h('li', {}, h('strong', {}, titre), h('span', {}, texte)))),
    h('div', { class: 'demarrage__installer' },
      h('strong', {}, 'Installer l’app sur l’écran d’accueil'),
      h('span', {}, 'Android : menu ⋮ de Chrome, puis « Installer l’application ». iPhone : bouton Partager de Safari, puis « Sur l’écran d’accueil ».'),
    ),
  );
  await demander({
    titre: 'Bienvenue dans Pied-de-Biche', texte: 'Voir sous la surface avant d’acheter.', contenu,
    boutons: [{ valeur: 'ok', libelle: 'C’est parti', style: 'bouton--principal' }],
  });
  await store.ecrireMeta('demarrageVu', true);
}

/** Au premier lancement uniquement. */
export async function demarrageSiPremiereFois() {
  if (!await store.lireMeta('demarrageVu')) await afficherAccueilDemarrage();
}
