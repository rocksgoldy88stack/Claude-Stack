/* ============================================================
   SubTracker — Service Worker
   Caches the app shell so it works fully offline.
   Strategy: cache-first for app files, with network fallback.
   ============================================================ */

var CACHE_NAME = "subtracker-v1";

// Files that make up the "app shell".
var APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
];

// Install: pre-cache the app shell.
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches from previous versions.
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) {
            return key !== CACHE_NAME;
          })
          .map(function (key) {
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch: serve from cache first, fall back to network.
self.addEventListener("fetch", function (event) {
  // Only handle GET requests.
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;

      return fetch(event.request)
        .then(function (response) {
          // Cache same-origin successful responses for next time.
          if (
            response &&
            response.status === 200 &&
            response.type === "basic"
          ) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(function () {
          // Offline and not cached: fall back to the app's main page.
          return caches.match("./index.html");
        });
    })
  );
});
