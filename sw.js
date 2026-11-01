// Service worker de Pied-de-Biche — stratégie cache-first versionnée.
// Changer VERSION (et js/version.js) à chaque mise en ligne pour déclencher la mise à jour.
const VERSION = '0.3.0';
const CACHE = `pdb-${VERSION}`;

// Liste exhaustive des fichiers de l'app (chemins relatifs, vérifiée par les tests).
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/tokens.css',
  'css/app.css',
  'css/print.css',
  'js/version.js',
  'js/app.js',
  'js/router.js',
  'js/calc/defaults.js',
  'js/calc/engine.js',
  'js/data/schema.js',
  'js/data/store.js',
  'js/ui/dom.js',
  'js/ui/shell.js',
  'js/ui/accueil.js',
  'js/ui/etape.js',
  'js/ui/composants.js',
  'js/ui/contexte.js',
  'js/ui/ecran-bien.js',
  'js/ui/ecran-pieces.js',
  'js/ui/ecran-postes.js',
  'js/ui/ecran-financement.js',
  'js/ui/reglages.js',
  'js/ui/maj.js',
  'assets/logo.svg',
  'assets/favicon.svg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/maskable-512.png',
  'assets/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((c) => c.startsWith('pdb-') && c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

// Le bandeau « Nouvelle version disponible » demande l'activation immédiate.
self.addEventListener('message', (event) => {
  if (event.data === 'ACTIVER') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((enCache) => {
      if (enCache) return enCache;
      return fetch(req).catch(() => {
        // Hors ligne : toute navigation retombe sur la coquille de l'app.
        if (req.mode === 'navigate') return caches.match('index.html');
        return Response.error();
      });
    })
  );
});
