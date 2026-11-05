// Tests du moteur de calcul. Le cas « RP de référence » est calculé à la main ci-dessous :
// chaque attendu est accompagné de son calcul pour pouvoir être revérifié.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  n, coutPiece, budgetTravauxMax, prixAchatEffectif, coutPoste, quantitePoste, calculerTravaux, coutFinancement, coutPortage,
  prixReventeBase, fraisVente, calculerScenario, parametresScenarios, prixAchatMax,
  verdict, calculerEstimation, margeNette,
} from '../js/calc/engine.js';
import { reglagesParDefaut, completerReglages, REGLAGES_DEFAUT } from '../js/calc/defaults.js';
import { creerEstimation, creerPiece, SCHEMA_VERSION } from '../js/data/schema.js';

const proche = (reel, attendu, msg, tol = 0.01) =>
  assert.ok(Math.abs(reel - attendu) <= tol, `${msg ?? ''} attendu ${attendu}, obtenu ${reel}`);

/**
 * Cas de référence RP — maison de 100 m² achetée 150 000 €.
 *   Pièces : séjour 30 m² à rénover (artisan) ; cuisine 12 m² à refaire + équipement complet (nous-mêmes :
 *            éléments plein tarif, pose à 20 %) ;
 *            salle de bain 6 m² à rafraîchir + équipement partiel sans élément choisi, soit 50 % du forfait (artisan) ;
 *            chambre 12 m² en bon état.
 *   Postes : électricité complète (100 m² hab., artisan) ; 6 fenêtres (nous-mêmes) ; mur porteur (artisan, structurel).
 *   Financement : apport 50 000, emprunt 180 000 à 3,6 %, assurance 0,3 %/an, dossier 1 000, garantie 2 000, IRA.
 *   Portage 9 mois : TF 1 200 €/an, assurance 360 €/an, énergie 100 €/mois.
 *   Revente 290 000 €, agence 5 %, diagnostics 500 €, déménagement 1 000 €. 400 heures de travail.
 */
function casReference() {
  const e = creerEstimation({ maintenant: new Date('2026-11-01T10:00:00Z') });
  e.bien.surfaceHabitable = 100;
  e.bien.prixAchat = 150000;
  e.pieces = [
    { ...creerPiece('sejour'), surface: 30, etat: 'renover', mode: 'artisan' },
    { ...creerPiece('cuisine'), surface: 12, etat: 'refaire', equipement: 'complet', mode: 'nous' },
    { ...creerPiece('sdb'), surface: 6, etat: 'rafraichir', equipement: 'partiel', elements: null, mode: 'artisan' },
    { ...creerPiece('chambre'), surface: 12, etat: 'bon' },
  ];
  const poste = (cle) => e.postes.find((p) => p.cle === cle);
  Object.assign(poste('electricite'), { actif: true, mode: 'artisan' });
  Object.assign(poste('menuiseries'), { actif: true, quantite: 6, mode: 'nous' });
  Object.assign(poste('murPorteur'), { actif: true, mode: 'artisan' });
  Object.assign(e.financement, {
    apport: 50000, emprunt: 180000, tauxAnnuel: 0.036, assuranceTauxAnnuel: 0.003,
    fraisDossier: 1000, fraisGarantie: 2000, ira: true, fraisAgenceAcquereur: 0, dureeMois: 9,
  });
  Object.assign(e.portage, { taxeFonciereAnnuelle: 1200, assuranceAnnuelle: 360, energieMensuelle: 100, coproMensuelle: 0 });
  Object.assign(e.revente, { mode: 'saisi', prix: 290000, fraisAgencePct: 0.05, diagnostics: 500, demenagement: 1000 });
  e.travaux.heuresEstimees = 400;
  return e;
}

