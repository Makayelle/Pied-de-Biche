// Enregistrement du service worker et bandeau « Nouvelle version disponible ».
import { h } from './dom.js';

let majDemandee = false;

export function enregistrerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // Au tout premier chargement, clients.claim() déclenche aussi controllerchange :
  // on ne recharge que si l'utilisateur a demandé la mise à jour via le bandeau.
  let rechargementEnCours = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!majDemandee || rechargementEnCours) return;
    rechargementEnCours = true;
    location.reload();
  });

  navigator.serviceWorker.register('sw.js').then((reg) => {
    // Une version attend déjà (onglet resté ouvert pendant la mise à jour).
    if (reg.waiting && navigator.serviceWorker.controller) proposer(reg.waiting);

    reg.addEventListener('updatefound', () => {
      const nouveau = reg.installing;
      nouveau?.addEventListener('statechange', () => {
        if (nouveau.state === 'installed' && navigator.serviceWorker.controller) proposer(nouveau);
      });
    });

    // Vérifie les mises à jour au retour sur l'app (utile en PWA installée).
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch((err) => console.warn('Service worker non enregistré :', err));
}

function proposer(worker) {
  if (document.querySelector('.toast-maj')) return;
  const toast = h('div', { class: 'toast-maj', role: 'status' },
    h('p', {}, 'Nouvelle version disponible'),
    h('button', {
      class: 'bouton bouton--principal', type: 'button',
      onclick: () => { majDemandee = true; worker.postMessage('ACTIVER'); },
    }, 'Recharger'),
  );
  document.body.append(toast);
}
