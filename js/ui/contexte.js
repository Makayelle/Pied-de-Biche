// Contexte d'édition d'une estimation : modifications, sauvegarde et recalcul en direct.
import { calculerEstimation } from '../calc/engine.js';
import { enregistrer } from '../data/store.js';

/**
 * @param {object} estimation
 * @param {(opts?: object) => void} rerendre  redessine l'écran (changement de structure)
 */
export function creerContexte(estimation, rerendre) {
  const liaisons = [];
  let resultats = calculerEstimation(estimation);

  const ctx = {
    estimation,
    get resultats() { return resultats; },

    /**
     * Applique une modification. Par défaut, seuls les affichages calculés sont mis à jour
     * (le formulaire n'est pas redessiné, la saisie et le focus sont conservés).
     */
    changer(modification, { structure = false, focus = null } = {}) {
      modification(estimation);
      enregistrer(estimation);
      resultats = calculerEstimation(estimation);
      if (structure) rerendre({ focus });
      else for (const maj of liaisons) maj(resultats);
    },

    /** Raccourci : affecte une valeur à un objet de l'estimation. */
    poser(objet, cle, opts) {
      return (valeur) => ctx.changer(() => { objet[cle] = valeur; }, opts);
    },

    /** Enregistre un affichage dépendant des résultats ; appelé tout de suite puis à chaque modification. */
    lier(maj) {
      liaisons.push(maj);
      maj(resultats);
    },
  };
  return ctx;
}
