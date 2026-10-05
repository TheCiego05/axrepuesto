const CACHE = 'llave10-v1';
const ASSETS = ['/index.html','/css/styles.css','/css/extra.css',
  '/js/supabase.js','/js/app.js','/js/auth.js','/js/clientes.js',
  '/js/inventario.js','/js/ordenes.js','/js/facturas.js','/js/config.js',
  '/js/cobros.js','/js/reportes.js','/js/ia.js','/js/usuarios.js','/manifest.json'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
