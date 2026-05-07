class AppHeader extends HTMLElement {
	connectedCallback() {
		const pageTitle = this.getAttribute('title') || 'GREENHERB: Gestão de Estufa'
		const currentPath = window.location.pathname

		const isActive = (path) => {
			if (path === '/' && (currentPath === '/' || currentPath === '/index.html')) {
				return 'class="active"'
			}
			if (path !== '/' && currentPath.startsWith(path)) {
				return 'class="active"'
			}
			return ''
		}

		const user = window.currentUser
		const userInfoHTML = user ? `
			<div class="header-user-profile">
				<span class="user-name">👤 ${user.nome} <b>(${user.perfil})</b></span>
				<button id="btn-logout" class="btn-logout">Sair</button>
			</div>
		` : ''

		const auditoriaLink = (user && user.perfil === 'Administrador')
			? `<li><a href="/auditoria/" ${isActive('/auditoria/')}>Auditoria</a></li>`
			: ''

		this.innerHTML = `
			<header>
				${userInfoHTML}
				<h1>${pageTitle}</h1>
				<nav>
					<ul>
						<li><a href="/" ${isActive('/')}>Início</a></li>
						<li><a href="/ervas/" ${isActive('/ervas/')}>Ervas</a></li>
						<li><a href="/planos/" ${isActive('/planos/')}>Planos</a></li>
						<li><a href="/lotes/" ${isActive('/lotes/')}>Lotes</a></li>
						<li><a href="/tarefas/" ${isActive('/tarefas/')}>Tarefas</a></li>
						<li><a href="/medicoes/" ${isActive('/medicoes/')}>Medições & Alertas</a></li>
						${auditoriaLink}
					</ul>
				</nav>
			</header>
		`

		const btnLogout = this.querySelector('#btn-logout')
		if (btnLogout) {
			btnLogout.addEventListener('click', () => {
				sessionStorage.removeItem('greenherb_user')
				window.location.href = '/login/'
			})
		}
	}
}

class AppFooter extends HTMLElement {
	connectedCallback() {
		this.innerHTML = `
			<footer>
				<p>&copy; 2026 GREENHERB. Todos os direitos reservados.</p>
			</footer>
		`
	}
}

customElements.define('app-header', AppHeader)
customElements.define('app-footer', AppFooter)
