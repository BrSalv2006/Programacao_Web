import { showAlert, hideAlert } from '/js/utils/alert.js'
import { checkExistingSession } from '/js/auth/checkSession.js'

checkExistingSession()

document.addEventListener('DOMContentLoaded', () => {
	const requestForm = document.getElementById('request-form')
	const togglePasswordBtns = document.querySelectorAll('.toggle-password-btn')
	const submitBtn = document.getElementById('submit-btn')
	const loginBtn = document.getElementById('login-btn')

	const emailInput = document.getElementById('email')

	const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

	if (loginBtn) {
		loginBtn.addEventListener('click', (e) => {
			e.preventDefault()
			window.location.href = '/login/'
		})
	}

	requestForm.addEventListener('submit', async (e) => {
		e.preventDefault()

		const email = emailInput.value.trim()

		if (!email) {
			return showAlert('alert', 'Por favor, preencha todos os campos.', 'warning')
		}

		if (!emailRegex.test(email)) {
			return showAlert('alert', 'Formato de e-mail inválido.', 'warning')
		}

		submitBtn.disabled = true
		submitBtn.textContent = 'A enviar...'

		try {
			const response = await fetch('/api/auth/password/request', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ email })
			})

			const data = await response.json()

			if (response.ok && data.success) {
				showAlert('alert', data.message, 'success')
			} else {
				throw new Error(data.message)
			}
		} catch (error) {
			showAlert('alert', error.message, 'error')
		} finally {
			submitBtn.disabled = false
			submitBtn.textContent = 'Recuperar Palavra-passe'
		}
	})
})
