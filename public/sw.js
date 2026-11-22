// Minimal service worker: browsers want one before offering "Install app".
// It doesn't cache anything; every request goes to the network as usual, so a
// new deploy is picked up on the next load.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
