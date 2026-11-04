// Moteur de calcul de Pied-de-Biche — fonctions PURES, sans DOM.
// Entrée : une estimation (cf. js/data/schema.js) et ses réglages. Sortie : un objet de résultats.
// Montants en euros, non arrondis : l'arrondi est fait à l'affichage.

import { FOURCHETTES, TYPES_PIECES, REGLAGES_DEFAUT } from './defaults.js';

/** Convertit une saisie en nombre fini ≥ 0 (champ vide ou invalide → 0). */
export function n(v) {
  const x = typeof v === 'string' ? Number(v.replace(',', '.').replace(/\s/g, '')) : Number(v);
  return Number.isFinite(x) && x > 0 ? x : 0;
}

const parFourchette = (fn) => Object.fromEntries(FOURCHETTES.map((f) => [f, fn(f)]));
const somme = (lignes, f) => lignes.reduce((t, l) => t + l[f], 0);
const coefMode = (mode, categorie, reglages) => (mode === 'nous' ? reglages.coefMateriaux[categorie] : 1);

// ---------------------------------------------------------------------------
// 7.1 Travaux
// ---------------------------------------------------------------------------

/**
 * Coût de l'équipement d'une pièce pour une fourchette.
 * - complet : forfait de la grille (fourni-posé, coefficient « Nous-mêmes » appliqué) ;
 * - partiel avec éléments cochés : somme des prix d'achat des éléments (sans coefficient) ;
 * - partiel sans liste (estimations antérieures à la v0.8.0) : part réglable du forfait.
 */
export function coutEquipement(piece, reglages, f) {
  const typeEquip = TYPES_PIECES.find((t) => t.id === piece.type)?.equipement;
  const forfait = typeEquip ? reglages.grille.equipements[typeEquip] : null;
  if (!forfait || piece.equipement === 'aucun') return 0;
  const coef = coefMode(piece.mode, 'equipements', reglages);
  if (piece.equipement === 'complet') return forfait[f] * coef;
  if (Array.isArray(piece.elements)) {
    const elements = forfait.elements ?? REGLAGES_DEFAUT.grille.equipements[typeEquip].elements;
    return piece.elements.reduce((t, cle) => t + n(elements[cle]?.[f]), 0);
  }
  return forfait[f] * reglages.coefEquipementPartiel * coef;
}

/** Coût d'une pièce pour chaque fourchette : surface × prix au m² de l'état + équipement. */
export function coutPiece(piece, reglages) {
  const prixEtat = reglages.grille.pieces[piece.etat]; // undefined pour « bon »
  return parFourchette((f) => {
    const surface = prixEtat ? n(piece.surface) * prixEtat[f] * coefMode(piece.mode, 'pieces', reglages) : 0;
    return surface + coutEquipement(piece, reglages, f);
  });
}

/** Quantité effective d'un poste (les postes « au m² habitable » prennent la surface du bien par défaut). */
export function quantitePoste(poste, def, bien) {
  if (poste.quantite != null && poste.quantite !== '') return n(poste.quantite);
  if (def.unite === 'm2hab') return n(bien.surfaceHabitable);
  if (def.unite === 'forfait') return 1;
  return 0;
}

/** Coût d'un gros poste : quantité × prix unitaire (prix personnalisé prioritaire sur la grille). */
export function coutPoste(poste, bien, reglages) {
  const def = reglages.grille.postes[poste.cle];
  if (!poste.actif || !def) return parFourchette(() => 0);
  const q = quantitePoste(poste, def, bien);
  const coef = coefMode(poste.mode, 'postes', reglages);
  return parFourchette((f) => q * n(poste.prix?.[f] ?? def[f]) * coef);
}