describe('cas de référence RP (calculé à la main)', () => {
  const e = casReference();
  const r = calculerEstimation(e);
  const c = r.scenarios.central;

  test('travaux fourchette moyenne', () => {
    // séjour      30 × 450                         = 13 500
    // cuisine     12 × 1 100 × 0,4                  =  5 280
    //             + éléments 6 500 + pose 1 500 × 0,2 =  6 800
    // sdb          6 × 60 + 9 000 × 0,5             =  4 860
    // chambre     bon état                          =      0
    // électricité 100 × 110                         = 11 000
    // fenêtres    6 × 800 × 0,4                     =  1 920
    // mur porteur 1 × 5 000                         =  5 000
    proche(r.travaux.sousTotal.moyen, 48360, 'sous-total');
    proche(r.travaux.aleas.moyen, 7254, 'aléas 15 %');
    proche(r.travaux.total.moyen, 55614, 'total avec aléas');
  });

  test('travaux fourchette haute', () => {
    // 30×700 + (12×1600×0,4 + 12 950 + 2 050×0,2) + (6×100 + 15000×0,5) + 100×150 + 6×1200×0,4 + 8000
    // = 21 000 + 21 040 + 8 100 + 15 000 + 2 880 + 8 000 = 76 020
    proche(r.travaux.sousTotal.haut, 76020);
  });

  test('dommages-ouvrage déclenchée par le mur porteur, sur les travaux hors aléas', () => {
    assert.equal(r.travaux.dommagesOuvrageActive, true);
    proche(c.detail.dommagesOuvrage, 1934.40, '4 % × 48 360');
  });

  test('financement : intérêts, assurance, frais et IRA', () => {
    const f = c.detail.financement;
    proche(f.interets, 4860, '180 000 × 3,6 % × 9/12');
    proche(f.assurance, 405, '180 000 × 0,3 % × 9/12');
    proche(f.frais, 3000);
    proche(f.ira, 3240, 'min(6 mois d’intérêts = 3 240, 3 % = 5 400)');
    proche(f.total, 11505);
  });

  test('portage sur 9 mois', () => {
    proche(c.detail.portage.total, 2070, '900 + 270 + 900');
  });

  test('coût de revient', () => {
    // 150 000 + 11 250 (7,5 %) + 0 + 55 614 + 1 934,40 + 11 505 + 2 070
    proche(c.detail.fraisAcquisition, 11250);
    proche(c.coutRevient, 232373.40);
  });

  test('marges et indicateurs du scénario central', () => {
    proche(c.detail.fraisVente.total, 16000, '14 500 + 500 + 1 000');
    proche(c.margeBrute, 41626.60, '290 000 − 16 000 − 232 373,40');
    proche(c.margeNette, 41626.60, 'RP : nette = brute');
    proche(c.pctCoutRevient, 41626.60 / 232373.40, '', 1e-9);
    proche(c.pctRevente, 41626.60 / 290000, '', 1e-9);
    proche(c.rendementApport, 0.832532, '', 1e-6);
    proche(c.rendementAnnualise, 1.832532 ** (12 / 9) - 1, '', 1e-6);
    proche(c.resteAFinancer, 232373.40 - 230000);
    assert.equal(c.verdict, 'vigilance', '10 % ≤ 17,91 % < 20 %');
  });

  test('rémunération horaire implicite', () => {
    proche(r.remunerationHoraire, 41626.60 / 400);
  });

  test('prix d’achat maximum pour 20 % de marge', () => {
    // Coût de revient = P × 1,075 + K, avec K = 232 373,40 − 161 250 = 71 123,40
    // Cible : 274 000 − CR = 0,2 × CR → CR = 228 333,33 → P = (228 333,33 − 71 123,40) / 1,075
    proche(r.prixAchatMax, (274000 / 1.2 - 71123.40) / 1.075, 'prix max');
    proche(r.prixAchatMax, 146241.80);
    // Vérification directe : à ce prix, la marge vaut exactement la cible.
    const s = calculerScenario(e, parametresScenarios(e).central, r.travaux, r.prixAchatMax);
    proche(s.pctCoutRevient, 0.20, '', 1e-6);
  });

  test('scénario pessimiste : travaux hauts, revente −5 %, +3 mois', () => {
    const p = r.scenarios.pessimiste;
    assert.equal(p.fourchette, 'haut');
    proche(p.prixRevente, 275500);
    assert.equal(p.dureeMois, 12);
    proche(p.detail.financement.interets, 180000 * 0.036);
    proche(p.detail.fraisVente.agence, 275500 * 0.05);
  });

  test('ordre des scénarios : optimiste ≥ central ≥ pessimiste', () => {
    const { optimiste, central, pessimiste } = r.scenarios;
    assert.ok(optimiste.margeNette > central.margeNette);
    assert.ok(central.margeNette > pessimiste.margeNette);
  });

  test('le calcul ne modifie pas l’estimation', () => {
    const avant = JSON.stringify(e);
    calculerEstimation(e);
    assert.equal(JSON.stringify(e), avant);
  });
});

