// Routeur par hash — fonctions pures, testables sous Node.
// Routes :
//   #/                              → accueil
//   #/estimation/<id>/<etape>       → saisie d'une estimation
//   #/reglages                      → réglages

export const ETAPES = [
  { id: 'bien', libelle: 'Le bien' },
  { id: 'pieces', libelle: 'Pièces' },
  { id: 'postes', libelle: 'Gros postes' },
  { id: 'financement', libelle: 'Financement & revente' },
  { id: 'synthese', libelle: 'Synthèse' },
];

const ID_VALIDE = /^[A-Za-z0-9_-]{1,64}$/;

/** Analyse un hash d'URL et renvoie la route correspondante. */
export function analyserRoute(hash = '') {
  const chemin = hash.replace(/^#/, '').replace(/^\/+|\/+$/g, '');
  if (chemin === '') return { ecran: 'accueil' };

  const segments = chemin.split('/').map((s) => {
    try { return decodeURIComponent(s); } catch { return s; }
  });

  if (segments[0] === 'reglages' && segments.length === 1) return { ecran: 'reglages' };

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
    case 'reglages':
      return '#/reglages';
    default:
      return '#/';
  }
}

/** Étapes précédente et suivante, pour la navigation en bas d'écran. */
export function voisines(etape) {
  const i = ETAPES.findIndex((e) => e.id === etape);
  return { precedente: ETAPES[i - 1] ?? null, suivante: ETAPES[i + 1] ?? null };
}
