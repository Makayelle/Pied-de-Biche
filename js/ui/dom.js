// Petits utilitaires DOM partagés par tous les écrans.
// Règle : jamais d'innerHTML avec des données saisies ; on passe par h() qui crée des nœuds texte.

/**
 * Crée un élément. h('a', { href: '#/', class: 'x' }, 'texte', autreNoeud)
 * Les attributs commençant par « on » sont des écouteurs d'événements.
 */
export function h(tag, attrs = {}, ...enfants) {
  const el = document.createElement(tag);
  for (const [cle, valeur] of Object.entries(attrs ?? {})) {
    if (valeur === false || valeur == null) continue;
    if (cle.startsWith('on') && typeof valeur === 'function') {
      el.addEventListener(cle.slice(2).toLowerCase(), valeur);
    } else if (cle === 'style') {
      throw new Error('Attribut style interdit par la CSP : utiliser une classe.');
    } else {
      el.setAttribute(cle, valeur === true ? '' : String(valeur));
    }
  }
  ajouter(el, enfants);
  return el;
}

function ajouter(parent, enfants) {
  for (const enfant of enfants.flat(Infinity)) {
    if (enfant == null || enfant === false) continue;
    parent.append(enfant instanceof Node ? enfant : document.createTextNode(String(enfant)));
  }
}

// Pictogrammes (constantes internes, trait 2 px, 24×24, couleur héritée).
const PICTOS = {
  reglages: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  retour: '<path d="M15 18l-6-6 6-6"/>',
  suivant: '<path d="M9 18l6-6-6-6"/>',
  maison: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  chantier: '<path d="M2 20h20"/><path d="M5 20V9l7-5 7 5v11"/><path d="M9 20v-5h6v5"/><path d="M14 4l6-2"/>',
};

export function picto(nom) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML = PICTOS[nom] ?? '';
  return svg;
}

/** Formatage français des montants et surfaces. */
export const format = {
  euros: (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n),
  pourcent: (n) => new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 }).format(n),
  surface: (n) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n)} m²`,
};
