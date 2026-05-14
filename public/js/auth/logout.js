import { apiFetch } from '/js/storage/api.js'

export function initLogout() {
	const logoutBtn = document.getElementById('logout-btn')

	if (logoutBtn) {
		logoutBtn.addEventListener('click', async () => {
			try {
				await apiFetch('/api/auth/logout', { method: 'POST' })
			} catch (error) {
				console.error('Erro ao terminar sessão:', error)
			}
			window.location.replace('/login/')
		})
	}
}
