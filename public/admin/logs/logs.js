import { apiFetch } from '/js/storage/api.js'

document.addEventListener('DOMContentLoaded', () => {
	const tbody = document.getElementById('table-body')

	async function loadLogs() {
		try {
			const res = await apiFetch('/api/admin/logs')
			const data = await res.json()
			if (data.success) {
				renderTable(data.data)
			} else {
				throw data
			}
		} catch (e) {
			tbody.innerHTML = `
				<tr>
					<td colspan="5" class="color-danger">Acesso Negado. Apenas Admins.</td>
				</tr>
			`
		}
	}

	function renderTable(logs) {
		if (!logs.length) {
			tbody.innerHTML = `
				<tr>
					<td colspan="5" class="text-center">Sem registos.</td>
				</tr>
			`
			return
		}

		tbody.innerHTML = logs.map(log => {
			const date = new Date(log.createdAt).toLocaleString('pt-PT')
			const user = log.utilizadorId ? log.utilizadorId.name : 'Sistema'

			const acaoFormatada = (log.acao || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())

			let detailsText = ''
			if (log.detalhes) {
				const entries = Object.entries(log.detalhes).filter(([k]) => k !== '_id' && k !== '__v' && k !== 'createdAt' && k !== 'updatedAt')
				detailsText = entries.map(([k, v]) => `${k}: ${typeof v === 'object' && v !== null ? JSON.stringify(v) : v}`).join(' | ')
				if (detailsText.length > 80) detailsText = detailsText.substring(0, 80) + '...'
			}

			return `
                <tr>
                    <td class="text-xs">${date}</td>
                    <td class="text-bold color-dark">${user}</td>
                    <td><span class="alert-badge badge-Informativo">${acaoFormatada}</span></td>
                    <td>${log.entidade}</td>
                    <td class="text-xs color-muted" title='${JSON.stringify(log.detalhes)}'>${detailsText}</td>
                </tr>
            `}).join('')
	}

	loadLogs()
})
