// Grille de prix et réglages par défaut.
// Valeurs INDICATIVES en € TTC, fourni-posé par un artisan, France 2025-2026 — à recalibrer avec nos devis et RETEX.
// Chaque estimation garde une copie des réglages utilisés (reproductibilité).

export const REGLAGES_VERSION = 1;

/** États d'une pièce, du meilleur au pire. « bon » ne coûte rien. */
export const ETATS = [
  { id: 'bon', libelle: 'Bon' },
  { id: 'rafraichir', libelle: 'À rafraîchir' },
  { id: 'renover', libelle: 'À rénover' },
  { id: 'refaire', libelle: 'À refaire entièrement' },
];

/** Types de pièce ; `equipement` désigne le forfait applicable (cuisine, salle de bain, WC). */
export const TYPES_PIECES = [
  { id: 'sejour', libelle: 'Séjour' },
  { id: 'chambre', libelle: 'Chambre' },
  { id: 'cuisine', libelle: 'Cuisine', equipement: 'cuisine' },
  { id: 'sdb', libelle: 'Salle de bain', equipement: 'sdb' },
  { id: 'wc', libelle: 'WC', equipement: 'wc' },
  { id: 'entree', libelle: 'Entrée / couloir' },
  { id: 'cellier', libelle: 'Cellier' },
  { id: 'garage', libelle: 'Garage' },
  { id: 'combles', libelle: 'Combles' },
  { id: 'autre', libelle: 'Autre' },
];

/** Niveaux d'équipement et part du forfait appliquée (partiel : réglable). */
export const NIVEAUX_EQUIPEMENT = ['aucun', 'partiel', 'complet'];

/** Unités des gros postes. « m2hab » : la quantité par défaut est la surface habitable. */
export const UNITES = {
  m2hab: '€/m² habitable',
  m2: '€/m²',
  unite: '€/unité',
  forfait: 'forfait',
};

export const FOURCHETTES = ['bas', 'moyen', 'haut'];

const f = (bas, moyen, haut) => ({ bas, moyen, haut });

export const REGLAGES_DEFAUT = gelerProfond({
  version: REGLAGES_VERSION,

  grille: {
    // €/m² de pièce selon l'état
    pieces: {
      rafraichir: f(30, 60, 100),
      renover: f(250, 450, 700),
      refaire: f(700, 1100, 1600),
    },
    // Forfaits d'équipement
    equipements: {
      cuisine: { libelle: 'Cuisine équipée', ...f(4000, 8000, 15000) },
      sdb: { libelle: 'Salle de bain complète', ...f(5000, 9000, 15000) },
      wc: { libelle: 'WC', ...f(1500, 2500, 4000) },
    },
    // Gros postes (l'ordre des clés est l'ordre d'affichage)
    postes: {
      toiture: { libelle: 'Réfection de toiture', unite: 'm2', ...f(120, 180, 250), structurel: true },
      ravalement: { libelle: 'Façade / ravalement', unite: 'm2', ...f(40, 70, 110), structurel: false },
      isolationCombles: { libelle: 'Isolation des combles perdus', unite: 'm2', ...f(25, 40, 60), structurel: false },
      ite: { libelle: 'Isolation des murs par l’extérieur (ITE)', unite: 'm2', ...f(120, 170, 220), structurel: false },
      iti: { libelle: 'Isolation des murs par l’intérieur (ITI)', unite: 'm2', ...f(35, 55, 85), structurel: false },
      menuiseries: { libelle: 'Fenêtre PVC double vitrage', unite: 'unite', ...f(500, 800, 1200), structurel: false },
      electricite: { libelle: 'Électricité complète', unite: 'm2hab', ...f(80, 110, 150), structurel: false },
      plomberie: { libelle: 'Plomberie complète', unite: 'm2hab', ...f(60, 90, 130), structurel: false },
      pac: { libelle: 'Chauffage : PAC air-eau', unite: 'forfait', ...f(10000, 14000, 18000), structurel: false },
      chaudiereGaz: { libelle: 'Chauffage : chaudière gaz', unite: 'forfait', ...f(4000, 5500, 7000), structurel: false },
      poele: { libelle: 'Chauffage : poêle (bois ou granulés)', unite: 'forfait', ...f(2500, 4000, 6000), structurel: false },
      radiateurs: { libelle: 'Chauffage : radiateur électrique', unite: 'unite', ...f(300, 600, 1000), structurel: false },
      vmc: { libelle: 'VMC', unite: 'forfait', ...f(800, 1500, 3000), structurel: false },
      assainissement: { libelle: 'Assainissement individuel', unite: 'forfait', ...f(6000, 9000, 12000), structurel: false },
      murPorteur: { libelle: 'Ouverture mur porteur + IPN (avec bureau d’études)', unite: 'forfait', ...f(3000, 5000, 8000), structurel: true },
      demolition: { libelle: 'Démolition / évacuation', unite: 'm2hab', ...f(15, 30, 50), structurel: false },
      divers: { libelle: 'Divers', unite: 'forfait', ...f(0, 0, 0), structurel: false },
    },
  },

  // Mode « Nous-mêmes » : part du prix artisan correspondant aux matériaux seuls.
  coefMateriaux: { pieces: 0.4, equipements: 0.4, postes: 0.4 },
  // Équipement « partiel » : part du forfait complet.
  coefEquipementPartiel: 0.5,

  aleas: 0.15,
  // Dommages-ouvrage : % des travaux (hors aléas par défaut), si au moins un poste est structurel.
  dommagesOuvrage: { taux: 0.04, inclureAleas: false },

  // Frais et fiscalité — À VÉRIFIER CHAQUE ANNÉE
  anneeReference: 2026,
  fraisAcquisition: { RP: 0.075, MDB: 0.025 },
  fraisAgenceRevente: 0.05,
  // Indemnités de remboursement anticipé : min(6 mois d'intérêts, 3 % du capital restant dû).
  ira: { moisInterets: 6, plafondCapital: 0.03 },
  // Régime MDB (hors périmètre v1, conservé pour la suite)
  fiscaliteMDB: { isTauxReduit: 0.15, isSeuil: 42500, isTauxNormal: 0.25, flatTax: 0.314 },

  objectifs: { margeCible: 0.20, seuilAlerte: 0.10 },
  scenarios: { abattementRevente: 0.05, moisSupplementaires: 3 },
});

function gelerProfond(o) {
  for (const v of Object.values(o)) if (v && typeof v === 'object') gelerProfond(v);
  return Object.freeze(o);
}

/** Copie profonde et modifiable des réglages par défaut. */
export function reglagesParDefaut() {
  return structuredClone(REGLAGES_DEFAUT);
}
