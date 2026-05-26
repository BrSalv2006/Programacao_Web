import { apiFetch } from '/js/storage/api.js'

document.addEventListener('DOMContentLoaded', () => {
	const tbody = document.getElementById('table-body')
	const exportBtn = document.getElementById('export-btn')

	let allLogs = []

	if (exportBtn) {
		exportBtn.addEventListener('click', () => {
			const acaoTerm = document.getElementById('filter-acao').value.trim()
			const entidadeTerm = document.getElementById('filter-entidade').value
			const params = new URLSearchParams()
			if (acaoTerm) params.append('acao', acaoTerm)
			if (entidadeTerm) params.append('entidade', entidadeTerm)

			const url = `/api/admin/logs/exportar?${params.toString()}`
			window.open(url, '_blank')
		})
	}

	async function loadLogs() {
		try {
			const res = await apiFetch('/api/admin/logs')
			const data = await res.json()
			if (data.success) {
				allLogs = data.data
				renderTable(allLogs)
			} else {
				throw data
			}
		} catch (e) {
			tbody.innerHTML = `
				<tr>
                    <td colspan="5" class="color-danger text-center">Acesso Negado. Apenas Admins.</td>
				</tr>
			`
		}
	}

	function applyFilters() {
		const acaoTerm = document.getElementById('filter-acao').value.toLowerCase()
		const entidadeTerm = document.getElementById('filter-entidade').value

		const filtered = allLogs.filter(log => {
			const matchAcao = (log.acao || '').toLowerCase().includes(acaoTerm)
			const matchEntidade = entidadeTerm === "" || log.entidade === entidadeTerm
			return matchAcao && matchEntidade
		})

		renderTable(filtered)
	}

	document.getElementById('filter-acao').addEventListener('input', applyFilters)
	document.getElementById('filter-entidade').addEventListener('change', applyFilters)

	function renderTable(logs) {
		if (!logs.length) {
			tbody.innerHTML = `
				<tr>
                    <td colspan="5" class="text-center">Sem registos encontrados.</td>
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
            `
		}).join('')
	}

	loadLogs()
})
