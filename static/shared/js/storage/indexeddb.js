const DB_NAME = 'GreenherbDB'
const DB_VERSION = 1

function initDB() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION)

		request.onupgradeneeded = event => {
			const db = event.target.result
			if (!db.objectStoreNames.contains('api_cache')) {
				db.createObjectStore('api_cache', { keyPath: 'url' })
			}
			if (!db.objectStoreNames.contains('lotes')) {
				db.createObjectStore('lotes', { keyPath: '_id' })
			}
			if (!db.objectStoreNames.contains('medicoes_pendentes')) {
				db.createObjectStore('medicoes_pendentes', { keyPath: 'id', autoIncrement: true })
			}
			if (!db.objectStoreNames.contains('tarefas_pendentes')) {
				db.createObjectStore('tarefas_pendentes', { keyPath: 'id', autoIncrement: true })
			}
		}

		request.onsuccess = event => resolve(event.target.result)
		request.onerror = event => reject(event.target.error)
	})
}

async function saveOfflineData(storeName, data) {
	const db = await initDB()
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(storeName, 'readwrite')
		const store = transaction.objectStore(storeName)
		const request = store.put(data)

		request.onsuccess = () => resolve()
		request.onerror = () => reject(request.error)
	})
}

async function getOfflineData(storeName) {
	const db = await initDB()
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(storeName, 'readonly')
		const store = transaction.objectStore(storeName)
		const request = store.getAll()

		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
	})
}

async function clearOfflineData(storeName) {
	const db = await initDB()
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(storeName, 'readwrite')
		const store = transaction.objectStore(storeName)
		const request = store.clear()

		request.onsuccess = () => resolve()
		request.onerror = () => reject(request.error)
	})
}

async function getOfflineDataByKey(storeName, key) {
	const db = await initDB()
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(storeName, 'readonly')
		const store = transaction.objectStore(storeName)
		const request = store.get(key)

		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
	})
}


export { saveOfflineData, getOfflineData, clearOfflineData, getOfflineDataByKey }
