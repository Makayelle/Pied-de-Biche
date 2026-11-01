// Outil de développement : génère les icônes PNG à partir des SVG.
// Usage : node tools/icons.mjs  (nécessite Playwright installé globalement, non requis pour faire tourner l'app)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFile } from 'node:fs/promises';

const racine = new URL('../', import.meta.url);
const cibles = [
  ['assets/favicon.svg', 'assets/icons/icon-192.png', 192],
  ['assets/favicon.svg', 'assets/icons/icon-512.png', 512],
  ['assets/icons/maskable.svg', 'assets/icons/maskable-512.png', 512],
  ['assets/icons/maskable.svg', 'assets/icons/apple-touch-icon.png', 180],
];

const navigateur = await chromium.launch();
const page = await navigateur.newPage();
for (const [src, dest, taille] of cibles) {
  const svg = await readFile(new URL(src, racine), 'utf8');
  await page.setViewportSize({ width: taille, height: taille });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${taille}px;height:${taille}px}</style>${svg}`);
  await page.locator('svg').screenshot({ path: new URL(dest, racine).pathname, omitBackground: true });
  console.log('✓', dest);
}
await navigateur.close();
