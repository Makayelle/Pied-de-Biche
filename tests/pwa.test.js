// Vérifications du socle PWA : fichiers mis en cache, version, manifeste, absence d'appels tiers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_VERSION } from '../js/version.js';

const racine = fileURLToPath(new URL('..', import.meta.url));
const lire = (f) => readFileSync(join(racine, f), 'utf8');
const sw = lire('sw.js');

function fichiers(dossier) {
  return readdirSync(join(racine, dossier)).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(join(racine, chemin)).isDirectory() ? fichiers(chemin) : [chemin.replaceAll('\\', '/')];
  });
}

function assetsDuServiceWorker() {
  const bloc = sw.match(/const ASSETS = \[([\s\S]*?)\];/);
  assert.ok(bloc, 'liste ASSETS introuvable dans sw.js');
  return [...bloc[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

test('la version du service worker correspond à APP_VERSION', () => {
  const v = sw.match(/const VERSION = '([^']+)'/)?.[1];
  assert.equal(v, APP_VERSION);
});

test('chaque asset du service worker existe et a un chemin relatif', () => {
  for (const a of assetsDuServiceWorker()) {
    assert.ok(!a.startsWith('/') && !/^https?:/.test(a), `chemin non relatif : ${a}`);
    if (a !== './') assert.ok(existsSync(join(racine, a)), `fichier manquant : ${a}`);
  }
});

test('tous les fichiers de l’app sont mis en cache (hors ligne complet)', () => {
  const assets = new Set(assetsDuServiceWorker());
  const sources = ['js', 'css', 'assets'].flatMap(fichiers)
    .filter((f) => !/^assets\/icons\/.*\.svg$/.test(f)); // sources des PNG, non servies
  for (const f of sources) assert.ok(assets.has(f), `absent du cache du service worker : ${f}`);
});

test('le manifeste est valide et ses icônes existent', () => {
  const m = JSON.parse(lire('manifest.webmanifest'));
  assert.equal(m.short_name, 'Pied-de-Biche');
  assert.equal(m.start_url, './');
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  for (const i of m.icons) assert.ok(existsSync(join(racine, i.src)), `icône manquante : ${i.src}`);
});

test('la CSP est présente dans index.html', () => {
  assert.match(lire('index.html'), /Content-Security-Policy" content="default-src 'self'; img-src 'self' data: blob:"/);
});

test('aucune URL vers un domaine tiers dans le code de l’app', () => {
  const autorise = /^https?:\/\/www\.w3\.org\//; // espaces de noms SVG, pas des requêtes
  for (const f of ['index.html', 'sw.js', 'manifest.webmanifest', ...fichiers('js'), ...fichiers('css')]) {
    for (const [url] of lire(f).matchAll(/https?:\/\/[^\s'"`)]+/g)) {
      assert.ok(autorise.test(url), `URL externe dans ${f} : ${url}`);
    }
  }
});

test('pas d’attribut style en ligne (bloqué par la CSP)', () => {
  for (const f of ['index.html', ...fichiers('js')]) {
    assert.doesNotMatch(lire(f), /\sstyle="/, `attribut style dans ${f}`);
  }
});

test('tous les modules JS sont syntaxiquement valides', async () => {
  const { execFileSync } = await import('node:child_process');
  for (const f of ['sw.js', ...fichiers('js')]) {
    try {
      execFileSync(process.execPath, ['--check', join(racine, f)], { stdio: 'pipe' });
    } catch (err) {
      assert.fail(`${f} :\n${err.stderr}`);
    }
  }
});
