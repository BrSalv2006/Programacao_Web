import { apiFetch } from '/js/storage/api.js'

document.addEventListener('DOMContentLoaded', () => {
	const tbody = document.getElementById('table-body')
	const modal = document.getElementById('modal')
	const form = document.getElementById('modal-form')
	const selectEstado = document.getElementById('estadoAcao')
	const justGroup = document.getElementById('justificacao-group')
	let activeId = null

	selectEstado.addEventListener('change', (e) => {
		if (e.target.value === 'Ignorado') {
			justGroup.classList.remove('d-none')
		} else {
			justGroup.classList.add('d-none')
		}
	})

	async function loadAlertas() {
		try {
			const res = await apiFetch('/api/medicoes/alertas')
			const data = await res.json()
			if (data.success) {
				renderTable(data.data)
			}
		} catch (e) {
			tbody.innerHTML = `<tr><td colspan="5">Erro ao carregar dados.</td></tr>`
		}
	}

	function renderTable(alertas) {
		if (!alertas.length) {
			tbody.innerHTML = `<tr><td colspan="5" class="text-center">Sem alertas.</td></tr>`
			return
		}

		tbody.innerHTML = alertas.map(a => {
			const d = new Date(a.createdAt).toLocaleString('pt-PT')
			return `
                        <tr>
                            <td>${d}</td>
                            <td class="text-bold">${a.tipo}</td>
                            <td><span class="alert-badge badge-${a.nivel}">${a.nivel}</span></td>
                            <td>${a.estado}</td>
                            <td>
                                ${a.estado === 'Pendente' ?
					`<button class="action-btn handle-btn text-bold" data-id="${a._id}">Tratar</button>` :
					'<span class="text-xs color-muted">-</span>'
				}
                            </td>
                        </tr>
                    `}).join('')

		document.querySelectorAll('.handle-btn').forEach(btn => btn.addEventListener('click', (e) => {
			activeId = e.target.dataset.id
			form.reset()
			justGroup.classList.add('d-none')
			modal.classList.add('open')
		}))
	}

	document.getElementById('close-modal').addEventListener('click', () => modal.classList.remove('open'))

	form.addEventListener('submit', async (e) => {
		e.preventDefault()
		const estado = selectEstado.value
		const justificacao = document.getElementById('justificacao').value

		if (estado === 'Ignorado' && !justificacao.trim()) return alert('Justificação obrigatória!')

		try {
			const res = await apiFetch(`/api/medicoes/alertas/${activeId}`, {
				method: 'PATCH', body: JSON.stringify({ estado, justificacao })
			})
			if (res.ok) { modal.classList.remove('open'); loadAlertas() }
		} catch (err) { console.error(err) }
	})

	loadAlertas()
})