describe('travaux', () => {
  const R = reglagesParDefaut();

  test('pièce en bon état sans équipement : 0', () => {
    assert.deepEqual(coutPiece({ type: 'chambre', surface: 20, etat: 'bon', equipement: 'aucun', mode: 'artisan' }, R),
      { bas: 0, moyen: 0, haut: 0 });
  });

  test('forfait WC appliqué (décision §15-1)', () => {
    const c = coutPiece({ type: 'wc', surface: 2, etat: 'bon', equipement: 'complet', mode: 'artisan' }, R);
    assert.deepEqual(c, { bas: 1500, moyen: 2500, haut: 4000 });
  });

  test('pas de forfait d’équipement pour une pièce qui n’en a pas', () => {
    const c = coutPiece({ type: 'chambre', surface: 10, etat: 'rafraichir', equipement: 'complet', mode: 'artisan' }, R);
    assert.deepEqual(c, { bas: 300, moyen: 600, haut: 1000 });
  });

  test('coefficients matériaux distincts : pièces, et pose de chaque équipement', () => {
    const r = reglagesParDefaut();
    r.coefMateriaux.pieces = 0.5;
    r.coefMateriaux.pose.cuisine = 0.25;
    const c = coutPiece({ type: 'cuisine', surface: 10, etat: 'renover', equipement: 'complet', mode: 'nous' }, r);
    // Surface à 50 % ; électroménager 3 500 et mobilier 3 000 plein tarif ; pose 1 500 à 25 %.
    proche(c.moyen, 10 * 450 * 0.5 + 3500 + 3000 + 1500 * 0.25);
  });

  test('complet = éléments (prix d’achat) + pose ; en « Nous-mêmes », seule la pose est réduite', () => {
    const cuisine = { type: 'cuisine', surface: 10, etat: 'bon', equipement: 'complet', mode: 'artisan' };
    assert.deepEqual(coutPiece(cuisine, R), { bas: 4000, moyen: 8000, haut: 15000 });
    // bas 3 400 + 600 × 0,2 · moyen 6 500 + 1 500 × 0,2 · haut 12 950 + 2 050 × 0,2
    const nous = coutPiece({ ...cuisine, mode: 'nous' }, R);
    proche(nous.bas, 3520); proche(nous.moyen, 6800); proche(nous.haut, 13360);
    // Salle de bain (pose à 40 %) et WC (pose à 30 %, une seule cuvette : la suspendue).
    proche(coutPiece({ ...cuisine, type: 'sdb', mode: 'nous' }, R).moyen, 2700 + 6300 * 0.4);
    proche(coutPiece({ ...cuisine, type: 'wc', mode: 'nous' }, R).moyen, 950 + 1550 * 0.3);
  });

  test('équipement partiel : éléments cochés + pose au prorata de leur prix', () => {
    // Cuisine 10 m² en bon état, four + hotte + lave-vaisselle : moyen 450 + 300 + 500 = 1 250
    // sur 6 500 € d'éléments ; pose 1 500 (artisan) ou 1 500 × 0,2 = 300 (nous-mêmes).
    const piece = { type: 'cuisine', surface: 10, etat: 'bon', equipement: 'partiel', elements: ['four', 'hotte', 'laveVaisselle'], mode: 'artisan' };
    proche(coutPiece(piece, R).moyen, 1250 + 1500 * 1250 / 6500);
    proche(coutPiece(piece, R).bas, 670 + 600 * 670 / 3400);
    // En « Nous-mêmes », les appareils restent plein tarif ; seule la pose passe aux fournitures.
    proche(coutPiece({ ...piece, mode: 'nous' }, R).moyen, 1250 + 300 * 1250 / 6500);
  });

  test('équipement partiel tout coché = complet, dans les deux modes', () => {
    for (const type of ['cuisine', 'sdb', 'wc']) {
      const elements = Object.keys(R.grille.equipements[type].elements);
      for (const mode of ['artisan', 'nous']) {
        const base = { type, surface: 5, etat: 'bon', mode };
        const partiel = coutPiece({ ...base, equipement: 'partiel', elements }, R);
        const complet = coutPiece({ ...base, equipement: 'complet' }, R);
        for (const f of ['bas', 'moyen', 'haut']) proche(partiel[f], complet[f], `${type} ${mode} ${f}`);
      }
    }
  });

  test('WC : une seule cuvette comptée, même si les deux sont dans la liste', () => {
    const base = { type: 'wc', surface: 2, etat: 'bon', equipement: 'partiel', mode: 'artisan' };
    assert.deepEqual(coutPiece({ ...base, elements: ['cuvette', 'suspendu'] }, R), coutPiece({ ...base, elements: ['suspendu'] }, R));
  });

  test('équipement partiel sans élément coché : rien à acheter', () => {
    const c = coutPiece({ type: 'sdb', surface: 5, etat: 'bon', equipement: 'partiel', elements: [], mode: 'artisan' }, R);
    assert.deepEqual(c, { bas: 0, moyen: 0, haut: 0 });
  });

  test('équipement partiel d’une estimation antérieure (sans liste) : part du forfait', () => {
    const c = coutPiece({ type: 'wc', surface: 2, etat: 'bon', equipement: 'partiel', elements: null, mode: 'artisan' }, R);
    assert.deepEqual(c, { bas: 750, moyen: 1250, haut: 2000 });
  });

  test('les éléments ne comptent qu’en équipement partiel', () => {
    const c = coutPiece({ type: 'wc', surface: 2, etat: 'bon', equipement: 'complet', elements: ['laveMains'], mode: 'artisan' }, R);
    assert.deepEqual(c, { bas: 1500, moyen: 2500, haut: 4000 });
  });

  test('réglages d’avant la v0.8.0 (forfait unique) : complétés, forfait complet conservé', () => {
    const anciens = reglagesParDefaut();
    const forfaits = { cuisine: [4000, 9999, 15000], sdb: [5000, 9000, 15000], wc: [1500, 2500, 4000] };
    for (const [cle, eq] of Object.entries(anciens.grille.equipements)) {
      delete eq.elements; delete eq.pose;
      [eq.bas, eq.moyen, eq.haut] = forfaits[cle];
    }
    anciens.coefMateriaux = { pieces: 0.4, equipements: 0.4, postes: 0.4 };
    const r = completerReglages(anciens);
    assert.deepEqual(r.grille.equipements.sdb.elements, REGLAGES_DEFAUT.grille.equipements.sdb.elements);
    assert.equal(r.grille.equipements.cuisine.pose.moyen, 9999 - 6500, 'pose = forfait − éléments');
    assert.equal(r.grille.equipements.cuisine.moyen, undefined, 'ancien forfait retiré');
    assert.deepEqual(r.coefMateriaux, { pieces: 0.4, postes: 0.4, pose: REGLAGES_DEFAUT.coefMateriaux.pose });
    const cuisine = { type: 'cuisine', surface: 0, etat: 'bon', equipement: 'complet', mode: 'artisan' };
    assert.equal(coutPiece(cuisine, r).moyen, 9999);
  });

  test('réglages de la v0.8.0 (éléments sans mobilier ni pose) : mobilier ajouté, forfait conservé', () => {
    const v080 = reglagesParDefaut();
    const cuisine = v080.grille.equipements.cuisine;
    delete cuisine.elements.meubles; delete cuisine.pose;
    for (const el of Object.values(cuisine.elements)) delete el.categorie;
    Object.assign(cuisine, { bas: 4000, moyen: 8000, haut: 15000 });
    const r = completerReglages(v080);
    assert.deepEqual(r.grille.equipements.cuisine, REGLAGES_DEFAUT.grille.equipements.cuisine);
  });

  test('le moteur accepte des réglages non complétés, sans les modifier', () => {
    const anciens = reglagesParDefaut();
    const eq = anciens.grille.equipements.wc;
    delete eq.elements; delete eq.pose;
    Object.assign(eq, { bas: 1500, moyen: 2500, haut: 4000 });
    const avant = JSON.stringify(anciens);
    assert.deepEqual(coutPiece({ type: 'wc', surface: 0, etat: 'bon', equipement: 'complet', mode: 'artisan' }, anciens), { bas: 1500, moyen: 2500, haut: 4000 });
    assert.equal(JSON.stringify(anciens), avant);
  });

  test('quantité par défaut des postes', () => {
    const bien = { surfaceHabitable: 85 };
    assert.equal(quantitePoste({ quantite: null }, { unite: 'm2hab' }, bien), 85);
    assert.equal(quantitePoste({ quantite: null }, { unite: 'forfait' }, bien), 1);
    assert.equal(quantitePoste({ quantite: null }, { unite: 'm2' }, bien), 0);
    assert.equal(quantitePoste({ quantite: 40 }, { unite: 'm2hab' }, bien), 40);
    assert.equal(quantitePoste({ quantite: 0 }, { unite: 'forfait' }, bien), 0);
  });

  test('poste inactif : 0 ; prix personnalisé prioritaire (ex. Divers)', () => {
    assert.deepEqual(coutPoste({ cle: 'toiture', actif: false, quantite: 80 }, {}, R), { bas: 0, moyen: 0, haut: 0 });
    const divers = coutPoste({ cle: 'divers', actif: true, mode: 'artisan', prix: { bas: 1000, moyen: 2000, haut: 3000 } }, {}, R);
    assert.deepEqual(divers, { bas: 1000, moyen: 2000, haut: 3000 });
  });

  test('dommages-ouvrage : désactivée sans poste structurel, forçable, base avec aléas en option', () => {
    const e = casReference();
    e.postes.find((p) => p.cle === 'murPorteur').actif = false;
    let t = calculerTravaux(e);
    assert.equal(t.dommagesOuvrageActive, false);
    assert.equal(t.dommagesOuvrage.moyen, 0);

    e.travaux.dommagesOuvrage = 'oui';
    t = calculerTravaux(e);
    proche(t.dommagesOuvrage.moyen, 0.04 * t.sousTotal.moyen);

    e.reglages.dommagesOuvrage.inclureAleas = true;
    t = calculerTravaux(e);
    proche(t.dommagesOuvrage.moyen, 0.04 * t.total.moyen);

    e.travaux.dommagesOuvrage = 'non';
    e.postes.find((p) => p.cle === 'murPorteur').actif = true;
    assert.equal(calculerTravaux(e).dommagesOuvrageActive, false);
  });
});

