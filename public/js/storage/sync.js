import { getOfflineData, clearOfflineData } from './indexeddb.js'

async function syncData() {
	if (!navigator.onLine) {
		return
	}

	const medicoes = await getOfflineData('medicoes_pendentes')

	if (medicoes.length > 0) {
		for (const medicao of medicoes) {
			try {
				await fetch('/api/medicoes', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(medicao.payload)
				})
			} catch (error) {
				return
			}
		}
		await clearOfflineData('medicoes_pendentes')
	}

	const tarefas = await getOfflineData('tarefas_pendentes')

	if (tarefas.length > 0) {
		for (const tarefa of tarefas) {
			try {
				await fetch('/api/tarefas', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(tarefa.payload)
				})
			} catch (error) {
				return
			}
		}
		await clearOfflineData('tarefas_pendentes')
	}
}

window.addEventListener('online', syncData)

export { syncData }
