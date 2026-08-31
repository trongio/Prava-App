/**
 * Service worker shared by the device build and the web build.
 *
 * Its original and still primary job is caching question and sign images:
 * they are large, repeat constantly across tests, and never change once
 * published.
 *
 * The web build registers it as /sw.js?web=1, which additionally precaches
 * the installable-app assets and shows an offline notice when a full page
 * navigation cannot reach the server. That half stays off inside the native
 * WebView, which has its own offline behaviour and no manifest to install.
 *
 * No HTML response is ever cached on either build. Pages are rendered per
 * signed-in user, and a shared or borrowed browser must not be able to replay
 * someone else's dashboard from disk.
 */
const CACHE_VERSION = 'v2';
const IMAGE_CACHE = `driving-images-${CACHE_VERSION}`;
const STATIC_CACHE = `driving-static-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

const IS_WEB = new URL(self.location.href).searchParams.get('web') === '1';

/** Published artwork: immutable, and the reason this worker exists. */
const IMAGE_PATHS = [
    '/images/ticket_images_webp/',
    '/images/ticket_images_custom_webp/',
    '/images/signs/',
];

/** Content-hashed or otherwise fixed assets belonging to the installed app. */
const STATIC_PATHS = ['/build/assets/', '/icons/'];

const STATIC_FILES = ['/manifest.webmanifest', '/favicon.svg', '/favicon.ico'];

const PRECACHE = [OFFLINE_URL, '/manifest.webmanifest', '/icons/icon-192.png'];

function isImageRequest(url) {
    return IMAGE_PATHS.some((path) => url.pathname.startsWith(path));
}

function isStaticAsset(url) {
    return (
        STATIC_PATHS.some((path) => url.pathname.startsWith(path)) ||
        STATIC_FILES.includes(url.pathname)
    );
}

/** Serve from cache when present, otherwise fetch and keep a copy. */
function cacheFirst(request, cacheName) {
    return caches.open(cacheName).then((cache) =>
        cache.match(request).then((hit) => {
            if (hit) {
                return hit;
            }

            return fetch(request)
                .then((response) => {
                    // A cached error or opaque response would outlive the
                    // deploy it came from, so only keep complete successes.
                    if (response.ok && response.type === 'basic') {
                        cache.put(request, response.clone());
                    }

                    return response;
                })
                .catch(() => new Response('Not available offline', { status: 503 }));
        }),
    );
}

self.addEventListener('install', (event) => {
    if (IS_WEB) {
        event.waitUntil(
            caches
                .open(STATIC_CACHE)
                .then((cache) => cache.addAll(PRECACHE))
                .then(() => self.skipWaiting()),
        );

        return;
    }

    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((names) =>
                Promise.all(
                    names
                        .filter(
                            (name) =>
                                name !== IMAGE_CACHE && name !== STATIC_CACHE,
                        )
                        .map((name) => caches.delete(name)),
                ),
            )
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);

    if (isImageRequest(url)) {
        event.respondWith(cacheFirst(request, IMAGE_CACHE));

        return;
    }

    if (!IS_WEB || url.origin !== self.location.origin) {
        return;
    }

    if (isStaticAsset(url)) {
        event.respondWith(cacheFirst(request, STATIC_CACHE));

        return;
    }

    // Everything else is user-specific. Go to the network, and fall back to
    // the offline notice only when a full page navigation cannot reach it.
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() => caches.match(OFFLINE_URL)),
        );
    }
});

// Kept from the original image-caching worker: lets the app drop the image
// cache without waiting for a version bump.
self.addEventListener('message', (event) => {
    if (event.data === 'clearCache') {
        caches.delete(IMAGE_CACHE);
    }
});