describe('financement, portage, revente', () => {
  const R = reglagesParDefaut();

  test('IRA plafonnées à 3 % du capital quand 6 mois d’intérêts dépassent', () => {
    // taux 8 % : 6 mois = 4 % du capital > 3 % → plafond
    const f = coutFinancement({ emprunt: 100000, tauxAnnuel: 0.08, ira: true }, 6, 'RP', R);
    proche(f.ira, 3000);
  });

  test('IRA désactivables (prêt négocié sans IRA)', () => {
    assert.equal(coutFinancement({ emprunt: 100000, tauxAnnuel: 0.04, ira: false }, 6, 'RP', R).ira, 0);
  });

  test('sans emprunt, pas de coût de financement', () => {
    assert.equal(coutFinancement({}, 12, 'RP', R).total, 0);
  });

  test('portage au prorata de la durée', () => {
    const p = coutPortage({ taxeFonciereAnnuelle: 1200, assuranceAnnuelle: 600, energieMensuelle: 50, coproMensuelle: 100 }, 6);
    proche(p.total, 600 + 300 + 300 + 600);
  });

  test('prix de revente au m² du secteur', () => {
    assert.equal(prixReventeBase({ revente: { mode: 'm2', prixM2: 2500 }, bien: { surfaceHabitable: 90 } }), 225000);
    assert.equal(prixReventeBase({ revente: { mode: 'saisi', prix: 200000 }, bien: {} }), 200000);
  });

  test('frais de vente', () => {
    const f = fraisVente({ fraisAgencePct: 0.05, diagnostics: 400, demenagement: 1200 }, 200000, 'RP');
    proche(f.total, 10000 + 400 + 1200);
  });
});

