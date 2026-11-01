// Export et import JSON des estimations (photos incluses, en base64).
// Fonctions sans DOM, testables sous Node (Blob, btoa et atob y sont disponibles).
import { APP_VERSION } from '../version.js';
import { SCHEMA_VERSION } from './schema.js';
import { migrer } from './migrations.js';

export const FORMAT = 'pied-de-biche';
const ID_VALIDE = /^[A-Za-z0-9_-]{1,64}$/;

/** Blob → data URL (base64). */
export async function blobVersDataUrl(blob) {
  const octets = new Uint8Array(await blob.arrayBuffer());
  let binaire = '';
  for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binaire)}`;
}

/** Data URL → Blob. */
export function dataUrlVersBlob(dataUrl) {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error('Image invalide');
  const binaire = atob(m[2]);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return new Blob([octets], { type: m[1] });
}

/**
 * Construit le contenu d'un fichier d'export.
 * @param {{ estimations: object[], photos?: object[], reglages?: object|null, type?: 'estimation'|'sauvegarde', maintenant?: Date }} p
 */
export async function construireExport({ estimations, photos = [], reglages = null, type = 'estimation', maintenant = new Date() }) {
  return {
    format: FORMAT,
    type,
    versionApp: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exporteLe: maintenant.toISOString(),
    estimations,
    photos: await Promise.all(photos.map(async ({ image, miniature, ...meta }) => ({
      ...meta,
      image: await blobVersDataUrl(image),
      miniature: miniature ? await blobVersDataUrl(miniature) : null,
    }))),
    ...(reglages ? { reglages } : {}),
  };
}

/** Nom de fichier lisible : pied-de-biche_12-rue-des-lilas_2026-11-01.json */
export function nomFichier(estimation, maintenant = new Date()) {
  const date = maintenant.toISOString().slice(0, 10);
  if (!estimation) return `pied-de-biche_sauvegarde_${date}.json`;
  const base = (estimation.bien.adresse || estimation.bien.commune || 'estimation')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'estimation';
  return `pied-de-biche_${base}_${date}.json`;
}

/**
 * Analyse et valide un fichier importé. Lève une erreur lisible si le fichier est inutilisable.
 * Les estimations sont migrées vers le schéma courant ; les photos sont reconverties en Blob.
 */
export function analyserImport(texte) {
  let donnees;
  try {
    donnees = typeof texte === 'string' ? JSON.parse(texte) : texte;
  } catch {
    throw new Error('Ce fichier n’est pas un JSON valide.');
  }
  if (donnees?.format !== FORMAT) throw new Error('Ce fichier ne provient pas de Pied-de-Biche.');
  if (!Array.isArray(donnees.estimations)) throw new Error('Fichier incomplet : aucune estimation.');

  const estimations = donnees.estimations.map((e, i) => {
    if (!e || typeof e !== 'object' || !ID_VALIDE.test(e.id ?? '')) throw new Error(`Estimation n°${i + 1} : identifiant invalide.`);
    if (!e.bien || !Array.isArray(e.pieces) || !Array.isArray(e.postes) || !e.reglages?.grille) {
      throw new Error(`Estimation n°${i + 1} : structure invalide.`);
    }
    return migrer(e);
  });

  const ids = new Set(estimations.map((e) => e.id));
  const photos = (Array.isArray(donnees.photos) ? donnees.photos : [])
    .filter((p) => p && ID_VALIDE.test(p.id ?? '') && ids.has(p.estimationId) && /^data:image\//.test(p.image ?? ''))
    .map(({ image, miniature, ...meta }) => ({
      ...meta,
      image: dataUrlVersBlob(image),
      miniature: typeof miniature === 'string' && miniature.startsWith('data:image/') ? dataUrlVersBlob(miniature) : null,
    }));

  return {
    type: donnees.type === 'sauvegarde' ? 'sauvegarde' : 'estimation',
    exporteLe: donnees.exporteLe ?? null,
    estimations,
    photos,
    reglages: donnees.reglages?.grille ? donnees.reglages : null,
  };
}

/** Repère les estimations importées dont l'identifiant existe déjà. */
export function conflits(importees, idsExistants) {
  const existants = new Set(idsExistants);
  return importees.filter((e) => existants.has(e.id)).map((e) => e.id);
}
