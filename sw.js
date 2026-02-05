const CACHE_NAME = 'scheduler-v7';
const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './css/theme.css',
    './js/app.js',
    './js/ui.js',
    './js/store.js',
    './js/utils.js',
    './js/constants.js',
    './js/taskAllocator.js',
    './js/continuity.js',
    './js/export.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting(); // Force immediate activation
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        return caches.delete(name);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => response || fetch(e.request))
    );
});
