// v2: red primero, caché solo como respaldo sin conexión. Con "caché
// primero" (v1) cada usuario se quedaba pegado en la versión que cargó
// la primera vez, sin importar cuántas veces se desplegara la app.
const CACHE = 'llave10-v2';
const ASSETS = ['/index.html','/css/styles.css',
  '/js/supabase.js','/js/app.js','/js/auth.js','/js/clientes.js',
  '/js/inventario.js','/js/ordenes.js','/js/facturas.js','/js/config.js',
  '/js/cobros.js','/js/reportes.js','/js/ia.js','/js/usuarios.js',
  '/js/agenda.js','/js/mecanicos.js','/js/utils.js','/js/ux.js',
  '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
