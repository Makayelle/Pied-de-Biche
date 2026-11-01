// Compression des photos côté client (canvas) avant stockage dans IndexedDB.
import { nouvelId } from './schema.js';

const COTE_MAX = 1600;
const COTE_MINIATURE = 320;
const QUALITE = 0.7;

async function chargerImage(fichier) {
  // createImageBitmap applique l'orientation EXIF ; repli sur <img> sinon.
  try {
    return await createImageBitmap(fichier, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(fichier);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function redimensionner(source, coteMax) {
  const largeur = source.width;
  const hauteur = source.height;
  const ratio = Math.min(1, coteMax / Math.max(largeur, hauteur));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(largeur * ratio);
  canvas.height = Math.round(hauteur * ratio);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, ko) => canvas.toBlob(
    (b) => (b ? ok({ blob: b, largeur: canvas.width, hauteur: canvas.height }) : ko(new Error('Compression impossible'))),
    'image/jpeg', QUALITE,
  ));
}

/**
 * Transforme un fichier image en enregistrement photo prêt à stocker.
 * @param {File} fichier
 * @param {{ estimationId: string, cible: string, dansFiche: boolean }} meta  cible : 'bien' ou id de pièce
 */
export async function preparerPhoto(fichier, { estimationId, cible, dansFiche }) {
  const source = await chargerImage(fichier);
  const [image, miniature] = await Promise.all([redimensionner(source, COTE_MAX), redimensionner(source, COTE_MINIATURE)]);
  source.close?.();
  return {
    id: nouvelId('f'),
    estimationId,
    cible,
    legende: '',
    dansFiche,
    largeur: image.largeur,
    hauteur: image.hauteur,
    image: image.blob,
    miniature: miniature.blob,
    creeLe: new Date().toISOString(),
  };
}
