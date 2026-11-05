// Tests de la couche de données : migrations, normalisation, copie, export / import JSON.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { creerEstimation, creerPiece, copierEstimation, normaliserEstimation, SCHEMA_VERSION } from '../js/data/schema.js';
import { migrer, ErreurMigration } from '../js/data/migrations.js';
import {
  construireExport, analyserImport, conflits, nomFichier, blobVersDataUrl, dataUrlVersBlob, FORMAT,
} from '../js/data/io.js';
import { calculerEstimation } from '../js/calc/engine.js';
import { REGLAGES_DEFAUT, reglagesParDefaut } from '../js/calc/defaults.js';

function exemple() {
  const e = creerEstimation({ maintenant: new Date('2026-11-01T10:00:00Z') });
  e.bien.adresse = '12 rue des Lilas';
  e.bien.surfaceHabitable = 80;
  e.bien.prixAchat = 120000;
  e.revente.prix = 200000;
  e.pieces.push({ ...creerPiece('cuisine'), surface: 10, etat: 'renover', equipement: 'complet' });
  return e;
}

// Faux JPEG (quelques octets suffisent pour tester l'aller-retour base64).
const octets = new Uint8Array(70000).map((_, i) => (i * 37) % 256);
const photo = (estimationId, cible = 'bien') => ({
  id: `f${Math.random().toString(36).slice(2, 8)}`, estimationId, cible, legende: 'Façade', dansFiche: true,
  largeur: 1600, hauteur: 1200, creeLe: '2026-11-01T10:00:00.000Z',
  image: new Blob([octets], { type: 'image/jpeg' }), miniature: new Blob([octets.slice(0, 500)], { type: 'image/jpeg' }),
});

