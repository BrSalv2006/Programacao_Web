import { apiFetch } from '/js/storage/api.js'

function initLogout() {
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

async function initSidebar() {
	const sidebarContainer = document.querySelector('.sidebar')
	if (!sidebarContainer) {
		return
	}

	const currentPath = window.location.pathname
	let userRole = 'Pendente'

	try {
		const res = await apiFetch('/api/auth/me')
		const data = await res.json()
		if (data.success && data.data) {
			userRole = data.data.role
			sessionStorage.setItem('role', userRole)
		}
	} catch (error) {
		userRole = sessionStorage.getItem('role') || 'Pendente'
	}

	const isPendente = userRole === 'Pendente'
	const isAdministrador = userRole === 'Administrador'

	const icons = {
		dashboard: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sidebar-icon"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>`,
		ervas: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sidebar-icon"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`,
		planos: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sidebar-icon"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>`,
		lotes: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sidebar-icon"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
		tarefas: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sidebar-icon"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
		medicoes: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sidebar-icon"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>`,
		alertas: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sidebar-icon"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>`,
		utilizadores: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sidebar-icon"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
		logs: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sidebar-icon"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`,
		logout: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sidebar-icon"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>`
	}

	sidebarContainer.innerHTML = `
        <div class="sidebar-header">
            <img src="/img/logo.png" alt="GREENHERB Logo" class="brand-logo">
            <h2 class="text-lg text-black color-dark">GREENHERB</h2>
        </div>
        <nav class="sidebar-nav" id="main-nav">
            <a href="/dashboard/" class="nav-link ${currentPath.includes('/dashboard') ? 'active' : ''}">${icons.dashboard}Dashboard</a>
            ${!isPendente ? `
            <a href="/ervas/" class="nav-link ${currentPath.includes('/ervas') ? 'active' : ''}">${icons.ervas}Ervas Aromáticas</a>
            <a href="/planos/" class="nav-link ${currentPath.includes('/planos') ? 'active' : ''}">${icons.planos}Planos de Cultivo</a>
            <a href="/lotes/" class="nav-link ${currentPath.includes('/lotes') ? 'active' : ''}">${icons.lotes}Lotes de Cultivo</a>
            <a href="/tarefas/" class="nav-link ${currentPath.includes('/tarefas') ? 'active' : ''}">${icons.tarefas}Tarefas</a>
            <a href="/medicoes/" class="nav-link ${currentPath.includes('/medicoes') ? 'active' : ''}">${icons.medicoes}Medições</a>
            <a href="/alertas/" class="nav-link ${currentPath.includes('/alertas') ? 'active' : ''}">${icons.alertas}Alertas</a>
            ` : ''}
			${isAdministrador ? `
			<div id="admin-div" class="admin-separator"><span class="admin-text">ADMINISTRAÇÃO</span></div>
                <a href="/admin/users/" class="nav-link ${currentPath.includes('/admin/users') ? 'active' : ''}">${icons.utilizadores}Utilizadores</a>
                <a href="/admin/logs/" class="nav-link ${currentPath.includes('/admin/logs') ? 'active' : ''}">${icons.logs}Logs de Auditoria</a>
            ` : ''}
        </nav>
        <div class="sidebar-footer">
            <button id="logout-btn" class="btn btn-tertiary logout-btn">${icons.logout}Terminar Sessão</button>
        </div>
    `

	initLogout()

	const activeObj = document.querySelector('#main-nav .active')
	if (activeObj && window.innerWidth <= 768) {
		activeObj.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
	}
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initSidebar)
} else {
	initSidebar()
}
