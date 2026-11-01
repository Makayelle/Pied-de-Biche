// Thème d'affichage : automatique (selon le téléphone), clair ou sombre.
import * as store from '../data/store.js';

export async function chargerTheme() {
  appliquerTheme((await store.lireMeta('theme')) ?? 'auto');
}

export function appliquerTheme(theme) {
  const racine = document.documentElement;
  if (theme === 'clair' || theme === 'sombre') racine.dataset.theme = theme;
  else delete racine.dataset.theme;
  const sombre = theme === 'sombre' || (theme !== 'clair' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', sombre ? '#172735' : '#23384A');
}

export async function choisirTheme(theme) {
  appliquerTheme(theme);
  await store.ecrireMeta('theme', theme);
}
