import { showAlert, hideAlert } from '/js/utils/alert.js'

document.addEventListener('DOMContentLoaded', () => {
	const resetForm = document.getElementById('reset-form')
	const togglePasswordBtns = document.querySelectorAll('.toggle-password-btn')
	const submitBtn = document.getElementById('submit-btn')
	const loginBtn = document.getElementById('login-btn')
	const targetEmail = document.getElementById('target-email')

	const passwordInput = document.getElementById('password')
	const confirmPasswordInput = document.getElementById('confirm-password')

	const reqLength = document.getElementById('req-length')
	const reqCase = document.getElementById('req-case')
	const reqNumber = document.getElementById('req-number')
	const reqSymbol = document.getElementById('req-symbol')

	const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/

	const params = new URLSearchParams(window.location.search)
	const token = params.get('token')
	const email = params.get('email')

	if (!token || !email) {
		showAlert('alert', 'Link de reposição inválido ou incompleto.', 'error')
		submitBtn.disabled = true
		return
	}

	targetEmail.textContent = `A redefinir para: ${email}`

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

	passwordInput.addEventListener('input', (e) => {
		const val = e.target.value
		reqLength.className = val.length >= 8 ? 'valid' : 'invalid'
		reqCase.className = (/[A-Z]/.test(val) && /[a-z]/.test(val)) ? 'valid' : 'invalid'
		reqNumber.className = /[0-9]/.test(val) ? 'valid' : 'invalid'
		reqSymbol.className = /[@$!%*?&]/.test(val) ? 'valid' : 'invalid'
	})

	if (loginBtn) {
		loginBtn.addEventListener('click', (e) => {
			e.preventDefault()
			window.location.href = '/login/'
		})
	}

	resetForm.addEventListener('submit', async (e) => {
		e.preventDefault()

		const password = passwordInput.value
		const confirm = confirmPasswordInput.value

		if (!passwordRegex.test(password)) {
			return showAlert('alert', 'A password não cumpre os requisitos mínimos.', 'warning')
		}

		if (password !== confirm) {
			return showAlert('alert', 'As passwords não coincidem.', 'warning')
		}

		submitBtn.disabled = true
		submitBtn.textContent = 'A atualizar...'

		try {
			const response = await fetch('/api/auth/password/reset', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, token, newPassword: password })
			})

			const data = await response.json()

			if (response.ok && data.success) {
				showAlert('alert', 'Sucesso! A password foi alterada.', 'success')
				setTimeout(() => window.location.replace('/login/'), 2000)
			} else {
				throw new Error(data.message || 'Erro ao redefinir password.')
			}
		} catch (error) {
			showAlert('alert', error.message, 'error')
		} finally {
			submitBtn.disabled = false
			submitBtn.textContent = 'Atualizar Password'
		}
	})
})
