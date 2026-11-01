// Écran Réglages (édition de la grille au jalon J6).
import { h } from './dom.js';
import { APP_VERSION } from '../version.js';

const SECTIONS = [
  { titre: 'Grille de prix', texte: 'Prix au m² par état de pièce, forfaits d’équipement et gros postes, en fourchette basse, moyenne et haute.' },
  { titre: 'Coefficients', texte: 'Coefficient matériaux « Nous-mêmes » (pièces, équipements, gros postes), aléas, dommages-ouvrage.' },
  { titre: 'Frais et fiscalité (RP)', texte: 'Frais d’acquisition, frais de vente, indemnités de remboursement anticipé.', annuel: true },
  { titre: 'Objectifs', texte: 'Marge cible et seuils de la pastille (vert, orange, rouge), hypothèses du scénario pessimiste.' },
  { titre: 'Sauvegarde', texte: 'Export et import de toutes les estimations et des réglages.' },
];

export function ecranReglages() {
  return [
    h('h1', {}, 'Réglages'),
    h('div', { class: 'liste-reglages' }, SECTIONS.map((s) =>
      h('section', { class: 'carte' },
        h('h2', {}, s.titre, s.annuel ? h('span', { class: 'etiquette' }, 'À vérifier chaque année') : null),
        h('p', {}, s.texte),
      ),
    )),
    h('p', { class: 'pied-version' }, `Pied-de-Biche · version ${APP_VERSION}`),
  ];
}
