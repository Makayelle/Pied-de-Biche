import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyserRoute, lien, voisines, etapesPour, ETAPES } from '../js/router.js';

test('accueil pour un hash vide ou racine', () => {
  for (const h of ['', '#', '#/', '#//']) assert.deepEqual(analyserRoute(h), { ecran: 'accueil' });
});

test('réglages', () => {
  assert.deepEqual(analyserRoute('#/reglages'), { ecran: 'reglages' });
  assert.deepEqual(analyserRoute('#/reglages/'), { ecran: 'reglages' });
});

test('estimation avec étape', () => {
  assert.deepEqual(analyserRoute('#/estimation/abc123/pieces'), { ecran: 'estimation', id: 'abc123', etape: 'pieces' });
});

test('estimation sans étape → première étape', () => {
  assert.deepEqual(analyserRoute('#/estimation/abc123'), { ecran: 'estimation', id: 'abc123', etape: 'bien' });
});

test('routes invalides', () => {
  assert.equal(analyserRoute('#/estimation/abc/inconnue').ecran, 'introuvable');
  assert.equal(analyserRoute('#/estimation/a%20b/bien').ecran, 'introuvable');
  assert.equal(analyserRoute('#/estimation/a/bien/trop').ecran, 'introuvable');
  assert.equal(analyserRoute('#/n-importe-quoi').ecran, 'introuvable');
  assert.equal(analyserRoute('#/fiche/a b').ecran, 'introuvable');
  assert.equal(analyserRoute('#/fiche').ecran, 'introuvable');
  assert.equal(analyserRoute('#/estimation/%E0%A4%A').ecran, 'introuvable');
});

test('lien() est l’inverse de analyserRoute()', () => {
  const routes = [
    { ecran: 'accueil' },
    { ecran: 'reglages' },
    { ecran: 'fiche', id: 'abc_1' },
    ...ETAPES.map((e) => ({ ecran: 'estimation', id: 'x_1-Y', etape: e.id })),
  ];
  for (const r of routes) assert.deepEqual(analyserRoute(lien(r)), r);
});

test('étapes voisines', () => {
  assert.deepEqual(voisines('bien'), { precedente: null, suivante: ETAPES[1] });
  assert.deepEqual(voisines('synthese'), { precedente: ETAPES[3], suivante: null });
});

test('mode rapide : deux étapes, le bien puis la synthèse', () => {
  assert.deepEqual(etapesPour('rapide').map((e) => e.id), ['bien', 'synthese']);
  assert.equal(voisines('bien', 'rapide').suivante.id, 'synthese');
  assert.equal(voisines('synthese', 'rapide').precedente.id, 'bien');
  assert.equal(etapesPour('detaille').length, 5);
});
