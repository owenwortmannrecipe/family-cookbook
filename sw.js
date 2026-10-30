// Wortmann Family Cookbook — service worker
// Caches the app shell (this page + icons) so the site opens instantly and
// still opens with no signal. It also keeps the few third-party files the app
// needs to START offline (the Firebase SDK, the PDF library, fonts). It never
// touches Firestore/Storage data requests — those go straight to the network
// (the recipes themselves are kept for offline use by Firestore's own local copy).
var CACHE_NAME = 'wfc-shell-v3';
var CDN_CACHE = 'wfc-cdn-v1';
// Versioned, effectively immutable files: cache-first. Fonts: stale-while-revalidate.
var CDN_RE = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|cdnjs\.cloudflare\.com\/ajax\/libs\/html2pdf)/;
var FONT_RE = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;
var SHELL_FILES = [
  './',
  './index.html',
  './recipe-parser.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL_FILES);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_NAME && n !== CDN_CACHE; }).map(function (n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  var url = new URL(req.url);

  // Third-party files needed to start offline.
  if (req.method === 'GET' && (CDN_RE.test(req.url) || FONT_RE.test(req.url))) {
    var swr = FONT_RE.test(req.url);
    event.respondWith(
      caches.open(CDN_CACHE).then(function (cache) {
        function load() {
          return fetch(req).then(function (res) {
            // keep good (or opaque cross-origin) responses only
            if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
            return res;
          });
        }
        return cache.match(req).then(function (hit) {
          if (hit) { if (swr) load().catch(function () {}); return hit; } // cached: never wait on the network
          return load();
        });
      })
    );
    return;
  }

  // Only manage same-origin GET requests for the shell itself.
  // Everything else (Firestore, Storage, Google Fonts, cdnjs, html2pdf) goes
  // straight to the network so live data and remote scripts are never stale.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then(function (res) {
        // Only keep good responses, so a temporary 404/500 never replaces a working cached copy.
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || caches.match('./index.html');
        });
      })
  );
});
