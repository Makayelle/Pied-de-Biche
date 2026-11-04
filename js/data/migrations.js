// Migrations du schéma des estimations.
// Règle : une évolution du modèle = SCHEMA_VERSION + 1 et une fonction ici qui passe de N à N + 1.
// On ne casse jamais une donnée existante.
import { SCHEMA_VERSION, normaliserEstimation } from './schema.js';

/** MIGRATIONS[n] transforme une estimation de la version n vers la version n + 1. */
export const MIGRATIONS = {
  // v1 → v2 : ajout du mode de saisie (rapide / détaillé) et de l'état général du bien.
  // Les estimations existantes ont été saisies en détail.
  1: (e) => {
    e.mode = 'detaille';
    e.bien.etatGeneral ??= 'renover';
    e.bien.modeGeneral ??= 'artisan';
    return e;
  },
  // v2 → v3 : ajout de la classe GES (émissions de gaz à effet de serre), à côté du DPE,
  // et des éléments d'équipement à acheter (équipement « partiel »).
  // Les pièces existantes gardent `elements: null` : leur équipement partiel reste calculé
  // en part du forfait, pour ne pas changer une estimation déjà enregistrée.
  2: (e) => {
    e.bien.ges ??= 'inconnu';
    for (const p of e.pieces ?? []) if (!('elements' in p)) p.elements = null;
    return e;
  },
};

export class ErreurMigration extends Error {}

/**
 * Amène une estimation à la version courante du schéma, puis la normalise.
 * Ne modifie pas l'objet reçu.
 */
export function migrer(source, { migrations = MIGRATIONS, versionCible = SCHEMA_VERSION } = {}) {
  let e = structuredClone(source);
  const depart = e?.schemaVersion;
  if (!Number.isInteger(depart) || depart < 1) {
    throw new ErreurMigration('Version de schéma absente ou invalide');
  }
  if (depart > versionCible) {
    throw new ErreurMigration(`Estimation créée avec une version plus récente de l’app (schéma ${depart}). Mettez l’app à jour.`);
  }
  for (let v = depart; v < versionCible; v++) {
    const etape = migrations[v];
    if (!etape) throw new ErreurMigration(`Migration manquante du schéma ${v} vers ${v + 1}`);
    e = etape(e);
    e.schemaVersion = v + 1;
  }
  return versionCible === SCHEMA_VERSION ? normaliserEstimation(e) : e;
}
