import { showAlert, hideAlert } from '/js/utils/alert.js'
import { checkExistingSession } from '/js/auth/checkSession.js'

checkExistingSession()

document.addEventListener('DOMContentLoaded', () => {
	const registerForm = document.getElementById('register-form')
	const togglePasswordBtns = document.querySelectorAll('.toggle-password-btn')
	const submitBtn = document.getElementById('submit-btn')
	const loginBtn = document.getElementById('login-btn')

	const nameInput = document.getElementById('name')
	const emailInput = document.getElementById('email')
	const passwordInput = document.getElementById('password')
	const confirmPasswordInput = document.getElementById('confirm-password')

	const reqLength = document.getElementById('req-length')
	const reqCase = document.getElementById('req-case')
	const reqNumber = document.getElementById('req-number')
	const reqSymbol = document.getElementById('req-symbol')

	const nameRegex = /^[a-zA-ZÀ-ÿ]+\s+[a-zA-ZÀ-ÿ]+.*$/
	const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
	const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/

	togglePasswordBtns.forEach(btn => {
		btn.addEventListener('click', function () {
			const isPassword = passwordInput.getAttribute('type') === 'password'
			const newType = isPassword ? 'text' : 'password'
			const newIconSrc = isPassword ? '/img/eyeOff.svg' : '/img/eyeOn.svg'

			passwordInput.setAttribute('type', newType)
			if (confirmPasswordInput) {
				confirmPasswordInput.setAttribute('type', newType)
			}

			togglePasswordBtns.forEach(b => {
				const img = b.querySelector('img')
				if (img) {
					img.src = newIconSrc
				}
			})
		})
	})

	if (loginBtn) {
		loginBtn.addEventListener('click', (e) => {
			e.preventDefault()
			window.location.href = '/login/'
		})
	}

	passwordInput.addEventListener('input', (e) => {
		const val = e.target.value
		reqLength.className = val.length >= 8 ? 'valid' : 'invalid'
		reqCase.className = (/[A-Z]/.test(val) && /[a-z]/.test(val)) ? 'valid' : 'invalid'
		reqNumber.className = /[0-9]/.test(val) ? 'valid' : 'invalid'
		reqSymbol.className = /[@$!%*?&]/.test(val) ? 'valid' : 'invalid'
	})

	registerForm.addEventListener('submit', async (e) => {
		e.preventDefault()

		const name = nameInput.value.trim()
		const email = emailInput.value.trim()
		const password = passwordInput.value
		const confirmPassword = confirmPasswordInput.value

		if (!name || !email || !password) {
			return showAlert('alert', 'Por favor, preencha todos os campos.', 'warning')
		}

		if (!nameRegex.test(name)) {
			return showAlert('alert', 'Por favor, introduza o seu nome e apelido.', 'warning')
		}

		if (!emailRegex.test(email)) {
			return showAlert('alert', 'Por favor, introduza um e-mail válido.', 'warning')
		}

		if (!passwordRegex.test(password)) {
			return showAlert('alert', 'A palavra-passe não cumpre todos os requisitos.', 'warning')
		}

		if (password !== confirmPassword) {
			return showAlert('alert', 'As palavras-passe não coincidem.', 'warning')
		}

		submitBtn.disabled = true
		submitBtn.textContent = 'A criar conta...'

		try {
			const response = await fetch('/api/auth/register', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ name, email, password, confirmPassword })
			})

			const data = await response.json()

			if (response.ok && data.success) {
				hideAlert('alert')
				window.location.href = '/login/'
			} else {
				throw new Error(data.message)
			}
		} catch (error) {
			showAlert('alert', error.message, 'error')
		} finally {
			submitBtn.disabled = false
			submitBtn.textContent = 'Criar Conta'
		}
	})
})
