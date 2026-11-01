// Boîtes de dialogue accessibles (<dialog> natif) qui renvoient une promesse.
import { h } from './dom.js';

/**
 * Affiche une boîte de dialogue et renvoie la valeur du bouton choisi (null si fermée).
 * @param {{ titre: string, texte?: string|Node, contenu?: Node, boutons: {valeur: string, libelle: string, style?: string}[] }} o
 */
export function demander({ titre, texte, contenu, boutons }) {
  return new Promise((resoudre) => {
    const dialog = h('dialog', { class: 'dialogue', 'aria-labelledby': 'dialogue-titre' },
      h('form', { method: 'dialog', class: 'dialogue__forme' },
        h('h2', { id: 'dialogue-titre', class: 'dialogue__titre' }, titre),
        texte ? h('p', { class: 'dialogue__texte' }, texte) : null,
        contenu ?? null,
        h('div', { class: 'dialogue__boutons' }, boutons.map((b) =>
          h('button', { class: `bouton ${b.style ?? 'bouton--secondaire'}`, value: b.valeur }, b.libelle),
        )),
      ),
    );
    dialog.addEventListener('close', () => {
      dialog.remove();
      resoudre(dialog.returnValue || null);
    });
    // Clic sur le fond : fermeture.
    dialog.addEventListener('click', (ev) => { if (ev.target === dialog) dialog.close(''); });
    document.body.append(dialog);
    dialog.showModal();
  });
}

/** Confirmation simple ; renvoie true si confirmé. */
export async function confirmer({ titre, texte, libelle = 'Confirmer', danger = false }) {
  const r = await demander({
    titre, texte,
    boutons: [
      { valeur: 'annuler', libelle: 'Annuler' },
      { valeur: 'ok', libelle, style: danger ? 'bouton--danger' : 'bouton--principal' },
    ],
  });
  return r === 'ok';
}

/** Message bref en bas d'écran. */
export function notifier(texte) {
  document.querySelector('.notification')?.remove();
  const el = h('div', { class: 'notification', role: 'status' }, texte);
  document.body.append(el);
  setTimeout(() => el.remove(), 3500);
}
