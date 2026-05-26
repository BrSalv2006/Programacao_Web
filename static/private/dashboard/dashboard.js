import { apiFetch } from '/js/storage/api.js'

document.addEventListener('DOMContentLoaded', () => {
	const countLotes = document.getElementById('count-lotes')
	const countTarefas = document.getElementById('count-tarefas')
	const countAlertas = document.getElementById('count-alertas')
	const recentAlertsList = document.getElementById('recent-alerts-list')

	const badgeAvatar = document.getElementById('badge-avatar')
	const badgeRole = document.getElementById('badge-role')

	async function loadDashboardData() {
		try {
			const meRes = await apiFetch('/api/auth/me')
			const meData = await meRes.json()
			if (meData.success && meData.data) {
				badgeAvatar.textContent = meData.data.name.charAt(0).toUpperCase()
				badgeRole.textContent = meData.data.role
			}

			const lotesRes = await apiFetch('/api/lotes?view=compact')
			const lotesData = await lotesRes.json()
			if (lotesData.success) {
				const lotesAtivos = lotesData.data.filter(lote => lote.estado === 'ativo').length
				countLotes.textContent = lotesAtivos
			}

			const tarefasRes = await apiFetch('/api/tarefas?view=compact')
			const tarefasData = await tarefasRes.json()
			if (tarefasData.success) {
				const tarefasPendentes = tarefasData.data.filter(t => t.estado === 'Pendente').length
				countTarefas.textContent = tarefasPendentes
			}

			const alertasRes = await apiFetch('/api/medicoes/alertas?view=compact')
			const alertasData = await alertasRes.json()
			if (alertasData.success) {
				const alertasPendentes = alertasData.data.filter(a => a.estado === 'Pendente')
				const alertasCriticos = alertasPendentes.filter(a => a.nivel === 'Crítico').length

				countAlertas.textContent = alertasCriticos

				renderRecentAlerts(alertasPendentes.slice(0, 5))
			}

		} catch (error) {
			console.error('Erro ao carregar os dados do dashboard:', error)
		}
	}

	function renderRecentAlerts(alertas) {
		if (alertas.length === 0) {
			recentAlertsList.innerHTML = `<li class="color-muted text-sm">Não existem alertas pendentes no momento.</li>`
			return
		}

		recentAlertsList.innerHTML = alertas.map(alerta => {
			const dataFormatada = new Date(alerta.createdAt).toLocaleString('pt-PT')
			return `
				<li class="alert-item">
					<div>
						<h4 class="text-base text-bold color-dark">${alerta.tipo}</h4>
						<span class="text-xs color-muted">${dataFormatada}</span>
					</div>
					<span class="alert-badge badge-${alerta.nivel}">${alerta.nivel}</span>
				</li>
			`
		}).join('')
	}

	loadDashboardData()
})