describe('verdict, robustesse, régime', () => {
  const obj = REGLAGES_DEFAUT.objectifs;

  test('pastille selon les seuils', () => {
    assert.equal(verdict(0.25, obj), 'ok');
    assert.equal(verdict(0.20, obj), 'ok');
    assert.equal(verdict(0.15, obj), 'vigilance');
    assert.equal(verdict(0.10, obj), 'vigilance');
    assert.equal(verdict(0.05, obj), 'alerte');
    assert.equal(verdict(-0.1, obj), 'alerte');
    assert.equal(verdict(null, obj), 'incomplet');
  });

  test('conversion des saisies', () => {
    assert.equal(n('1 234,5'), 1234.5);
    assert.equal(n(''), 0);
    assert.equal(n(null), 0);
    assert.equal(n('abc'), 0);
    assert.equal(n(-5), 0);
  });

  test('estimation vierge : calcul sans erreur, verdict « incomplet »', () => {
    const r = calculerEstimation(creerEstimation());
    assert.equal(r.complet, false);
    assert.equal(r.scenarios.central.verdict, 'incomplet');
    assert.equal(r.prixAchatMax, null);
    assert.equal(r.remunerationHoraire, null);
    for (const s of Object.values(r.scenarios)) assert.ok(Number.isFinite(s.coutRevient));
  });

  test('prix maximum null si la cible est inatteignable', () => {
    const e = casReference();
    e.revente.prix = 50000;
    assert.equal(calculerEstimation(e).prixAchatMax, null);
  });

  test('régime MDB refusé explicitement en v1', () => {
    assert.throws(() => margeNette(1000, 'MDB'), /non pris en charge/);
  });

  test('l’estimation embarque une copie indépendante des réglages', () => {
    const e = creerEstimation();
    assert.equal(e.schemaVersion, SCHEMA_VERSION);
    assert.equal(e.regime, 'RP');
    e.reglages.aleas = 0.5;
    assert.equal(REGLAGES_DEFAUT.aleas, 0.15);
    assert.equal(e.postes.length, Object.keys(REGLAGES_DEFAUT.grille.postes).length);
    assert.equal(e.postes.find((p) => p.cle === 'murPorteur').structurel, true);
  });

  test('les réglages par défaut sont figés', () => {
    assert.throws(() => { REGLAGES_DEFAUT.grille.pieces.renover.moyen = 1; });
  });
});

