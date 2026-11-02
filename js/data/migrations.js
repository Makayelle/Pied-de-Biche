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
