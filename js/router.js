// Routeur par hash — fonctions pures, testables sous Node.
// Routes :
//   #/                              → accueil
//   #/estimation/<id>/<etape>       → saisie d'une estimation
//   #/fiche/<id>                    → fiche A4 imprimable
//   #/reglages                      → réglages

export const ETAPES = [
  { id: 'bien', libelle: 'Le bien' },
  { id: 'pieces', libelle: 'Pièces' },
  { id: 'postes', libelle: 'Gros postes' },
  { id: 'financement', libelle: 'Financement & revente' },
  { id: 'synthese', libelle: 'Synthèse' },
];

/** Étapes affichées selon le mode de l'estimation. */
export function etapesPour(mode = 'detaille') {
  return mode === 'rapide' ? ETAPES.filter((e) => e.id === 'bien' || e.id === 'synthese') : ETAPES;
}

const ID_VALIDE = /^[A-Za-z0-9_-]{1,64}$/;

/** Analyse un hash d'URL et renvoie la route correspondante. */
export function analyserRoute(hash = '') {
  const chemin = hash.replace(/^#/, '').replace(/^\/+|\/+$/g, '');
  if (chemin === '') return { ecran: 'accueil' };

  const segments = chemin.split('/').map((s) => {
    try { return decodeURIComponent(s); } catch { return s; }
  });

  if (segments[0] === 'reglages' && segments.length === 1) return { ecran: 'reglages' };

  if (segments[0] === 'fiche' && segments.length === 2) {
    return ID_VALIDE.test(segments[1]) ? { ecran: 'fiche', id: segments[1] } : { ecran: 'introuvable' };
  }

  if (segments[0] === 'estimation' && segments.length >= 2 && segments.length <= 3) {
    const id = segments[1];
    if (!ID_VALIDE.test(id)) return { ecran: 'introuvable' };
    const etape = segments[2] ?? ETAPES[0].id;
    if (!ETAPES.some((e) => e.id === etape)) return { ecran: 'introuvable' };
    return { ecran: 'estimation', id, etape };
  }

  return { ecran: 'introuvable' };
}

/** Construit le hash d'une route. */
export function lien(route) {
  switch (route.ecran) {
    case 'estimation':
      return `#/estimation/${encodeURIComponent(route.id)}/${route.etape ?? ETAPES[0].id}`;
    case 'fiche':
      return `#/fiche/${encodeURIComponent(route.id)}`;
    case 'reglages':
      return '#/reglages';
    default:
      return '#/';
  }
}

/** Étapes précédente et suivante, pour la navigation en bas d'écran. */
export function voisines(etape, mode = 'detaille') {
  const liste = etapesPour(mode);
  const i = liste.findIndex((e) => e.id === etape);
  return { precedente: liste[i - 1] ?? null, suivante: liste[i + 1] ?? null };
}