describe('migrations', () => {
  test('une estimation à jour est seulement normalisée', () => {
    const e = exemple();
    assert.deepEqual(migrer(e), e);
  });

  test('le schéma courant est 4', () => assert.equal(SCHEMA_VERSION, 4));

  test('migration v2 → v3 : ajout du GES, inconnu par défaut', () => {
    const v2 = exemple();
    v2.schemaVersion = 2;
    delete v2.bien.ges;
    const v3 = migrer(v2);
    assert.equal(v3.schemaVersion, SCHEMA_VERSION);
    assert.equal(v3.bien.ges, 'inconnu');
    assert.equal(v3.bien.dpe, exemple().bien.dpe);
  });

  test('migration v3 → v4 : une estimation à l’ancienne grille garde exactement ses montants (critère §13)', () => {
    const v3 = exemple();
    v3.schemaVersion = 3;
    v3.pieces = [
      { ...creerPiece('cuisine'), surface: 12, etat: 'refaire', equipement: 'complet', mode: 'nous' },
      { ...creerPiece('sdb'), surface: 6, etat: 'bon', equipement: 'partiel', mode: 'nous' },
      { ...creerPiece('wc'), surface: 2, etat: 'bon', equipement: 'complet', mode: 'artisan' },
      { ...creerPiece('cuisine'), surface: 8, etat: 'bon', equipement: 'partiel', mode: 'artisan' },
    ];
    for (const p of v3.pieces) delete p.elements;
    // Réglages enregistrés avant la v0.8.1 : un forfait complet unique par équipement.
    const forfaits = { cuisine: [4000, 8000, 15000], sdb: [5000, 9000, 15000], wc: [1500, 2500, 4000] };
    for (const [cle, eq] of Object.entries(v3.reglages.grille.equipements)) {
      for (const k of Object.keys(eq)) if (k !== 'libelle') delete eq[k];
      [eq.bas, eq.moyen, eq.haut] = forfaits[cle];
    }
    v3.reglages.coefMateriaux = { pieces: 0.4, equipements: 0.4, postes: 0.4 };
    const reglagesAvant = structuredClone(v3.reglages);

    const v4 = migrer(v3);
    assert.equal(v4.schemaVersion, 4);
    assert.ok(v4.pieces.every((p) => p.elements === null));
    assert.deepEqual(v4.reglages, reglagesAvant, 'la grille de l’estimation n’est pas convertie');
    // Ancien calcul : forfait × (50 % si partiel) × (40 % si nous-mêmes).
    const t = calculerEstimation(v4).travaux.lignes;
    assert.equal(t[0].moyen, 12 * 1100 * 0.4 + 8000 * 0.4);   // cuisine complète, nous-mêmes : 5 280 + 3 200
    assert.equal(t[1].moyen, 9000 * 0.5 * 0.4);                // sdb partielle, nous-mêmes : 1 800
    assert.equal(t[2].moyen, 2500);                            // WC complet, artisan
    assert.equal(t[3].moyen, 8000 * 0.5);                      // cuisine partielle, artisan : 4 000
  });

  test('après « Recalculer avec les réglages actuels », le nouveau calcul des équipements s’applique', () => {
    const e = exemple();
    e.pieces = [{ ...creerPiece('cuisine'), surface: 10, etat: 'bon', equipement: 'complet', mode: 'nous' }];
    const eq = e.reglages.grille.equipements.cuisine;
    for (const k of Object.keys(eq)) if (k !== 'libelle') delete eq[k];
    [eq.bas, eq.moyen, eq.haut] = [4000, 8000, 15000];
    e.reglages.coefMateriaux.equipements = 0.4;
    assert.equal(calculerEstimation(e).travaux.lignes[0].moyen, 3200);
    e.reglages = reglagesParDefaut();                          // ce que fait le bouton « Recalculer »
    assert.equal(calculerEstimation(e).travaux.lignes[0].moyen, 6500 + 1500 * 0.2);
  });

  test('une pièce neuve a une liste d’éléments vide', () => assert.deepEqual(creerPiece('cuisine').elements, []));

  test('une estimation neuve a un GES inconnu', () => assert.equal(creerEstimation().bien.ges, 'inconnu'));

  test('migration v1 → v2 : une estimation existante passe en mode détaillé', () => {
    const v1 = exemple();
    v1.schemaVersion = 1;
    delete v1.mode;
    delete v1.bien.etatGeneral;
    delete v1.bien.modeGeneral;
    const v2 = migrer(v1);
    assert.equal(v2.schemaVersion, SCHEMA_VERSION);
    assert.equal(v2.mode, 'detaille');
    assert.equal(v2.bien.etatGeneral, 'renover');
    assert.equal(calculerEstimation(v2).scenarios.central.margeNette, calculerEstimation(exemple()).scenarios.central.margeNette);
  });

  test('un fichier exporté en v1 se réimporte (migration à l\u2019import)', async () => {
    const v1 = exemple();
    v1.schemaVersion = 1;
    delete v1.mode;
    const r = analyserImport(await construireExport({ estimations: [v1] }));
    assert.equal(r.estimations[0].schemaVersion, SCHEMA_VERSION);
    assert.equal(r.estimations[0].mode, 'detaille');
  });

  test('applique les migrations dans l’ordre sans modifier la source', () => {
    const source = { schemaVersion: 1, a: 1 };
    // Version cible fictive, au-delà du schéma réel, pour tester l'enchaînement seul (sans normalisation).
    const migrations = { 1: (e) => ({ ...e, b: e.a + 1 }), 2: (e) => ({ ...e, c: e.b * 10 }), 3: (e) => ({ ...e, d: e.c + 1 }), 4: (e) => ({ ...e, z: true }) };
    const r = migrer(source, { migrations, versionCible: SCHEMA_VERSION + 1 });
    assert.deepEqual(r, { schemaVersion: 5, a: 1, b: 2, c: 20, d: 21, z: true });
    assert.deepEqual(source, { schemaVersion: 1, a: 1 });
  });

  test('refuse une version absente, plus récente, ou une migration manquante', () => {
    assert.throws(() => migrer({}), ErreurMigration);
    assert.throws(() => migrer({ schemaVersion: SCHEMA_VERSION + 1 }), /plus récente/);
    assert.throws(() => migrer({ schemaVersion: 1 }, { migrations: {}, versionCible: 2 }), /manquante/);
  });

  test('la normalisation complète les champs et postes manquants', () => {
    const e = exemple();
    delete e.bien.dpe;
    delete e.travaux;
    e.postes = e.postes.filter((p) => p.cle !== 'vmc');
    delete e.pieces[0].mode;
    normaliserEstimation(e);
    assert.equal(e.bien.dpe, 'inconnu');
    assert.equal(e.travaux.dommagesOuvrage, 'auto');
    assert.ok(e.postes.some((p) => p.cle === 'vmc'));
    assert.equal(e.pieces[0].mode, 'artisan');
    assert.equal(e.bien.adresse, '12 rue des Lilas', 'les valeurs existantes sont conservées');
  });
});

