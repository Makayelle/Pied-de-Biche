// Modèle de données d'une estimation. Toute évolution passe par une migration (js/data/migrations.js, jalon J4).
import { reglagesParDefaut, REGLAGES_DEFAUT } from '../calc/defaults.js';

export const SCHEMA_VERSION = 1;

/** Identifiant court, unique en pratique. */
export function nouvelId(prefixe = 'e') {
  const alea = new Uint32Array(2);
  globalThis.crypto.getRandomValues(alea);
  return `${prefixe}${Date.now().toString(36)}${alea[0].toString(36)}${alea[1].toString(36).slice(0, 3)}`;
}

/** Estimation vierge, avec une copie des réglages courants. */
export function creerEstimation({ reglages = reglagesParDefaut(), maintenant = new Date() } = {}) {
  const date = maintenant.toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: nouvelId('e'),
    creeLe: date,
    modifieLe: date,
    archive: false,
    regime: 'RP',

    bien: {
      adresse: '', commune: '', type: 'maison', anneeConstruction: null,
      surfaceHabitable: null, surfaceTerrain: null, nbPieces: null, nbNiveaux: null,
      dpe: 'inconnu', source: 'agence', contact: '',
      prixAffiche: null, prixAchat: null,
      notes: '',
    },

    pieces: [],
    postes: Object.entries(reglages.grille.postes).map(([cle, p]) => creerPoste(cle, p)),

    financement: {
      apport: null, emprunt: null, tauxAnnuel: null, assuranceTauxAnnuel: null,
      fraisDossier: null, fraisGarantie: null, ira: true,
      fraisAgenceAcquereur: null,
      dureeMois: 6,
    },
    portage: { taxeFonciereAnnuelle: null, assuranceAnnuelle: null, energieMensuelle: null, coproMensuelle: null },
    revente: {
      mode: 'saisi', prix: null, prixM2: null,
      fraisAgencePct: reglages.fraisAgenceRevente, diagnostics: null, demenagement: null,
    },
    travaux: { heuresEstimees: null, dommagesOuvrage: 'auto' },

    reglages,
    photos: [],
  };
}

export function creerPiece(type = 'sejour') {
  return {
    id: nouvelId('p'), nom: '', type, surface: null, etat: 'rafraichir',
    equipement: 'aucun', mode: 'artisan', note: '',
  };
}

export function creerPoste(cle, def = REGLAGES_DEFAUT.grille.postes[cle]) {
  return { cle, actif: false, quantite: null, mode: 'artisan', structurel: Boolean(def?.structurel), prix: null };
}
