import { syncData } from './storage/sync.js'

if ('serviceWorker' in navigator) {
	navigator.serviceWorker.register('/service-worker.js')
}

if (navigator.onLine) {
	syncData()
}