describe('copie d’estimation', () => {
  test('nouvel identifiant, pièces ré-identifiées, résultats identiques', () => {
    const e = exemple();
    const c = copierEstimation(e);
    assert.notEqual(c.id, e.id);
    assert.notEqual(c.pieces[0].id, e.pieces[0].id);
    assert.equal(c.bien.adresse, '12 rue des Lilas (copie)');
    assert.equal(calculerEstimation(c).scenarios.central.margeNette, calculerEstimation(e).scenarios.central.margeNette);
    c.pieces[0].surface = 99;
    assert.equal(e.pieces[0].surface, 10, 'la copie est indépendante');
  });
});

describe('export / import', () => {
  test('aller-retour base64 d’une image', async () => {
    const b = new Blob([octets], { type: 'image/jpeg' });
    const url = await blobVersDataUrl(b);
    assert.match(url, /^data:image\/jpeg;base64,/);
    const retour = dataUrlVersBlob(url);
    assert.equal(retour.type, 'image/jpeg');
    assert.deepEqual(new Uint8Array(await retour.arrayBuffer()), octets);
  });

  test('aller-retour complet : estimation identique, photos comprises (critère §13)', async () => {
    const e = exemple();
    const photos = [photo(e.id), photo(e.id, e.pieces[0].id)];
    const fichier = JSON.stringify(await construireExport({ estimations: [e], photos }));
    const r = analyserImport(fichier);

    assert.equal(r.type, 'estimation');
    assert.deepEqual(r.estimations[0], e);
    assert.equal(r.photos.length, 2);
    for (const [i, p] of r.photos.entries()) {
      assert.equal(p.legende, 'Façade');
      assert.equal(p.cible, photos[i].cible);
      assert.deepEqual(new Uint8Array(await p.image.arrayBuffer()), octets);
      assert.equal(p.miniature.size, 500);
    }
    assert.equal(calculerEstimation(r.estimations[0]).scenarios.central.margeNette,
      calculerEstimation(e).scenarios.central.margeNette);
  });

  test('sauvegarde globale avec réglages', async () => {
    const fichier = await construireExport({ estimations: [exemple(), exemple()], reglages: REGLAGES_DEFAUT, type: 'sauvegarde' });
    const r = analyserImport(JSON.stringify(fichier));
    assert.equal(r.type, 'sauvegarde');
    assert.equal(r.estimations.length, 2);
    assert.deepEqual(r.reglages, JSON.parse(JSON.stringify(REGLAGES_DEFAUT)));
  });

  test('rejette les fichiers invalides avec un message clair', () => {
    assert.throws(() => analyserImport('pas du json'), /JSON valide/);
    assert.throws(() => analyserImport('{"format":"autre"}'), /ne provient pas/);
    assert.throws(() => analyserImport(JSON.stringify({ format: FORMAT })), /aucune estimation/);
    const e = exemple();
    assert.throws(() => analyserImport({ format: FORMAT, estimations: [{ ...e, id: '../x' }] }), /identifiant invalide/);
    assert.throws(() => analyserImport({ format: FORMAT, estimations: [{ ...e, pieces: null }] }), /structure invalide/);
    assert.throws(() => analyserImport({ format: FORMAT, estimations: [{ ...e, schemaVersion: 99 }] }), /plus récente/);
  });

  test('ignore les photos orphelines ou qui ne sont pas des images', async () => {
    const e = exemple();
    const fichier = await construireExport({ estimations: [e], photos: [photo(e.id), photo('autre')] });
    fichier.photos.push({ ...fichier.photos[0], id: 'fx', image: 'data:text/html;base64,PHNjcmlwdD4=' });
    assert.equal(analyserImport(fichier).photos.length, 1);
  });

  test('détection des doublons d’identifiant', () => {
    const a = exemple();
    const b = exemple();
    assert.deepEqual(conflits([a, b], [b.id, 'zzz']), [b.id]);
  });

  test('nom de fichier lisible', () => {
    const d = new Date('2026-11-01T10:00:00Z');
    assert.equal(nomFichier(exemple(), d), 'pied-de-biche_12-rue-des-lilas_2026-11-01.json');
    assert.equal(nomFichier(null, d), 'pied-de-biche_sauvegarde_2026-11-01.json');
    const e = exemple();
    e.bien.adresse = '';
    e.bien.commune = 'Saint-Étienne';
    assert.equal(nomFichier(e, d), 'pied-de-biche_saint-etienne_2026-11-01.json');
  });
});
