// New Creation briefly ran at the root of www.mret.co.za. This worker replaces that old one,
// clears what it stored, removes itself and reloads the page, so visitors see the home page.
// New Creation itself now lives at /new-creation/ with its own worker.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => /^nc-2026-/.test(k)).map((k) => caches.delete(k)));
    await self.registration.unregister();
    const cs = await self.clients.matchAll({ type: 'window' });
    cs.forEach((c) => { const u = new URL(c.url); if (!u.pathname.startsWith('/new-creation/')) c.navigate(c.url); });
  })());
});
