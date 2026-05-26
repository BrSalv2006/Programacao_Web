export async function checkExistingSession() {
	try {
		const response = await fetch('/api/auth/refresh', { method: 'POST' })
		if (response.ok) {
			window.location.replace('/dashboard/')
		}
	} catch (error) {
	}
}
