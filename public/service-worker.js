const CACHE_NAME = 'GreenHerb-v1'
const URLS_TO_CACHE = [
	'/login/',
	'/login/index.html',
	'/login/login.js',
	'/register/',
	'/register/index.html',
	'/register/register.js',
	'/dashboard/',
	'/dashboard/index.html',
	'/dashboard/dashboard.js',
	'/dashboard/dashboard.css',
	'/ervas/',
	'/ervas/index.html',
	'/ervas/ervas.js',
	'/lotes/',
	'/lotes/index.html',
	'/lotes/lotes.js',
	'/lotes/lotes.css',
	'/planos/',
	'/planos/index.html',
	'/planos/planos.js',
	'/planos/planos.css',
	'/medicoes/',
	'/medicoes/index.html',
	'/medicoes/medicoes.js',
	'/tarefas/',
	'/tarefas/index.html',
	'/tarefas/tarefas.js',
	'/alertas/',
	'/alertas/index.html',
	'/alertas/alertas.js',
	'/admin/logs/',
	'/admin/logs/index.html',
	'/admin/logs/logs.js',
	'/admin/users/',
	'/admin/users/index.html',
	'/admin/users/users.js',
	'/img/logo.png',
	'/css/global.css',
	'/js/utils/alert.js',
	'/js/auth/logout.js',
	'/js/components/sidebar.js',
	'/js/storage/api.js',
	'/js/storage/indexeddb.js',
	'/js/storage/sync.js',
	'/password/request/',
	'/password/request/index.html',
	'/password/request/request.js',
	'/password/reset/',
	'/password/reset/index.html',
	'/password/reset/reset.js',
	'/password/reset/reset.css'
]

self.addEventListener('install', event => {
	event.waitUntil(
		caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_TO_CACHE))
	)
})

self.addEventListener('fetch', event => {
	event.respondWith(
		caches.match(event.request).then(response => {
			return response || fetch(event.request)
		})
	)
})

self.addEventListener('activate', event => {
	event.waitUntil(
		caches.keys().then(cacheNames => {
			return Promise.all(
				cacheNames.map(cache => {
					if (cache !== CACHE_NAME) {
						return caches.delete(cache)
					}
				})
			)
		}).then(() => self.clients.claim())
	)
})
