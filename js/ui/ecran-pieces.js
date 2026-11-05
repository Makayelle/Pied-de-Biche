// Étape 2 — Pièces : liste dynamique avec état, équipement et mode de réalisation.
import { h, picto, format } from './dom.js';
import { champNombre, champTexte, choix, cases, duo, legendeObligatoire } from './composants.js';
import { ETATS, TYPES_PIECES, CATEGORIES_ELEMENTS, GROUPES_ELEMENTS } from '../calc/defaults.js';
import { creerPiece } from '../data/schema.js';
import { estForfaitAncien } from '../calc/engine.js';
import { galeriePhotos } from './photos.js';
import { confirmer } from './dialogue.js';
import * as store from '../data/store.js';

const MODES = [
  { valeur: 'artisan', libelle: 'Artisan' },
  { valeur: 'nous', libelle: 'Nous-mêmes' },
];
const EQUIPEMENTS = [
  { valeur: 'aucun', libelle: 'Aucun' },
  { valeur: 'partiel', libelle: 'Partiel' },
  { valeur: 'complet', libelle: 'Complet' },
];

/** « 13 500 € » + fourchette « 9 000 – 21 000 € ». */
export function texteFourchette(c) {
  return { central: format.euros(c.moyen), plage: `${format.euros(c.bas)} – ${format.euros(c.haut)}` };
}

export function sortieCout(ctx, calcul) {
  const central = h('strong', { class: 'chiffre' });
  const plage = h('span', { class: 'cout__plage chiffre' });
  ctx.lier((r) => {
    const c = calcul(r);
    const t = texteFourchette(c ?? { bas: 0, moyen: 0, haut: 0 });
    central.textContent = t.central;
    plage.textContent = t.plage;
  });
  return h('p', { class: 'cout' }, central, plage);
}

/**
 * Équipement « partiel » : choix des éléments à acheter, regroupés par catégorie.
 * Les éléments exclusifs (cuvette de WC) sont un choix unique. Prix affichés : achat moyen de la grille.
 */
function elementsAAcheter(ctx, piece, type) {
  const r = ctx.estimation.reglages;
  // Estimation créée avec l'ancienne grille (forfait unique) : pas d'éléments à cocher.
  if (estForfaitAncien(r.grille.equipements[type.equipement])) {
    return h('p', { class: 'champ__aide' },
      `Grille d’origine de cette estimation : l’équipement partiel compte pour ${format.pourcent(r.coefEquipementPartiel)} du forfait complet. `
      + 'Pour choisir les éléments à acheter, recalculez-la avec les réglages actuels (en bas de la synthèse).');
  }
  const elements = Object.entries(r.grille.equipements[type.equipement].elements ?? {});
  const ancien = !Array.isArray(piece.elements);
  const coches = ancien ? [] : piece.elements;
  const libelle = (el) => `${el.libelle} · ${format.euros(el.moyen)}`;
  // Remplace, dans la liste de la pièce, les éléments d'un sous-groupe par la nouvelle sélection.
  // Redessin quand on quitte l'ancien mode ou quand la liste devient vide / non vide (message d'alerte).
  const remplacer = (cles, selection) => {
    const actuels = Array.isArray(piece.elements) ? piece.elements : [];
    const nouveaux = [...actuels.filter((c) => !cles.includes(c)), ...selection];
    const bascule = ancien || (actuels.length === 0) !== (nouveaux.length === 0);
    ctx.changer(() => { piece.elements = nouveaux; }, bascule ? { structure: true } : undefined);
  };

  const blocs = [];
  for (const [groupe, titre] of Object.entries(GROUPES_ELEMENTS)) {
    const options = elements.filter(([, el]) => el.groupe === groupe);
    if (!options.length) continue;
    const cles = options.map(([cle]) => cle);
    blocs.push(choix({
      libelle: titre,
      options: [{ valeur: '', libelle: 'Aucune' }, ...options.map(([cle, el]) => ({ valeur: cle, libelle: libelle(el) }))],
      valeur: cles.find((c) => coches.includes(c)) ?? '',
      onChange: (v) => remplacer(cles, v ? [v] : []),
    }));
  }
  for (const cat of CATEGORIES_ELEMENTS) {
    const options = elements.filter(([, el]) => el.categorie === cat.id && !el.groupe);
    if (!options.length) continue;
    const cles = options.map(([cle]) => cle);
    blocs.push(cases({
      libelle: cat.libelle,
      options: options.map(([cle, el]) => ({ valeur: cle, libelle: libelle(el) })),
      valeurs: coches.filter((c) => cles.includes(c)),
      onChange: (v) => remplacer(cles, v),
    }));
  }

  return h('div', { class: 'elements-equipement' },
    h('p', { class: 'champ__aide' }, ancien
      ? `Aucun élément choisi : l’équipement partiel compte pour ${format.pourcent(r.coefEquipementPartiel)} du complet. Cochez les éléments pour affiner.`
      : 'Prix d’achat des éléments, plus la pose au prorata (fournitures seules en « Nous-mêmes »). Tout cocher revient au complet.'),
    !ancien && coches.length === 0
      ? h('p', { class: 'champ__aide champ__aide--alerte', role: 'status' }, 'Aucun élément coché : l’équipement compte pour 0 €.')
      : null,
    ...blocs,
  );
}

