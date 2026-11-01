// Tests du moteur de calcul. Le cas « RP de référence » est calculé à la main ci-dessous :
// chaque attendu est accompagné de son calcul pour pouvoir être revérifié.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  n, coutPiece, coutPoste, quantitePoste, calculerTravaux, coutFinancement, coutPortage,
  prixReventeBase, fraisVente, calculerScenario, parametresScenarios, prixAchatMax,
  verdict, calculerEstimation, margeNette,
} from '../js/calc/engine.js';
import { reglagesParDefaut, REGLAGES_DEFAUT } from '../js/calc/defaults.js';
import { creerEstimation, creerPiece, SCHEMA_VERSION } from '../js/data/schema.js';

const proche = (reel, attendu, msg, tol = 0.01) =>
  assert.ok(Math.abs(reel - attendu) <= tol, `${msg ?? ''} attendu ${attendu}, obtenu ${reel}`);

/**
 * Cas de référence RP — maison de 100 m² achetée 150 000 €.
 *   Pièces : séjour 30 m² à rénover (artisan) ; cuisine 12 m² à refaire + équipement complet (nous-mêmes) ;
 *            salle de bain 6 m² à rafraîchir + équipement partiel (artisan) ; chambre 12 m² en bon état.
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
    { ...creerPiece('sdb'), surface: 6, etat: 'rafraichir', equipement: 'partiel', mode: 'artisan' },
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
    // cuisine     12 × 1 100 × 0,4 + 8 000 × 0,4   =  8 480
    // sdb          6 × 60 + 9 000 × 0,5             =  4 860
    // chambre     bon état                          =      0
    // électricité 100 × 110                         = 11 000
    // fenêtres    6 × 800 × 0,4                     =  1 920
    // mur porteur 1 × 5 000                         =  5 000
    proche(r.travaux.sousTotal.moyen, 44760, 'sous-total');
    proche(r.travaux.aleas.moyen, 6714, 'aléas 15 %');
    proche(r.travaux.total.moyen, 51474, 'total avec aléas');
  });

  test('travaux fourchette haute', () => {
    // 30×700 + (12×1600×0,4 + 15000×0,4) + (6×100 + 15000×0,5) + 100×150 + 6×1200×0,4 + 8000
    // = 21 000 + 13 680 + 8 100 + 15 000 + 2 880 + 8 000 = 68 660
    proche(r.travaux.sousTotal.haut, 68660);
  });

  test('dommages-ouvrage déclenchée par le mur porteur, sur les travaux hors aléas', () => {
    assert.equal(r.travaux.dommagesOuvrageActive, true);
    proche(c.detail.dommagesOuvrage, 1790.40, '4 % × 44 760');
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
    // 150 000 + 11 250 (7,5 %) + 0 + 51 474 + 1 790,40 + 11 505 + 2 070
    proche(c.detail.fraisAcquisition, 11250);
    proche(c.coutRevient, 228089.40);
  });

  test('marges et indicateurs du scénario central', () => {
    proche(c.detail.fraisVente.total, 16000, '14 500 + 500 + 1 000');
    proche(c.margeBrute, 45910.60, '290 000 − 16 000 − 228 089,40');
    proche(c.margeNette, 45910.60, 'RP : nette = brute');
    proche(c.pctCoutRevient, 45910.60 / 228089.40, '', 1e-9);
    proche(c.pctRevente, 45910.60 / 290000, '', 1e-9);
    proche(c.rendementApport, 0.918212, '', 1e-6);
    proche(c.rendementAnnualise, 1.918212 ** (12 / 9) - 1, '', 1e-6);
    proche(c.resteAFinancer, 228089.40 - 230000);
    assert.equal(c.verdict, 'ok', '20,13 % ≥ 20 %');
  });

  test('rémunération horaire implicite', () => {
    proche(r.remunerationHoraire, 45910.60 / 400);
  });

  test('prix d’achat maximum pour 20 % de marge', () => {
    // Coût de revient = P × 1,075 + K, avec K = 228 089,40 − 161 250 = 66 839,40
    // Cible : 274 000 − CR = 0,2 × CR → CR = 228 333,33 → P = (228 333,33 − 66 839,40) / 1,075
    proche(r.prixAchatMax, (274000 / 1.2 - 66839.40) / 1.075, 'prix max');
    proche(r.prixAchatMax, 150226.91);
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

  test('coefficients matériaux distincts par catégorie (décision §15-4)', () => {
    const r = reglagesParDefaut();
    r.coefMateriaux = { pieces: 0.5, equipements: 0.25, postes: 0.4 };
    const c = coutPiece({ type: 'cuisine', surface: 10, etat: 'renover', equipement: 'complet', mode: 'nous' }, r);
    proche(c.moyen, 10 * 450 * 0.5 + 8000 * 0.25);
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
