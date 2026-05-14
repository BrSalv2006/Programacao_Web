export function showAlert(alertId, msg = '', type = 'error') {
	const alert = document.getElementById(alertId)

	if (alert) {
		alert.textContent = msg
		alert.className = `alert alert-${type}`
	}
}

export function hideAlert(alertId) {
	const alert = document.getElementById(alertId)

	if (alert) {
		alert.textContent = ''
	}
}
