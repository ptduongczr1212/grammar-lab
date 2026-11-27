// Grammar Lab IELTS — Progressive Web App Service Worker
const CACHE_NAME = 'gl-ielts-v4';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.png',
  './favicon.svg',
  './favicon.ico',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png'
];

// Install Event: Cache essential assets and activate immediately
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('Cache prefetch partial warning:', err);
      });
    })
  );
});

// Activate Event: Clean up old caches and claim clients immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('PWA deleting legacy cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Network-First Strategy for HTML/Scripts
// This guarantees that any update you push to GitHub Pages is immediately served live!
// If offline, falls back seamlessly to cache.
self.addEventListener('fetch', event => {
  const req = event.request;
  
  // Only handle GET requests for our own origin
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) {
    return;
  }

  // API calls to Google Gemini or external dictionaries should go direct to network
  if (req.url.includes('googleapis.com') || req.url.includes('dictionaryapi.dev') || req.url.includes('api.dictionaryapi.dev') || req.url.includes('mymemory.translated.net')) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then(networkRes => {
        if (networkRes && networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(req, resClone);
          });
        }
        return networkRes;
      })
      .catch(() => {
        // Offline fallback
        return caches.match(req).then(cachedRes => {
          if (cachedRes) return cachedRes;
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

// Notification Click Event: Focus or Open app directly
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  const targetUrl = new URL('./index.html#/practice', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('grammar-lab') && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Listen for message from main app (e.g. Schedule SRS notification)
self.addEventListener('message', event => {
  const data = event.data;
  if (!data) return;

  if (data.type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(data.title || 'Grammar Lab IELTS', {
      body: data.body || 'Bạn có từ vựng đến lịch ôn tập hôm nay!',
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [100, 50, 100],
      data: { url: './index.html#/practice' }
    });
  } else if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
