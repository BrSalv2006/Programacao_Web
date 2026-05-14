import { saveOfflineData, getOfflineData, clearOfflineData, getOfflineDataByKey } from './indexeddb.js'

async function handleOfflineSave(url, options) {
	if (!options.body) {
		throw new Error('Sem dados para guardar offline.')
	}

	const payload = JSON.parse(options.body)

	if (url.includes('/api/medicoes')) {
		await saveOfflineData('medicoes_pendentes', { payload })
		return { success: true, message: 'Guardado offline.', offline: true }
	}

	if (url.includes('/api/tarefas')) {
		await saveOfflineData('tarefas_pendentes', { payload })
		return { success: true, message: 'Guardado offline.', offline: true }
	}

	throw new Error('Operação não suportada em modo offline.')
}

async function apiFetch(url, options = {}) {
	options.headers = {
		'Content-Type': 'application/json',
		...options.headers
	}
	options.credentials = 'include'

	const isWriteOperation = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(options.method)

	if (!navigator.onLine && isWriteOperation) {
		const offlineResult = await handleOfflineSave(url, options)
		return new Response(JSON.stringify(offlineResult), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	try {
		let response = await fetch(url, options)

		if (response.status === 401 && !url.includes('/api/auth/')) {
			const refreshResponse = await fetch('/api/auth/refresh', {
				method: 'POST',
				credentials: 'include'
			})

			if (refreshResponse.ok) {
				response = await fetch(url, options)
			} else {
				window.location.replace('/login/')
				return Promise.reject('Sessão expirada.')
			}
		}

		if (response.ok && !isWriteOperation && options.method !== 'POST') {
			const cloned = response.clone()
			cloned.json().then(async data => {
				await saveOfflineData('api_cache', { url: url.split('?')[0], data: data })
				if (url.includes('/api/lotes') && data.data && Array.isArray(data.data)) {
					await clearOfflineData('lotes')
					for (const lote of data.data) {
						await saveOfflineData('lotes', lote)
					}
				}
			}).catch((e) => console.error(e))
		}

		return response
	} catch (error) {
		if (isWriteOperation) {
			const offlineResult = await handleOfflineSave(url, options)
			return new Response(JSON.stringify(offlineResult), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		} else {
			if (url.includes('/api/lotes')) {
				try {
					const lotesDb = await getOfflineData('lotes')
					if (lotesDb && lotesDb.length > 0) {
						return new Response(JSON.stringify({ success: true, data: lotesDb }), {
							status: 200,
							headers: { 'Content-Type': 'application/json' }
						})
					}
				} catch (e) {
					console.error('Falha a ler lotes.', e)
				}
			}

			const cached = await getOfflineDataByKey('api_cache', url.split('?')[0])
			if (cached) {
				return new Response(JSON.stringify(cached.data), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
			}
		}
		throw error
	}
}

export { apiFetch }
