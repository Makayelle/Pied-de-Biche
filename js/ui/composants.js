// Composants de saisie réutilisables, pensés pour le terrain :
// gros champs, clavier numérique, boutons de choix plutôt que listes déroulantes.
import { h } from './dom.js';

let compteur = 0;
const idUnique = (prefixe) => `${prefixe}-${++compteur}`;

const fmtSaisie = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 });

/** Libellé de champ, suivi d'un astérisque si le champ est nécessaire au calcul. */
function libelleChamp(texte, obligatoire) {
  return obligatoire
    ? [texte, h('span', { class: 'champ__requis', 'aria-hidden': 'true' }, ' *')]
    : texte;
}

/** Légende des astérisques, à placer en tête d'un écran qui comporte des champs obligatoires. */
export const legendeObligatoire = () =>
  h('p', { class: 'champ__aide legende-requis' }, h('span', { class: 'champ__requis', 'aria-hidden': 'true' }, '*'), ' Champ nécessaire au calcul de la marge');

/** Convertit une saisie en nombre (null si vide, NaN si invalide). */
export function lireNombre(texte) {
  const brut = String(texte).replace(/\s/g, '').replace(',', '.');
  if (brut === '') return null;
  const x = Number(brut);
  return Number.isFinite(x) && x >= 0 ? x : NaN;
}

/**
 * Champ numérique avec unité.
 * `echelle` : facteur d'affichage (100 pour saisir en % une valeur stockée en fraction).
 */
export function champNombre({ libelle, valeur, unite = '', echelle = 1, aide, placeholder, obligatoire = false, onChange, id = idUnique('n') }) {
  const affiche = (v) => (v == null ? '' : fmtSaisie.format(Math.round(v * echelle * 1e6) / 1e6));
  const idAide = aide ? `${id}-aide` : null;

  const input = h('input', {
    id, type: 'text', inputmode: 'decimal', autocomplete: 'off', enterkeyhint: 'next',
    class: 'champ__saisie', value: affiche(valeur), placeholder: placeholder ?? '',
    'aria-describedby': idAide, 'aria-required': obligatoire ? 'true' : null,
    onfocus: (ev) => { ev.target.value = ev.target.value.replace(/\s/g, ''); ev.target.select(); },
    onblur: (ev) => {
      const v = lireNombre(ev.target.value);
      if (!Number.isNaN(v)) ev.target.value = affiche(v === null ? null : v / echelle);
    },
    oninput: (ev) => {
      const v = lireNombre(ev.target.value);
      const invalide = Number.isNaN(v);
      ev.target.setAttribute('aria-invalid', invalide ? 'true' : 'false');
      if (!invalide) onChange(v === null ? null : v / echelle);
    },
  });

  return h('div', { class: 'champ' },
    h('label', { class: 'champ__libelle', for: id }, libelleChamp(libelle, obligatoire)),
    h('div', { class: 'champ__boite' }, input, unite ? h('span', { class: 'champ__unite', 'aria-hidden': 'true' }, unite) : null),
    aide ? h('p', { class: 'champ__aide', id: idAide }, aide) : null,
  );
}

/** Champ texte (une ligne ou plusieurs). */
export function champTexte({ libelle, valeur, placeholder, multiligne = false, autocomplete = 'off', obligatoire = false, onChange, id = idUnique('t') }) {
  const attrs = {
    id, class: 'champ__saisie', placeholder: placeholder ?? '', autocomplete,
    'aria-required': obligatoire ? 'true' : null,
    oninput: (ev) => onChange(ev.target.value),
  };
  const saisie = multiligne
    ? h('textarea', { ...attrs, rows: 3 }, valeur ?? '')
    : h('input', { ...attrs, type: 'text', value: valeur ?? '' });
  return h('div', { class: 'champ' },
    h('label', { class: 'champ__libelle', for: id }, libelleChamp(libelle, obligatoire)),
    h('div', { class: 'champ__boite' }, saisie),
  );
}

/**
 * Groupe de boutons de choix (boutons radio accessibles).
 * options : [{ valeur, libelle }]
 */
export function choix({ libelle, options, valeur, onChange, compact = false, masquerLegende = false }) {
  const nom = idUnique('c');
  return h('fieldset', { class: `choix${compact ? ' choix--compact' : ''}` },
    h('legend', { class: masquerLegende ? 'visuellement-cache' : 'champ__libelle' }, libelle),
    h('div', { class: 'choix__options' }, options.map((o) =>
      h('label', { class: 'choix__option' },
        h('input', {
          type: 'radio', name: nom, value: o.valeur, checked: o.valeur === valeur,
          onchange: () => onChange(o.valeur),
        }),
        h('span', {}, o.libelle),
      ),
    )),
  );
}

/** Interrupteur (case à cocher stylée). */
export function interrupteur({ libelle, coche, onChange, aide }) {
  const id = idUnique('i');
  return h('div', { class: 'interrupteur' },
    h('input', { id, type: 'checkbox', role: 'switch', checked: Boolean(coche), onchange: (ev) => onChange(ev.target.checked) }),
    h('label', { for: id }, h('span', { class: 'interrupteur__libelle' }, libelle), aide ? h('span', { class: 'champ__aide' }, aide) : null),
  );
}

/** Section titrée. */
export function section(titre, ...enfants) {
  return h('section', { class: 'carte' }, h('h2', { class: 'carte__titre' }, titre), ...enfants);
}

/** Ligne de deux champs côte à côte. */
export const duo = (...enfants) => h('div', { class: 'duo' }, ...enfants);
