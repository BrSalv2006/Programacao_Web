export function openModal(modalId) {
	const modal = document.getElementById(modalId)
	if (modal) modal.classList.add('open')
}

export function closeModal(modalId, formId = null) {
	const modal = document.getElementById(modalId)
	if (modal) {
		modal.classList.remove('open')
		if (formId) {
			const form = document.getElementById(formId)
			if (form) form.reset()
		}
	}
}

export function setupModalCloseButtons() {
	document.addEventListener('click', (e) => {
		if (e.target.hasAttribute('data-close-modal')) {
			const modalId = e.target.getAttribute('data-close-modal')
			const formId = e.target.getAttribute('data-reset-form')
			closeModal(modalId, formId)
		}
	})
}
