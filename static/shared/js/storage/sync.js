import { getOfflineData, clearOfflineData } from './indexeddb.js'

async function syncQueue(storeName, endpoint) {
	const items = await getOfflineData(storeName)
	if (!items || items.length === 0) return

	const itemsFailed = []

	for (const item of items) {
		try {
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(item.payload)
			})

			if (!response.ok) throw new Error('Falha na resposta da API')
		} catch (error) {
			itemsFailed.push(item)
		}
	}

	await clearOfflineData(storeName)

	if (itemsFailed.length > 0) {
		const { saveOfflineData } = await import('./indexeddb.js')
		for (const failedItem of itemsFailed) {
			await saveOfflineData(storeName, failedItem)
		}
	}
}

async function syncData() {
	if (!navigator.onLine) return

	await syncQueue('medicoes_pendentes', '/api/medicoes')
	await syncQueue('tarefas_pendentes', '/api/tarefas')
}

window.addEventListener('online', syncData)

export { syncData }
