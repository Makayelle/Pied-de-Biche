// Petit wrapper IndexedDB maison (promesses), sans dépendance.
const NOM = 'pied-de-biche';
const VERSION_DB = 1;

let connexion = null;

export function ouvrir() {
  if (connexion) return connexion;
  connexion = new Promise((resoudre, rejeter) => {
    const req = indexedDB.open(NOM, VERSION_DB);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('estimations')) db.createObjectStore('estimations', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('photos')) {
        db.createObjectStore('photos', { keyPath: 'id' }).createIndex('estimationId', 'estimationId');
      }
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    req.onsuccess = () => resoudre(req.result);
    req.onerror = () => rejeter(req.error);
    req.onblocked = () => rejeter(new Error('Base de données bloquée par un autre onglet'));
  });
  return connexion;
}

const promesse = (req) => new Promise((ok, ko) => { req.onsuccess = () => ok(req.result); req.onerror = () => ko(req.error); });

async function transaction(stores, mode, travail) {
  const db = await ouvrir();
  const tx = db.transaction(stores, mode);
  const resultat = await travail(tx);
  await new Promise((ok, ko) => { tx.oncomplete = ok; tx.onerror = () => ko(tx.error); tx.onabort = () => ko(tx.error); });
  return resultat;
}

export const lire = (store, cle) => transaction(store, 'readonly', (tx) => promesse(tx.objectStore(store).get(cle)));
export const tous = (store) => transaction(store, 'readonly', (tx) => promesse(tx.objectStore(store).getAll()));
export const parIndex = (store, index, valeur) =>
  transaction(store, 'readonly', (tx) => promesse(tx.objectStore(store).index(index).getAll(valeur)));

/** Écrit une ou plusieurs valeurs (clé optionnelle pour les stores sans keyPath). */
export const ecrire = (store, valeur, cle) =>
  transaction(store, 'readwrite', (tx) => promesse(tx.objectStore(store).put(valeur, cle)));

export const ecrireTout = (store, valeurs) =>
  transaction(store, 'readwrite', (tx) => Promise.all(valeurs.map((v) => promesse(tx.objectStore(store).put(v)))));

export const supprimer = (store, cle) => transaction(store, 'readwrite', (tx) => promesse(tx.objectStore(store).delete(cle)));

/** Supprime une estimation et toutes ses photos en une transaction. */
export const supprimerEstimationEtPhotos = (id) => transaction(['estimations', 'photos'], 'readwrite', async (tx) => {
  const photos = tx.objectStore('photos');
  const cles = await promesse(photos.index('estimationId').getAllKeys(id));
  await Promise.all([...cles.map((c) => promesse(photos.delete(c))), promesse(tx.objectStore('estimations').delete(id))]);
});
