document.getElementById('loginForm').addEventListener('submit', function (e) {
	e.preventDefault()

	const username = document.getElementById('username').value
	const perfil = document.getElementById('perfil').value
	const user = {
		nome: username,
		perfil: perfil,
		token: "jwt_simulado_" + Math.random().toString(36).substring(2)
	}

	sessionStorage.setItem('greenherb_user', JSON.stringify(user))
	window.location.href = '/'
})
