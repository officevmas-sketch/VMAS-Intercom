const CACHE_NAME = 'vmas-intercom-v1';
const ASSETS = ['./','./index.html','./style.css','./app.js','./firebase-config.js','./manifest.json','./users.json','./assets/icon-192.png','./assets/icon-512.png','./assets/alert.mp3'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(()=>self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', event => { event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request))); });
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { title:'Office Intercom Call', body:'You are being called' };
  event.waitUntil(self.registration.showNotification(data.title || 'Office Intercom Call', { body: data.body || 'You are being called', icon: './assets/icon-192.png', badge: './assets/icon-192.png', vibrate: [500,200,500], data: { url: './index.html' } }));
});
self.addEventListener('notificationclick', event => { event.notification.close(); event.waitUntil(clients.openWindow(event.notification.data?.url || './index.html')); });
