import { showAlert, hideAlert } from '/js/utils/alert.js'
import { checkExistingSession } from '/js/auth/checkSession.js'

checkExistingSession()

document.addEventListener('DOMContentLoaded', () => {
	const loginForm = document.getElementById('login-form')
	const togglePasswordBtns = document.querySelectorAll('.toggle-password-btn')
	const submitBtn = document.getElementById('submit-btn')
	const registerBtn = document.getElementById('register-btn')
	const recoverBtn = document.getElementById('recover-btn')

	const emailInput = document.getElementById('email')
	const passwordInput = document.getElementById('password')

	const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

	togglePasswordBtns.forEach(btn => {
		btn.addEventListener('click', function () {
			const isPassword = passwordInput.getAttribute('type') === 'password'
			const newType = isPassword ? 'text' : 'password'
			const newIconSrc = isPassword ? '/img/eyeOff.svg' : '/img/eyeOn.svg'

			passwordInput.setAttribute('type', newType)

			togglePasswordBtns.forEach(b => {
				const img = b.querySelector('img')
				if (img) {
					img.src = newIconSrc
				}
			})
		})
	})

	if (registerBtn) {
		registerBtn.addEventListener('click', (e) => {
			e.preventDefault()
			window.location.href = '/register/'
		})
	}

	if (recoverBtn) {
		recoverBtn.addEventListener('click', (e) => {
			e.preventDefault()
			window.location.href = '/password/request'
		})
	}

	loginForm.addEventListener('submit', async (e) => {
		e.preventDefault()

		const email = emailInput.value.trim()
		const password = passwordInput.value

		if (!email || !password) {
			return showAlert('alert', 'Por favor, preencha todos os campos.', 'warning')
		}

		if (!emailRegex.test(email)) {
			return showAlert('alert', 'Formato de e-mail inválido.', 'warning')
		}

		submitBtn.disabled = true
		submitBtn.textContent = 'A autenticar...'

		try {
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ email, password })
			})

			const data = await response.json()

			if (response.ok && data.success) {
				hideAlert('alert')
				window.location.replace('/dashboard/')
			} else {
				throw new Error(data.message)
			}
		} catch (error) {
			showAlert('alert', error.message, 'error')
		} finally {
			submitBtn.disabled = false
			submitBtn.textContent = 'Iniciar Sessão'
		}
	})
})
