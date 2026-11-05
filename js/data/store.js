// Magasin des estimations : cache en mémoire + persistance IndexedDB (sauvegarde différée).
import { creerEstimation, copierEstimation, nouvelId } from './schema.js';
import { migrer } from './migrations.js';
import { reglagesParDefaut, completerReglages } from '../calc/defaults.js';
import * as db from './db.js';

const DELAI_SAUVEGARDE = 400; // ms
const estimations = new Map();
const enAttente = new Map(); // id → minuteur
let reglagesCourants = null;

/** Charge toutes les estimations au démarrage. */
export async function charger() {
  const [liste, reglages] = await Promise.all([db.tous('estimations'), db.lire('meta', 'reglages')]);
  for (const brute of liste) {
    try {
      estimations.set(brute.id, migrer(brute));
    } catch (err) {
      console.error('Estimation illisible ignorée', brute?.id, err);
    }
  }
  reglagesCourants = completerReglages(reglages ?? reglagesParDefaut());
  // Demande au navigateur de ne pas effacer les données en cas de manque d'espace.
  navigator.storage?.persist?.().catch(() => {});
  window.addEventListener('pagehide', vider);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') vider(); });
}

/** Réglages courants (copiés dans chaque nouvelle estimation). */
export const reglages = () => reglagesCourants ?? reglagesParDefaut();

export async function enregistrerReglages(r) {
  reglagesCourants = completerReglages(r);
  await db.ecrire('meta', r, 'reglages');
}

export function creer(mode = 'detaille') {
  const e = creerEstimation({ reglages: structuredClone(reglages()), mode });
  estimations.set(e.id, e);
  ecrireMaintenant(e.id);
  return e;
}

export const obtenir = (id) => estimations.get(id) ?? null;

/** Sauvegarde automatique différée (debounce). */
export function enregistrer(e) {
  e.modifieLe = new Date().toISOString();
  estimations.set(e.id, e);
  clearTimeout(enAttente.get(e.id));
  enAttente.set(e.id, setTimeout(() => ecrireMaintenant(e.id), DELAI_SAUVEGARDE));
}

function ecrireMaintenant(id) {
  clearTimeout(enAttente.get(id));
  enAttente.delete(id);
  const e = estimations.get(id);
  if (!e) return Promise.resolve();
  return db.ecrire('estimations', e).catch((err) => {
    console.error('Échec de la sauvegarde', err);
    alert('La sauvegarde a échoué (espace de stockage plein ?). Exportez vos estimations.');
  });
}

/** Écrit immédiatement toutes les sauvegardes en attente. */
export function vider() {
  return Promise.all([...enAttente.keys()].map(ecrireMaintenant));
}

export function lister({ archives = false } = {}) {
  return [...estimations.values()]
    .filter((e) => Boolean(e.archive) === archives)
    .sort((a, b) => b.modifieLe.localeCompare(a.modifieLe));
}

export const nombreArchives = () => [...estimations.values()].filter((e) => e.archive).length;
export const ids = () => [...estimations.keys()];

export async function dupliquer(id) {
  const source = obtenir(id);
  const copie = copierEstimation(source);
  // Les pièces changent d'identifiant : on suit la correspondance pour les photos.
  const corresp = new Map(source.pieces.map((p, i) => [p.id, copie.pieces[i].id]));
  estimations.set(copie.id, copie);
  await ecrireMaintenant(copie.id);
  const photos = await photosDe(id);
  await db.ecrireTout('photos', photos.map((p) => ({
    ...p, id: nouvelId('f'), estimationId: copie.id, cible: corresp.get(p.cible) ?? p.cible,
  })));
  return copie;
}

export function archiver(id, archive = true) {
  const e = obtenir(id);
  e.archive = archive;
  return ecrireMaintenant(id);
}

export async function supprimer(id) {
  clearTimeout(enAttente.get(id));
  enAttente.delete(id);
  estimations.delete(id);
  await db.supprimerEstimationEtPhotos(id);
}

/** Ajoute ou remplace des estimations importées (déjà migrées) et leurs photos. */
export async function importer(liste, photos) {
  for (const e of liste) estimations.set(e.id, e);
  await db.ecrireTout('estimations', liste);
  for (const e of liste) {
    // En cas de remplacement, on retire d'abord les anciennes photos.
    const anciennes = await photosDe(e.id);
    await Promise.all(anciennes.map((p) => db.supprimer('photos', p.id)));
  }
  await db.ecrireTout('photos', photos);
}

// ---- Photos ----

export const photosDe = (estimationId) => db.parIndex('photos', 'estimationId', estimationId)
  .then((l) => l.sort((a, b) => a.creeLe.localeCompare(b.creeLe)));

export const toutesLesPhotos = () => db.tous('photos');
export const enregistrerPhoto = (photo) => db.ecrire('photos', photo);
export const supprimerPhoto = (id) => db.supprimer('photos', id);

// ---- Méta : date du dernier export (rappel) ----

export const dernierExport = () => db.lire('meta', 'dernierExport');
export const noterExport = () => db.ecrire('meta', new Date().toISOString(), 'dernierExport');

// ---- Méta génériques (préférences, aides déjà vues) ----
export const lireMeta = (cle) => db.lire('meta', cle);
export const ecrireMeta = (cle, valeur) => db.ecrire('meta', valeur, cle);
