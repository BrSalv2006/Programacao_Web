const CACHE_NAME = "greenherb-v1"
const ASSETS_TO_CACHE = [
	"/",
	"/shared/database.js",
	"/shared/components.js",
	"/shared/auth.js",
	"/shared/service-worker-register.js",
	"/shared/style.css",
	"/shared/images/greenhouse.png",
	"/index.html",
	"/home.css",
	"/home.js",
	"/login/",
	"/login/index.html",
	"/login/login.css",
	"/login/login.js",
	"/planos/",
	"/planos/index.html",
	"/planos/planos.css",
	"/planos/planos.js",
	"/lotes/",
	"/lotes/index.html",
	"/lotes/lotes.css",
	"/lotes/lotes.js",
	"/tarefas/",
	"/tarefas/index.html",
	"/tarefas/tarefas.css",
	"/tarefas/tarefas.js",
	"/medicoes/",
	"/medicoes/index.html",
	"/medicoes/medicoes.css",
	"/medicoes/medicoes.js",
	"/ervas/",
	"/ervas/index.html",
	"/ervas/ervas.css",
	"/ervas/ervas.js",
	"/auditoria/",
	"/auditoria/index.html",
	"/auditoria/auditoria.css",
	"/auditoria/auditoria.js"
]

self.addEventListener("install", event => {
	self.skipWaiting()
	event.waitUntil(
		caches.open(CACHE_NAME)
			.then(cache => cache.addAll(ASSETS_TO_CACHE))
			.catch(err => console.error("Falha ao fazer cache dos assets:", err))
	)
})

self.addEventListener("activate", event => {
	event.waitUntil(self.clients.claim())

	event.waitUntil(
		caches.keys().then(cacheNames => {
			return Promise.all(
				cacheNames.map(cacheName => {
					if (cacheName !== CACHE_NAME) {
						return caches.delete(cacheName)
					}
				})
			)
		})
	)
})

self.addEventListener("fetch", event => {
	if (event.request.method !== 'GET') return

	event.respondWith(
		caches.match(event.request).then(cachedResponse => {
			if (cachedResponse) {
				fetch(event.request).then(networkResponse => {
					if (networkResponse && networkResponse.status === 200) {
						caches.open(CACHE_NAME).then(cache => {
							cache.put(event.request, networkResponse.clone())
						})
					}
				}).catch(() => { })

				return cachedResponse
			}

			return fetch(event.request).catch(() => { })
		})
	)
})
