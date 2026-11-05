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
    // Équipements (cuisine, salle de bain, WC). Le prix « complet » se décompose en trois parts :
    //   électroménager ou sanitaires + mobilier : prix d'ACHAT des éléments, payés plein tarif dans les deux modes ;
    //   pose et raccordements : fourni-posé artisan ; en « Nous-mêmes », seule la part fournitures
    //   (coefMateriaux.pose, par pièce) est comptée.
    // En « partiel », on coche les éléments à acheter (sans pose).
    // `groupe` : éléments exclusifs (une seule cuvette de WC) ; pour le « complet », on compte le plus cher.
    equipements: {
      cuisine: {
        libelle: 'Cuisine équipée',
        elements: {
          plaque: { libelle: 'Plaque de cuisson', categorie: 'electromenager', ...f(250, 450, 900) },
          four: { libelle: 'Four', categorie: 'electromenager', ...f(250, 450, 900) },
          hotte: { libelle: 'Hotte', categorie: 'electromenager', ...f(120, 300, 700) },
          refrigerateur: { libelle: 'Réfrigérateur', categorie: 'electromenager', ...f(350, 700, 1500) },
          congelateur: { libelle: 'Congélateur', categorie: 'electromenager', ...f(250, 450, 800) },
          laveVaisselle: { libelle: 'Lave-vaisselle', categorie: 'electromenager', ...f(300, 500, 900) },
          microOndes: { libelle: 'Micro-ondes', categorie: 'electromenager', ...f(80, 150, 350) },
          laveLinge: { libelle: 'Lave-linge', categorie: 'electromenager', ...f(300, 500, 900) },
          meubles: { libelle: 'Meubles et plan de travail', categorie: 'mobilier', ...f(1500, 3000, 6000) },
        },
        // Complet artisan : 4 000 / 8 000 / 15 000 €.
        pose: f(600, 1500, 2050),
      },
      sdb: {
        libelle: 'Salle de bain complète',
        elements: {
          douche: { libelle: 'Douche (receveur, paroi, colonne)', categorie: 'sanitaire', ...f(400, 900, 2000) },
          baignoire: { libelle: 'Baignoire', categorie: 'sanitaire', ...f(250, 600, 1500) },
          robinetterie: { libelle: 'Robinetterie', categorie: 'sanitaire', ...f(100, 250, 600) },
          secheServiettes: { libelle: 'Sèche-serviettes', categorie: 'sanitaire', ...f(150, 350, 800) },
          meubleVasque: { libelle: 'Meuble vasque et miroir', categorie: 'mobilier', ...f(250, 600, 1500) },
        },
        // Complet artisan : 5 000 / 9 000 / 15 000 € (pose : carrelage, étanchéité, plomberie compris).
        pose: f(3850, 6300, 8600),
      },
      wc: {
        libelle: 'WC',
        elements: {
          cuvette: { libelle: 'WC à poser', categorie: 'sanitaire', groupe: 'cuvette', ...f(150, 300, 600) },
          suspendu: { libelle: 'WC suspendu (avec bâti)', categorie: 'sanitaire', groupe: 'cuvette', ...f(400, 700, 1200) },
          laveMains: { libelle: 'Lave-mains', categorie: 'sanitaire', ...f(100, 250, 500) },
        },
        // Complet artisan (WC suspendu) : 1 500 / 2 500 / 4 000 €.
        pose: f(1000, 1550, 2300),
      },
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
  // `pose` : part fournitures de la pose et des raccordements des équipements, par pièce.
  coefMateriaux: { pieces: 0.4, postes: 0.4, pose: { cuisine: 0.2, sdb: 0.4, wc: 0.3 } },
  // Équipement « partiel » sans élément choisi (estimations antérieures à la v0.8.0) : part du complet.
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

/** Catégories d'éléments d'équipement, dans l'ordre d'affichage. */
export const CATEGORIES_ELEMENTS = [
  { id: 'electromenager', libelle: 'Électroménager' },
  { id: 'sanitaire', libelle: 'Sanitaires' },
  { id: 'mobilier', libelle: 'Mobilier' },
];

/** Groupes d'éléments exclusifs (un seul choix possible). */
export const GROUPES_ELEMENTS = { cuvette: 'Cuvette' };

/**
 * Prix d'achat d'une liste d'éléments pour une fourchette.
 * Dans un groupe exclusif, seul l'élément le plus cher est compté (jamais deux cuvettes).
 */
export function prixElements(equipement, cles, f) {
  let total = 0;
  const groupes = new Map();
  for (const cle of cles) {
    const el = equipement.elements?.[cle];
    const prix = Number(el?.[f]);
    if (!el || !Number.isFinite(prix) || prix <= 0) continue;
    if (el.groupe) groupes.set(el.groupe, Math.max(groupes.get(el.groupe) ?? 0, prix));
    else total += prix;
  }
  for (const prix of groupes.values()) total += prix;
  return total;
}

/**
 * Met un équipement au format actuel (v0.8.1) : éléments par défaut manquants, catégories,
 * groupes et part « pose ». Un ancien forfait complet est conservé : la pose devient ce qui
 * reste une fois les éléments payés. Ne modifie jamais un prix existant. Modifie `eq`.
 */
export function completerEquipement(eq, type) {
  const defaut = REGLAGES_DEFAUT.grille.equipements[type];
  eq.elements ??= {};
  for (const [cle, el] of Object.entries(defaut.elements)) {
    const cible = eq.elements[cle];
    if (!cible) { eq.elements[cle] = structuredClone(el); continue; }
    cible.categorie ??= el.categorie;
    if (el.groupe) cible.groupe ??= el.groupe;
  }
  if (!eq.pose) {
    const ancienForfait = FOURCHETTES.every((f) => typeof eq[f] === 'number');
    const tous = Object.keys(eq.elements);
    eq.pose = ancienForfait
      ? Object.fromEntries(FOURCHETTES.map((f) => [f, Math.max(0, eq[f] - prixElements(eq, tous, f))]))
      : structuredClone(defaut.pose);
  }
  for (const f of FOURCHETTES) delete eq[f];
  return eq;
}

/**
 * Complète des réglages enregistrés par une version antérieure (éléments d'équipement,
 * part pose, coefficients de pose par pièce). Ne modifie jamais un prix existant.
 */
export function completerReglages(r) {
  for (const type of Object.keys(REGLAGES_DEFAUT.grille.equipements)) {
    const eq = r?.grille?.equipements?.[type];
    if (eq) completerEquipement(eq, type);
  }
  if (r?.coefMateriaux) {
    r.coefMateriaux.pose ??= structuredClone(REGLAGES_DEFAUT.coefMateriaux.pose);
    // Ancien coefficient unique des équipements, remplacé par les coefficients de pose.
    delete r.coefMateriaux.equipements;
  }
  return r;
}

/** Copie profonde et modifiable des réglages par défaut. */
export function reglagesParDefaut() {
  return structuredClone(REGLAGES_DEFAUT);
}
