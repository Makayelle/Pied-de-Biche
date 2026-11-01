// Galerie de photos rattachée au bien ou à une pièce.
import { h, picto, urlObjet } from './dom.js';
import { champTexte, interrupteur } from './composants.js';
import { demander, notifier } from './dialogue.js';
import { preparerPhoto } from '../data/photos.js';
import * as store from '../data/store.js';

export const MAX_PHOTOS_FICHE = 4;

/**
 * @param {object} ctx  contexte d'édition
 * @param {string} cible 'bien' ou identifiant de pièce
 */
export function galeriePhotos(ctx, cible) {
  const { estimation } = ctx;
  const grille = h('div', { class: 'galerie__grille' });
  const conteneur = h('div', { class: 'galerie' }, grille);

  async function rafraichir() {
    const photos = (await store.photosDe(estimation.id)).filter((p) => p.cible === cible);
    grille.replaceChildren(...photos.map((p) => vignette(p)));
  }

  function vignette(photo) {
    return h('button', {
      type: 'button', class: 'galerie__vignette',
      'aria-label': `Photo${photo.legende ? ` : ${photo.legende}` : ''}${photo.dansFiche ? ', incluse dans la fiche' : ''}`,
      onclick: () => ouvrir(photo),
    },
    h('img', { src: urlObjet(photo.miniature ?? photo.image), alt: '', loading: 'lazy' }),
    photo.dansFiche ? h('span', { class: 'galerie__badge', 'aria-hidden': 'true' }, 'Fiche') : null);
  }

  async function ouvrir(photo) {
    const contenu = h('div', { class: 'photo-detail' },
      h('img', { src: urlObjet(photo.image), alt: photo.legende || 'Photo' }),
      champTexte({ libelle: 'Légende', valeur: photo.legende, onChange: (v) => { photo.legende = v; } }),
      interrupteur({ libelle: 'Inclure dans la fiche PDF', coche: photo.dansFiche, onChange: (v) => { photo.dansFiche = v; } }),
    );
    const choix = await demander({
      titre: 'Photo', contenu,
      boutons: [
        { valeur: 'supprimer', libelle: 'Supprimer', style: 'bouton--danger-discret' },
        { valeur: 'ok', libelle: 'Enregistrer', style: 'bouton--principal' },
      ],
    });
    if (choix === 'supprimer') await store.supprimerPhoto(photo.id);
    else if (choix === 'ok') await store.enregistrerPhoto(photo);
    await rafraichir();
  }

  async function ajouter(fichiers) {
    if (!fichiers.length) return;
    const existantes = await store.photosDe(estimation.id);
    let dansFiche = existantes.filter((p) => p.dansFiche).length;
    let erreurs = 0;
    conteneur.classList.add('galerie--chargement');
    for (const f of fichiers) {
      try {
        const photo = await preparerPhoto(f, { estimationId: estimation.id, cible, dansFiche: dansFiche < MAX_PHOTOS_FICHE });
        if (photo.dansFiche) dansFiche++;
        await store.enregistrerPhoto(photo);
      } catch (err) {
        console.error(err);
        erreurs++;
      }
    }
    conteneur.classList.remove('galerie--chargement');
    ctx.changer(() => {}); // met à jour la date de modification
    if (erreurs) notifier(`${erreurs} photo(s) n’ont pas pu être lues`);
    await rafraichir();
  }

  const entree = (attrs) => h('input', {
    type: 'file', accept: 'image/*', class: 'visuellement-cache', ...attrs,
    onchange: (ev) => { ajouter([...ev.target.files]); ev.target.value = ''; },
  });

  conteneur.append(h('div', { class: 'galerie__actions' },
    h('label', { class: 'bouton bouton--secondaire' }, entree({ capture: 'environment' }), picto('appareil'), 'Prendre une photo'),
    h('label', { class: 'bouton bouton--secondaire' }, entree({ multiple: true }), picto('image'), 'Choisir'),
  ));

  rafraichir();
  return conteneur;
}
