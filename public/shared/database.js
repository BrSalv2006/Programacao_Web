function initDB() {
	return new Promise((resolve, reject) => {
		const dbRequest = indexedDB.open("GreenHerbDB", 1)
		dbRequest.onupgradeneeded = function (event) {
			const db = event.target.result

			const stores = ["ervas", "planos", "lotes", "tarefas", "medicoes", "alertas", "logs"]
			stores.forEach(storeName => {
				if (!db.objectStoreNames.contains(storeName)) {
					db.createObjectStore(storeName, { keyPath: "id", autoIncrement: true })
				}
			})
		}

		dbRequest.onsuccess = (event) => {
			window.appDB = event.target.result
			resolve(event.target.result)
		}
		dbRequest.onerror = (event) => reject(event.target.error)
	})
}

function dbAdd(storeName, data) {
	return new Promise((resolve, reject) => {
		const tx = window.appDB.transaction(storeName, "readwrite")
		const store = tx.objectStore(storeName)
		const request = store.add(data)
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
	})
}

function dbGetAll(storeName) {
	return new Promise((resolve, reject) => {
		const tx = window.appDB.transaction(storeName, "readonly")
		const store = tx.objectStore(storeName)
		const request = store.getAll()
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
	})
}

function dbGet(storeName, id) {
	return new Promise((resolve, reject) => {
		const tx = window.appDB.transaction(storeName, "readonly")
		const store = tx.objectStore(storeName)
		const request = store.get(id)
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
	})
}

function dbUpdate(storeName, data) {
	return new Promise((resolve, reject) => {
		const tx = window.appDB.transaction(storeName, "readwrite")
		const store = tx.objectStore(storeName)
		const request = store.put(data)
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
	})
}

async function registarLog(acao) {
	const user = window.currentUser ? window.currentUser.nome : "Sistema"
	const perfil = window.currentUser ? window.currentUser.perfil : "N/A"

	const log = {
		data: new Date().toLocaleString("pt-PT"),
		utilizador: user,
		perfil: perfil,
		acao: acao
	}

	try {
		await dbAdd("logs", log)
	} catch (error) {
		console.error("Falha ao registar log de auditoria:", error)
	}
}
