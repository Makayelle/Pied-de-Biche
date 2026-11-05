// Modèle de données d'une estimation. Toute évolution passe par une migration (js/data/migrations.js, jalon J4).
import { reglagesParDefaut, REGLAGES_DEFAUT } from '../calc/defaults.js';

export const SCHEMA_VERSION = 4;

/** Modes de saisie : rapide (une page, « à la louche ») ou détaillé (pièces, postes, financement). */
export const MODES = ['rapide', 'detaille'];

/** Identifiant court, unique en pratique. */
export function nouvelId(prefixe = 'e') {
  const alea = new Uint32Array(2);
  globalThis.crypto.getRandomValues(alea);
  return `${prefixe}${Date.now().toString(36)}${alea[0].toString(36)}${alea[1].toString(36).slice(0, 3)}`;
}

/** Estimation vierge, avec une copie des réglages courants. */
export function creerEstimation({ reglages = reglagesParDefaut(), maintenant = new Date(), mode = 'detaille' } = {}) {
  const date = maintenant.toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: nouvelId('e'),
    creeLe: date,
    modifieLe: date,
    archive: false,
    regime: 'RP',
    mode,

    bien: {
      adresse: '', commune: '', type: 'maison', anneeConstruction: null,
      surfaceHabitable: null, surfaceTerrain: null, nbPieces: null, nbNiveaux: null,
      dpe: 'inconnu', ges: 'inconnu', source: 'agence', contact: '',
      prixAffiche: null, prixAchat: null,
      // Estimation rapide : état général du bien et mode de réalisation global.
      etatGeneral: 'renover', modeGeneral: 'artisan',
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
  };
}

/** Copie d'une estimation (nouvel identifiant), pour comparer deux hypothèses. */
export function copierEstimation(source, { maintenant = new Date() } = {}) {
  const copie = structuredClone(source);
  const date = maintenant.toISOString();
  copie.id = nouvelId('e');
  copie.creeLe = date;
  copie.modifieLe = date;
  copie.archive = false;
  copie.bien.adresse = source.bien.adresse ? `${source.bien.adresse} (copie)` : '(copie)';
  for (const p of copie.pieces) p.id = nouvelId('p');
  return copie;
}

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Complète récursivement `cible` avec les clés manquantes de `modele` (sans écraser l'existant). */
function completer(cible, modele) {
  for (const [cle, valeur] of Object.entries(modele)) {
    if (!(cle in cible)) cible[cle] = structuredClone(valeur);
    else if (estObjet(valeur) && estObjet(cible[cle])) completer(cible[cle], valeur);
  }
  return cible;
}

/**
 * Normalise une estimation déjà migrée : ajoute les champs manquants (valeurs par défaut),
 * complète les pièces et ajoute les gros postes absents de la liste.
 */
export function normaliserEstimation(e) {
  // Les réglages d'une estimation ne sont JAMAIS convertis : elle garde sa grille d'origine
  // (ancien forfait d'équipement compris) jusqu'à un « Recalculer avec les réglages actuels ».
  e.reglages ??= reglagesParDefaut();
  const modele = creerEstimation({ reglages: e.reglages });
  delete modele.id;
  completer(e, modele);
  e.pieces = e.pieces.map((p) => completer(p, { ...creerPiece(p.type ?? 'autre'), id: p.id ?? nouvelId('p') }));
  for (const cle of Object.keys(e.reglages.grille.postes)) {
    if (!e.postes.some((p) => p.cle === cle)) e.postes.push(creerPoste(cle, e.reglages.grille.postes[cle]));
  }
  return e;
}

export function creerPiece(type = 'sejour') {
  return {
    id: nouvelId('p'), nom: '', type, surface: null, etat: 'rafraichir',
    // Équipement « partiel » : clés des éléments à acheter (cf. grille.equipements.<type>.elements).
    equipement: 'aucun', elements: [], mode: 'artisan', note: '',
  };
}

export function creerPoste(cle, def = REGLAGES_DEFAUT.grille.postes[cle]) {
  return { cle, actif: false, quantite: null, mode: 'artisan', structurel: Boolean(def?.structurel), prix: null };
}
