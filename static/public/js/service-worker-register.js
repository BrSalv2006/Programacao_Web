import { syncData } from '/js/storage/sync.js'

if ('serviceWorker' in navigator) {
	navigator.serviceWorker.register('/service-worker.js').then(() => {
		sendRoleToServiceWorker()
	})
}

if (navigator.onLine) {
	syncData()
}

async function sendRoleToServiceWorker() {
	try {
		const response = await fetch('/api/auth/me', { credentials: 'include' })
		if (!response.ok) {
			return
		}
		const data = await response.json()
		const role = data?.data?.role
		if (!role) {
			return
		}
		const registration = await navigator.serviceWorker.ready
		if (registration.active) {
			registration.active.postMessage({ type: 'SET_ROLE', role })
		}
	} catch (_error) {
	}
}