describe('prix d\u2019achat retenu', () => {
  test('sans prix négocié, le calcul se fait sur le prix affiché', () => {
    const e = casReference();
    e.bien.prixAffiche = 150000;
    e.bien.prixAchat = null;
    assert.equal(prixAchatEffectif(e), 150000);
    const r = calculerEstimation(e);
    assert.equal(r.complet, true);
    assert.equal(r.prixNegocie, false);
    proche(r.scenarios.central.margeNette, 41626.60, 'identique au cas de référence');
  });

  test('le prix maximum est donné même sans aucun prix d\u2019achat (revente seule)', () => {
    const e = casReference();
    e.bien.prixAchat = null;
    e.bien.prixAffiche = null;
    const r = calculerEstimation(e);
    assert.equal(r.complet, false);
    proche(r.prixAchatMax, 146241.80);
    assert.ok(r.prixAchatMaxPrudent < r.prixAchatMax, 'le prix prudent (pessimiste) est plus bas');
  });
});

describe('budget travaux maximum', () => {
  test('cas de référence : budget pour 20 % au prix de 150 000 €', () => {
    // Coût de revient cible = 274 000 / 1,2 = 228 333,33
    // Hors travaux = 232 373,40 − 55 614 − 1 934,40 = 174 825
    // Budget = 228 333,33 − 174 825 = 53 508,33 (contre 57 548,40 estimés : marge sous la cible)
    const r = calculerEstimation(casReference());
    proche(r.budgetTravauxMax, 274000 / 1.2 - 174825);
    assert.ok(r.budgetTravauxMax < r.scenarios.central.detail.travaux + r.scenarios.central.detail.dommagesOuvrage);
  });

  test('négatif quand le prix d\u2019achat seul empêche la cible', () => {
    const e = casReference();
    e.bien.prixAchat = 260000;
    assert.ok(calculerEstimation(e).budgetTravauxMax < 0);
  });
});

