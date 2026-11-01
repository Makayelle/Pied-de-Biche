// Export de fichiers : Web Share API si disponible (envoi direct à l'associé), sinon téléchargement.
import { construireExport, nomFichier } from '../data/io.js';
import * as store from '../data/store.js';
import { notifier } from './dialogue.js';

async function partagerOuTelecharger(contenu, nom) {
  const fichier = new File([JSON.stringify(contenu)], nom, { type: 'application/json' });

  if (navigator.canShare?.({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: nom });
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false; // partage annulé par l'utilisateur
      // Autre échec : on bascule sur le téléchargement.
    }
  }
  const url = URL.createObjectURL(fichier);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

export async function exporterEstimation(id) {
  await store.vider();
  const e = store.obtenir(id);
  const contenu = await construireExport({ estimations: [e], photos: await store.photosDe(id) });
  if (await partagerOuTelecharger(contenu, nomFichier(e))) notifier('Estimation exportée');
}

export async function exporterTout() {
  await store.vider();
  const estimations = [...store.lister(), ...store.lister({ archives: true })];
  const contenu = await construireExport({
    estimations, photos: await store.toutesLesPhotos(), reglages: store.reglages(), type: 'sauvegarde',
  });
  if (await partagerOuTelecharger(contenu, nomFichier(null))) {
    await store.noterExport();
    notifier(`${estimations.length} estimation(s) exportée(s)`);
  }
}

export async function exporterReglages(reglages) {
  const contenu = await construireExport({ estimations: [], reglages, type: 'reglages' });
  const date = new Date().toISOString().slice(0, 10);
  if (await partagerOuTelecharger(contenu, `pied-de-biche_reglages_${date}.json`)) notifier('Réglages exportés');
}
