import { apiFetch } from '/js/storage/api.js'
import { showAlert } from '/js/utils/alert.js'
import { openModal, closeModal, setupModalCloseButtons } from '/js/utils/modal.js'

document.addEventListener('DOMContentLoaded', () => {
	setupModalCloseButtons()

	const tbody = document.getElementById('table-body')
	const form = document.getElementById('modal-form')
	const exportBtn = document.getElementById('export-btn')
	const addBtn = document.getElementById('add-btn')
	const confirmCancelBtn = document.getElementById('confirm-cancel-btn')

	let taskToCancelId = null

	if (exportBtn) exportBtn.addEventListener('click', () => window.open('/api/tarefas/exportar', '_blank'))

	if (addBtn) {
		addBtn.addEventListener('click', () => {
			loadLotesParaBase()
			openModal('modal')
		})
	}

	async function loadLotesParaBase() {
		try {
			const res = await apiFetch('/api/lotes?view=select')
			const data = await res.json()
			if (data.success) {
				const ativos = data.data.filter(l => l.estado === 'ativo')
				document.getElementById('loteId').innerHTML = '<option value="">Selecione o Lote</option>' + ativos.map(l => `<option value="${l._id}">Lote ${l.ervaId?.nome || 'Desconhecido'} (${l.modo})</option>`).join('')
			}
		} catch (e) { }
	}

	async function loadTarefas() {
		try {
			const res = await apiFetch('/api/tarefas')
			const data = await res.json()
			if (data.success) renderTable(data.data)
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
			const descricao = t.descricao ? t.descricao : ''
			let estadoLabel = t.estado

			return `
				<tr>
					<td class="text-bold color-dark">${tipo}</td>
    				<td class="text-sm color-muted">${descricao}</td>
					<td class="text-xs color-muted">${t.loteId?._id || 'N/A'}</td>
					<td>${dataFormatada}</td>
					<td><span class="alert-badge badge-${t.estado === 'Pendente' ? 'Aviso' : (t.estado === 'Expirada' ? 'Critico' : 'Informativo')}">${t.estado}</span></td>
					<td>
						${t.estado === 'Pendente' ? `
							<div class="actions-scroll-container">
								<button class="action-btn exec-btn text-bold" data-id="${t._id}">Marcar como Feito</button>
								<button class="action-btn cancel-btn color-danger" data-id="${t._id}">Anular</button>
							</div>
						` : `<span class="text-xs color-muted">${estadoLabel}</span>`}
					</td>
				</tr>
			`
		}).join('')
	}

	tbody.addEventListener('click', async (e) => {
		const target = e.target
		if (!target.classList.contains('action-btn')) return

		const id = target.dataset.id

		if (target.classList.contains('exec-btn')) {
			try {
				const res = await apiFetch(`/api/tarefas/${id}`, {
					method: 'PATCH',
					body: JSON.stringify({ estado: 'Executada', dataExecucao: new Date() })
				})
				if (res.ok) {
					showAlert('page-alert', 'Tarefa marcada como feita!', 'success')
					loadTarefas()
				} else {
					const errorData = await res.json()
					showAlert('page-alert', errorData.message || 'Erro ao executar tarefa.', 'error')
				}
			} catch (err) {
				showAlert('page-alert', 'Erro ao contactar servidor.', 'error')
			}
		} else if (target.classList.contains('cancel-btn')) {
			taskToCancelId = id
			openModal('cancel-modal')
		}
	})

	if (confirmCancelBtn) {
		confirmCancelBtn.addEventListener('click', async () => {
			if (!taskToCancelId) return
			try {
				const res = await apiFetch(`/api/tarefas/${taskToCancelId}`, {
					method: 'PATCH',
					body: JSON.stringify({ estado: 'Anulada' })
				})
				if (res.ok) {
					closeModal('cancel-modal')
					taskToCancelId = null
					showAlert('page-alert', 'Tarefa anulada com sucesso!', 'success')
					loadTarefas()
				} else {
					const errorData = await res.json()
					closeModal('cancel-modal')
					showAlert('page-alert', errorData.message || 'Erro ao anular tarefa.', 'error')
				}
			} catch (err) {
				closeModal('cancel-modal')
				showAlert('page-alert', 'Erro de comunicação.', 'error')
			}
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
					closeModal('modal', 'modal-form')
					showAlert('page-alert', 'Tarefa criada com sucesso!', 'success')
					loadTarefas()
				} else {
					showAlert('modal-alert', data.message || 'Erro ao criar tarefa.', 'error')
				}
			} catch (err) {
				showAlert('modal-alert', 'Erro de comunicação.', 'error')
			}
		})
	}

	loadTarefas()
})