/** Détail et totaux des travaux, en fourchettes basse / moyenne / haute. */
export function calculerTravaux(estimation) {
  const { reglages, bien } = estimation;

  const lignes = estimation.mode === 'rapide' ? lignesRapides(estimation) : [
    ...estimation.pieces.map((p) => ({
      id: p.id, categorie: 'piece',
      libelle: p.nom || TYPES_PIECES.find((t) => t.id === p.type)?.libelle || 'Pièce',
      ...coutPiece(p, reglages),
    })),
    ...estimation.postes.filter((p) => p.actif).map((p) => ({
      id: p.cle, categorie: 'poste', structurel: Boolean(p.structurel),
      libelle: reglages.grille.postes[p.cle]?.libelle ?? p.cle,
      ...coutPoste(p, bien, reglages),
    })),
  ];

  const sousTotal = parFourchette((f) => somme(lignes, f));
  const aleas = parFourchette((f) => sousTotal[f] * reglages.aleas);
  const total = parFourchette((f) => sousTotal[f] + aleas[f]);

  // Dommages-ouvrage : automatique si un poste actif est structurel, ou forcé « oui » / « non ».
  const choixDO = estimation.travaux?.dommagesOuvrage ?? 'auto';
  const doActive = choixDO === 'oui' || (choixDO === 'auto' && lignes.some((l) => l.structurel));
  const { taux, inclureAleas } = reglages.dommagesOuvrage;
  const dommagesOuvrage = parFourchette((f) => (doActive ? (inclureAleas ? total[f] : sousTotal[f]) * taux : 0));

  return { lignes, sousTotal, aleas, total, dommagesOuvrage, dommagesOuvrageActive: doActive };
}

/**
 * Estimation rapide : une seule ligne, surface habitable × prix au m² de l'état général
 * (grille des pièces), avec le coefficient matériaux si « Nous-mêmes ».
 */
function lignesRapides(estimation) {
  const { bien, reglages } = estimation;
  const prix = reglages.grille.pieces[bien.etatGeneral];
  if (!prix) return [];
  const surface = n(bien.surfaceHabitable);
  const coef = coefMode(bien.modeGeneral, 'pieces', reglages);
  return [{
    id: 'global', categorie: 'global', libelle: 'Rénovation globale',
    ...parFourchette((f) => surface * prix[f] * coef),
  }];
}

// ---------------------------------------------------------------------------
// 7.2 Coût de revient
// ---------------------------------------------------------------------------

/** Coût du financement sur la durée de portage (intérêts simplifiés : capital × taux × durée). */
export function coutFinancement(financement, dureeMois, regime, reglages) {
  const capital = n(financement.emprunt);
  const taux = n(financement.tauxAnnuel);
  const interets = capital * taux * (dureeMois / 12);
  const assurance = capital * n(financement.assuranceTauxAnnuel) * (dureeMois / 12);
  const frais = n(financement.fraisDossier) + n(financement.fraisGarantie);
  // IRA : uniquement en RP (prêt immobilier classique), plafonnées légalement.
  const ira = regime === 'RP' && financement.ira !== false
    ? Math.min(capital * taux * (reglages.ira.moisInterets / 12), capital * reglages.ira.plafondCapital)
    : 0;
  return { interets, assurance, frais, ira, total: interets + assurance + frais + ira };
}

/** Prix d'achat retenu : le prix négocié s'il est saisi, sinon le prix affiché. */
export function prixAchatEffectif(estimation) {
  return n(estimation.bien.prixAchat) || n(estimation.bien.prixAffiche);
}

/** Coûts de portage sur la durée. */
export function coutPortage(portage, dureeMois) {
  const taxeFonciere = n(portage.taxeFonciereAnnuelle) * (dureeMois / 12);
  const assurance = n(portage.assuranceAnnuelle) * (dureeMois / 12);
  const energie = n(portage.energieMensuelle) * dureeMois;
  const copropriete = n(portage.coproMensuelle) * dureeMois;
  return { taxeFonciere, assurance, energie, copropriete, total: taxeFonciere + assurance + energie + copropriete };
}

