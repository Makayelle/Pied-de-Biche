// Magasin des estimations. J3 : en mémoire (perdu à la fermeture de l'app).
// J4 : même interface, adossée à IndexedDB.
import { creerEstimation } from './schema.js';

const estimations = new Map();

export function creer() {
  const e = creerEstimation();
  estimations.set(e.id, e);
  return e;
}

export function obtenir(id) {
  return estimations.get(id) ?? null;
}

export function enregistrer(e) {
  e.modifieLe = new Date().toISOString();
  estimations.set(e.id, e);
}

export function lister() {
  return [...estimations.values()].sort((a, b) => b.modifieLe.localeCompare(a.modifieLe));
}