describe('estimation rapide (calculée à la main)', () => {
  /**
   * Maison de 90 m² affichée 120 000 €, état général « à rénover », réalisation « Nous-mêmes »,
   * revente 220 000 €, agence 5 %. Ni financement ni portage.
   */
  function casRapide() {
    const e = creerEstimation({ mode: 'rapide' });
    Object.assign(e.bien, { surfaceHabitable: 90, prixAffiche: 120000, etatGeneral: 'renover', modeGeneral: 'nous' });
    Object.assign(e.revente, { prix: 220000, fraisAgencePct: 0.05 });
    // Champs du mode détaillé remplis : ils doivent être ignorés.
    Object.assign(e.financement, { emprunt: 100000, tauxAnnuel: 0.04 });
    e.portage.energieMensuelle = 200;
    e.pieces.push({ ...creerPiece('cuisine'), surface: 10, etat: 'refaire', equipement: 'complet' });
    return e;
  }

  test('travaux : surface × prix de l\u2019état × coefficient matériaux', () => {
    const t = calculerTravaux(casRapide());
    assert.equal(t.lignes.length, 1, 'une seule ligne globale, les pièces sont ignorées');
    proche(t.sousTotal.bas, 90 * 250 * 0.4);    //  9 000
    proche(t.sousTotal.moyen, 90 * 450 * 0.4);  // 16 200
    proche(t.sousTotal.haut, 90 * 700 * 0.4);   // 25 200
    proche(t.total.moyen, 16200 * 1.15);        // 18 630
    assert.equal(t.dommagesOuvrage.moyen, 0);
  });

  test('marge centrale et préconisations', () => {
    const r = calculerEstimation(casRapide());
    const c = r.scenarios.central;
    // Coût de revient = 120 000 + 9 000 (7,5 %) + 18 630 = 147 630 ; frais de vente = 11 000
    proche(c.coutRevient, 147630);
    assert.equal(c.detail.financement.total, 0);
    assert.equal(c.detail.portage.total, 0);
    proche(c.detail.fraisVente.total, 11000);
    proche(c.margeNette, 220000 - 11000 - 147630); // 61 370
    // Prix max : (209 000 / 1,2 − 18 630) / 1,075
    proche(r.prixAchatMax, (209000 / 1.2 - 18630) / 1.075);
    // Budget travaux : 209 000 / 1,2 − 129 000
    proche(r.budgetTravauxMax, 209000 / 1.2 - 129000);
  });

  test('état général « bon » : aucun travaux', () => {
    const e = casRapide();
    e.bien.etatGeneral = 'bon';
    assert.equal(calculerTravaux(e).total.haut, 0);
  });
});