// ---------------------------------------------------------------------------
// 7.3 Revente
// ---------------------------------------------------------------------------

/** Prix de revente de base (saisi, ou prix au m² du secteur × surface habitable). */
export function prixReventeBase(estimation) {
  const { revente, bien } = estimation;
  return revente.mode === 'm2' ? n(revente.prixM2) * n(bien.surfaceHabitable) : n(revente.prix);
}

export function fraisVente(revente, prix, regime) {
  const agence = prix * n(revente.fraisAgencePct);
  const diagnostics = n(revente.diagnostics);
  const demenagement = regime === 'RP' ? n(revente.demenagement) : 0;
  return { agence, diagnostics, demenagement, total: agence + diagnostics + demenagement };
}

// ---------------------------------------------------------------------------
// 7.4 Marges — 7.6 Scénarios
// ---------------------------------------------------------------------------

/** Marge nette selon le régime. v1 : RP uniquement (plus-value exonérée → nette = brute). */
export function margeNette(margeBrute, regime) {
  if (regime === 'RP') return margeBrute;
  throw new Error(`Régime « ${regime} » non pris en charge dans cette version`);
}

/** Paramètres des trois scénarios (§7.6). */
export function parametresScenarios(estimation) {
  const { scenarios } = estimation.reglages;
  const duree = n(estimation.financement.dureeMois);
  const prix = prixReventeBase(estimation);
  return {
    optimiste: { fourchette: 'bas', prixRevente: prix, dureeMois: duree },
    central: { fourchette: 'moyen', prixRevente: prix, dureeMois: duree },
    pessimiste: {
      fourchette: 'haut',
      prixRevente: prix * (1 - scenarios.abattementRevente),
      dureeMois: duree + scenarios.moisSupplementaires,
    },
  };
}

/**
 * Calcule un scénario. `prixAchat` peut être forcé (utilisé par le calcul inverse du prix maximum).
 */
export function calculerScenario(estimation, params, travaux = calculerTravaux(estimation), prixAchat = prixAchatEffectif(estimation)) {
  const { reglages, regime } = estimation;
  // Estimation rapide : ni financement ni portage (ordre de grandeur « à la louche »).
  const rapide = estimation.mode === 'rapide';
  const financement = rapide ? {} : estimation.financement;
  const { fourchette, prixRevente, dureeMois } = params;

  const acquisition = prixAchat * reglages.fraisAcquisition[regime];
  const agenceAcquereur = n(financement.fraisAgenceAcquereur);
  const coutTravaux = travaux.total[fourchette];
  const dommagesOuvrage = travaux.dommagesOuvrage[fourchette];
  const fin = coutFinancement(financement, dureeMois, regime, reglages);
  const port = coutPortage(rapide ? {} : estimation.portage, dureeMois);

  const coutRevient = prixAchat + acquisition + agenceAcquereur + coutTravaux + dommagesOuvrage + fin.total + port.total;
  const vente = fraisVente(rapide ? { fraisAgencePct: estimation.revente.fraisAgencePct } : estimation.revente, prixRevente, regime);
  const margeBrute = prixRevente - vente.total - coutRevient;
  const nette = margeNette(margeBrute, regime);

  const apport = n(financement.apport);
  const rendementApport = apport > 0 ? nette / apport : null;

  return {
    ...params,
    detail: {
      prixAchat, fraisAcquisition: acquisition, fraisAgenceAcquereur: agenceAcquereur,
      travaux: coutTravaux, dommagesOuvrage, financement: fin, portage: port, fraisVente: vente,
    },
    coutRevient,
    margeBrute,
    margeNette: nette,
    pctCoutRevient: coutRevient > 0 ? nette / coutRevient : null,
    pctRevente: prixRevente > 0 ? nette / prixRevente : null,
    rendementApport,
    rendementAnnualise: rendementApport != null && dureeMois > 0 && rendementApport > -1
      ? (1 + rendementApport) ** (12 / dureeMois) - 1
      : null,
    // Positif : il manque ce montant pour boucler le plan de financement.
    resteAFinancer: coutRevient - apport - n(financement.emprunt),
  };
}

