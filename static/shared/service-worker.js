const CACHE_NAME = 'GreenHerb-v1'
const CORE_URLS = [
	'/login/',
	'/login/index.html',
	'/login/login.js',
	'/register/',
	'/register/index.html',
	'/register/register.js',
	'/register/register.css',
	'/password/request/',
	'/password/request/index.html',
	'/password/request/request.js',
	'/password/reset/',
	'/password/reset/index.html',
	'/password/reset/reset.js',
	'/password/reset/reset.css',
	'/img/logo.png',
	'/img/eyeOn.svg',
	'/img/eyeOff.svg',
	'/css/global.css',
	'/js/service-worker-register.js',
	'/js/utils/alert.js',
	'/js/utils/modal.js',
	'/js/auth/checkSession.js',
	'/js/components/sidebar.js',
	'/js/storage/api.js',
	'/js/storage/indexeddb.js',
	'/js/storage/sync.js'
]
const ADMIN_URLS = [
	'/admin/logs/',
	'/admin/logs/index.html',
	'/admin/logs/logs.js',
	'/admin/users/',
	'/admin/users/index.html',
	'/admin/users/users.js'
]
const PRIVATE_ROUTE_PREFIXES = [
	'/dashboard',
	'/ervas',
	'/lotes',
	'/planos',
	'/medicoes',
	'/tarefas',
	'/alertas',
	'/admin'
]

self.addEventListener('install', event => {
	event.waitUntil(
		caches.open(CACHE_NAME)
			.then(cache => cache.addAll(CORE_URLS))
			.catch(() => undefined)
	)
})

self.addEventListener('message', event => {
	const data = event.data || {}
	if (data.type === 'SET_ROLE' && data.role === 'Administrador') {
		caches.open(CACHE_NAME)
			.then(cache => cache.addAll(ADMIN_URLS))
			.catch(() => undefined)
	}
})

function isPrivatePath(pathname) {
	return PRIVATE_ROUTE_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

async function cacheFirst(request) {
	const cached = await caches.match(request)
	if (cached) {
		return cached
	}
	const response = await fetch(request)
	if (response && response.ok) {
		const cache = await caches.open(CACHE_NAME)
		cache.put(request, response.clone())
	}
	return response
}

async function networkFirst(request) {
	const cache = await caches.open(CACHE_NAME)
	try {
		const response = await fetch(request)
		if (response && response.ok) {
			cache.put(request, response.clone())
		}
		return response
	} catch (error) {
		const cached = await cache.match(request)
		if (cached) {
			return cached
		}
		throw error
	}
}

self.addEventListener('fetch', event => {
	if (event.request.method !== 'GET') {
		return
	}

	const url = new URL(event.request.url)
	if (url.origin !== self.location.origin) {
		return
	}

	if (url.pathname.startsWith('/api/')) {
		return
	}

	if (url.pathname === '/service-worker.js') {
		return
	}

	if (isPrivatePath(url.pathname)) {
		event.respondWith(networkFirst(event.request))
		return
	}

	event.respondWith(cacheFirst(event.request))
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