function cartePiece(ctx, piece) {
  const p = (cle, opts) => ctx.poser(piece, cle, opts);
  const type = TYPES_PIECES.find((t) => t.id === piece.type);

  return h('article', { class: 'carte piece', id: `piece-${piece.id}` },
    h('header', { class: 'piece__entete' },
      h('h2', { class: 'carte__titre' }, piece.nom || type.libelle),
      h('button', {
        type: 'button', class: 'bouton-icone bouton-icone--discret', 'aria-label': `Supprimer ${piece.nom || type.libelle}`,
        onclick: async () => {
          if (!await confirmer({
            titre: 'Supprimer la pièce\u00a0?', texte: `« ${piece.nom || type.libelle} » et ses photos seront supprimées.`,
            libelle: 'Supprimer', danger: true,
          })) return;
          const photos = (await store.photosDe(ctx.estimation.id)).filter((ph) => ph.cible === piece.id);
          await Promise.all(photos.map((ph) => store.supprimerPhoto(ph.id)));
          ctx.changer((e) => { e.pieces.splice(e.pieces.indexOf(piece), 1); }, { structure: true });
        },
      }, picto('corbeille')),
    ),
    duo(
      champNombre({ libelle: 'Surface', unite: 'm²', valeur: piece.surface, obligatoire: true, onChange: p('surface'), id: `surface-${piece.id}` }),
      champTexte({ libelle: 'Nom (facultatif)', valeur: piece.nom, placeholder: type.libelle, onChange: (v) => {
        ctx.changer(() => { piece.nom = v; });
        document.querySelector(`#piece-${piece.id} .carte__titre`).textContent = v || type.libelle;
      } }),
    ),
    choix({ libelle: 'État', options: ETATS.map((e) => ({ valeur: e.id, libelle: e.libelle })), valeur: piece.etat, onChange: p('etat') }),
    type.equipement
      ? choix({ libelle: 'Équipement à acheter', options: EQUIPEMENTS, valeur: piece.equipement, onChange: p('equipement', { structure: true }) })
      : null,
    type.equipement && piece.equipement === 'partiel' ? elementsAAcheter(ctx, piece, type) : null,
    choix({ libelle: 'Réalisation', options: MODES, valeur: piece.mode, onChange: p('mode') }),
    champTexte({ libelle: 'Note', valeur: piece.note, onChange: p('note') }),
    galeriePhotos(ctx, piece.id),
    sortieCout(ctx, (r) => r.travaux.lignes.find((l) => l.id === piece.id)),
  );
}

export function ecranPieces(ctx) {
  const { pieces } = ctx.estimation;

  const ajouter = (typeId) => {
    const piece = creerPiece(typeId);
    ctx.changer((e) => { e.pieces.push(piece); }, { structure: true, focus: `#surface-${piece.id}` });
  };

  return [
    h('h1', {}, 'Pièces'),
    legendeObligatoire(),
    pieces.length === 0
      ? h('p', { class: 'vide vide--compact' }, 'Ajoutez les pièces au fil de la visite.')
      : h('div', { class: 'pile' }, pieces.map((piece) => cartePiece(ctx, piece))),

    h('section', { class: 'ajout', 'aria-labelledby': 'titre-ajout' },
      h('h2', { id: 'titre-ajout', class: 'ajout__titre' }, 'Ajouter une pièce'),
      h('div', { class: 'ajout__types' }, TYPES_PIECES.map((t) =>
        h('button', { type: 'button', class: 'puce', onclick: () => ajouter(t.id) }, picto('plus'), t.libelle),
      )),
    ),

    pieces.length > 0
      ? h('div', { class: 'total' },
        h('span', {}, 'Total pièces (hors aléas)'),
        sortieCout(ctx, (r) => r.travaux.lignes.filter((l) => l.categorie === 'piece')
          .reduce((t, l) => ({ bas: t.bas + l.bas, moyen: t.moyen + l.moyen, haut: t.haut + l.haut }), { bas: 0, moyen: 0, haut: 0 })),
      )
      : null,
  ];
}