/**
 * Prix d'achat maximum pour atteindre la marge cible (en % du coût de revient) — calcul inverse.
 * Résolu par dichotomie pour rester valable quand la fiscalité deviendra non linéaire (MDB).
 * Renvoie null si la cible est inatteignable même à prix nul.
 */
export function prixAchatMax(estimation, params, travaux = calculerTravaux(estimation)) {
  const cible = estimation.reglages.objectifs.margeCible;
  const ecart = (p) => {
    const s = calculerScenario(estimation, params, travaux, p);
    return s.margeNette - cible * s.coutRevient; // décroissant avec p
  };
  if (params.prixRevente <= 0 || ecart(0) < 0) return null;
  let bas = 0;
  let haut = params.prixRevente;
  while (ecart(haut) > 0) haut *= 2;
  for (let i = 0; i < 100 && haut - bas > 0.005; i++) {
    const milieu = (bas + haut) / 2;
    if (ecart(milieu) >= 0) bas = milieu; else haut = milieu;
  }
  return bas;
}

/**
 * Budget travaux maximum (aléas et dommages-ouvrage compris) pour atteindre la marge cible
 * au prix d'achat retenu. Peut être négatif : le prix d'achat seul empêche déjà la cible.
 * RP : marge nette = marge brute, donc la relation est linéaire.
 */
export function budgetTravauxMax(estimation, scenario) {
  const cible = estimation.reglages.objectifs.margeCible;
  if (scenario.prixRevente <= 0) return null;
  const coutRevientCible = (scenario.prixRevente - scenario.detail.fraisVente.total) / (1 + cible);
  const horsTravaux = scenario.coutRevient - scenario.detail.travaux - scenario.detail.dommagesOuvrage;
  return coutRevientCible - horsTravaux;
}

/** Verdict de la pastille : 'ok' (vert), 'vigilance' (orange), 'alerte' (rouge) ou 'incomplet'. */
export function verdict(pctCoutRevient, objectifs) {
  if (pctCoutRevient == null) return 'incomplet';
  if (pctCoutRevient >= objectifs.margeCible) return 'ok';
  if (pctCoutRevient >= objectifs.seuilAlerte) return 'vigilance';
  return 'alerte';
}

/** Point d'entrée : tous les résultats d'une estimation. */
export function calculerEstimation(estimation) {
  const travaux = calculerTravaux(estimation);
  const params = parametresScenarios(estimation);
  const avecRevente = prixReventeBase(estimation) > 0;
  const complet = prixAchatEffectif(estimation) > 0 && avecRevente;

  const scenarios = {};
  for (const [nom, p] of Object.entries(params)) {
    const s = calculerScenario(estimation, p, travaux);
    scenarios[nom] = { ...s, verdict: complet ? verdict(s.pctCoutRevient, estimation.reglages.objectifs) : 'incomplet' };
  }

  const heures = n(estimation.travaux?.heuresEstimees);
  return {
    complet,
    travaux,
    scenarios,
    prixAchatRetenu: prixAchatEffectif(estimation),
    prixNegocie: n(estimation.bien.prixAchat) > 0,
    // Préconisations : utiles même sans prix d'achat (seule la revente est nécessaire).
    prixAchatMax: avecRevente ? prixAchatMax(estimation, params.central, travaux) : null,
    prixAchatMaxPrudent: avecRevente ? prixAchatMax(estimation, params.pessimiste, travaux) : null,
    budgetTravauxMax: complet ? budgetTravauxMax(estimation, scenarios.central) : null,
    remunerationHoraire: heures > 0 ? scenarios.central.margeNette / heures : null,
  };
}
