import { apiFetch } from '/js/storage/api.js'

document.addEventListener('DOMContentLoaded', () => {
	const tbody = document.getElementById('table-body')
	const modal = document.getElementById('modal')
	const form = document.getElementById('modal-form')
	const closeBtn = document.getElementById('close-modal')
	const addBtn = document.getElementById('add-btn')
	const modalAlert = document.getElementById('modal-alert')
	const pageAlert = document.getElementById('page-alert')

	const exportBtn = document.getElementById('export-btn')
	if (exportBtn) {
		exportBtn.addEventListener('click', () => {
			window.open('/api/tarefas/exportar', '_blank')
		})
	}

	async function loadTarefas() {
		try {
			const res = await apiFetch('/api/tarefas')
			const data = await res.json()
			if (data.success) {
				renderTable(data.data)
			}
		} catch (e) {
			tbody.innerHTML = `<tr><td colspan="5">Erro de rede.</td></tr>`
		}
	}

	function renderTable(tarefas) {
		if (!tarefas.length) {
			tbody.innerHTML = `<tr><td colspan="5" class="text-center">Sem tarefas.</td></tr>`
			return
		}

		tbody.innerHTML = tarefas.map(t => {
			const dataFormatada = new Date(t.dataAgendada).toLocaleDateString('pt-PT', { hour: '2-digit', minute: '2-digit' })
			const tipo = (t.tipo || '').charAt(0).toUpperCase() + (t.tipo || '').slice(1)
			return `
                        <tr>
                            <td class="text-bold color-dark">${tipo}</td>
                            <td class="text-xs color-muted">${t.loteId?._id || 'N/A'}</td>
                            <td>${dataFormatada}</td>
                            <td><span class="alert-badge badge-${t.estado === 'Pendente' ? 'Aviso' : (t.estado === 'Expirada' ? 'Critico' : 'Informativo')}">${t.estado}</span></td>
                            <td>
                                ${t.estado === 'Pendente' ?
					`<button class="action-btn exec-btn text-bold" data-id="${t._id}">Marcar como Feito</button>` :
					`<span class="text-xs color-muted">${t.estado === 'Expirada' ? 'Expirada' : 'Concluída'}</span>`
				}
                            </td>
                        </tr>
                    `}).join('')

		document.querySelectorAll('.exec-btn').forEach(btn => btn.addEventListener('click', async (e) => {
			const id = e.target.dataset.id
			try {
				const res = await apiFetch(`/api/tarefas/${id}`, {
					method: 'PATCH',
					body: JSON.stringify({ estado: 'Executada', dataExecucao: new Date() })
				})
				if (res.ok) {
					loadTarefas()
				} else {
					const errorData = await res.json()
					if (pageAlert) {
						pageAlert.textContent = errorData.message || 'Erro ao executar tarefa.'
						pageAlert.className = 'alert alert-error'
						pageAlert.style.display = 'block'
					} else {
						alert(errorData.message || 'Erro ao executar tarefa.')
					}
				}
			} catch (err) {
				console.error(err)
				if (pageAlert) {
					pageAlert.textContent = 'Erro ao contactar servidor.'
					pageAlert.className = 'alert alert-error'
					pageAlert.style.display = 'block'
				} else {
					alert('Erro ao contactar servidor.')
				}
			}
		}))
	}

	async function loadLotesParaBase() {
		try {
			const res = await apiFetch('/api/lotes')
			const data = await res.json()
			if (data.success) {
				const ativos = data.data.filter(l => l.estado === 'ativo')
				document.getElementById('loteId').innerHTML = '<option value="">Selecione o Lote</option>' +
					ativos.map(l => `<option value="${l._id}">Lote ${l.ervaId?.nome || 'Desconhecido'} (${l.modo})</option>`).join('')
			}
		} catch (e) { }
	}

	if (addBtn) {
		addBtn.addEventListener('click', () => {
			loadLotesParaBase()
			modal.classList.add('open')
		})
	}

	if (closeBtn) {
		closeBtn.addEventListener('click', () => {
			modal.classList.remove('open')
			form.reset()
			if (modalAlert) modalAlert.style.display = 'none'
		})
	}

	if (form) {
		form.addEventListener('submit', async (e) => {
			e.preventDefault()
			const payload = {
				loteId: document.getElementById('loteId').value,
				tipo: (document.getElementById('tipo').value).toLowerCase(),
				dataAgendada: document.getElementById('dataAgendada').value,
				descricao: document.getElementById('descricao').value
			}

			try {
				const response = await apiFetch('/api/tarefas', {
					method: 'POST',
					body: JSON.stringify(payload)
				})
				const data = await response.json()

				if (response.ok && data.success) {
					modal.classList.remove('open')
					form.reset()
					if (pageAlert) {
						pageAlert.textContent = 'Tarefa criada com sucesso!'
						pageAlert.className = 'alert alert-success'
						pageAlert.style.display = 'block'
					}
					loadTarefas()
				} else {
					if (modalAlert) {
						modalAlert.textContent = data.message || 'Erro ao criar tarefa.'
						modalAlert.className = 'alert alert-error'
						modalAlert.style.display = 'block'
					}
				}
			} catch (err) {
				if (modalAlert) {
					modalAlert.textContent = 'Erro de comunicação.'
					modalAlert.className = 'alert alert-error'
					modalAlert.style.display = 'block'
				}
			}
		})
	}

	loadTarefas()
})
