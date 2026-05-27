import { apiFetch } from '/js/storage/api.js'
import { showAlert, hideAlert } from '/js/utils/alert.js'
import { openModal, closeModal, setupModalCloseButtons } from '/js/utils/modal.js'

document.addEventListener('DOMContentLoaded', () => {
	setupModalCloseButtons()

	const tbody = document.getElementById('table-body')
	const form = document.getElementById('modal-form')
	const addBtn = document.getElementById('add-btn')
	const importBtn = document.getElementById('import-btn')
	const importForm = document.getElementById('import-form')

	let ervas = []
	let editingId = null

	async function loadErvas() {
		try {
			const user = JSON.parse(localStorage.getItem('user') || '{}')
			const url = user.role === 'Técnico' ? '/api/ervas' : '/api/ervas?all=true'
			const response = await apiFetch(url)
			const data = await response.json()
			if (data.success) {
				ervas = data.data
				renderTable()
			}
		} catch (error) {
			tbody.innerHTML = `<tr><td colspan="7" class="color-danger text-center">Erro ao carregar dados.</td></tr>`
		}
	}

	function renderTable() {
		if (ervas.length === 0) {
			tbody.innerHTML = `<tr><td colspan="7" class="color-muted text-center">Nenhuma erva registada.</td></tr>`
			return
		}

		const user = JSON.parse(localStorage.getItem('user') || '{}')
		const isTecnico = user.role === 'Técnico'

		tbody.innerHTML = ervas.map(erva => `
			<tr>
				<td class="text-bold color-dark">${erva.nome}</td>
				<td class="color-muted italic">${erva.nomeCientifico}</td>
				<td>${erva.variedade}</td>
				<td>${erva.familia}</td>
				<td>${erva.cicloDiasFim} dias</td>
				<td><span class="alert-badge badge-${erva.ativo ? 'Informativo' : 'Aviso'}">${erva.ativo ? 'Ativa' : 'Inativa'}</span></td>
				<td>
					<div class="actions-scroll-container">
						<button class="action-btn desc-btn color-primary" data-id="${erva._id}" ${!erva.descricao ? 'disabled' : ''}>Info</button>
						<button class="action-btn edit-btn" data-id="${erva._id}" ${!erva.ativo ? 'disabled' : ''}>Editar</button>
						<button class="action-btn ${erva.ativo ? 'deactivate-btn color-danger' : 'reactivate-btn color-primary'}" data-id="${erva._id}" ${isTecnico ? 'disabled' : ''} title="${isTecnico ? 'Sem permissão' : ''}">${erva.ativo ? 'Desativar' : 'Reativar'}</button>
					</div>
				</td>
			</tr>
		`).join('')

		document.querySelectorAll('.edit-btn').forEach(btn => {
			btn.addEventListener('click', () => openFormModal(btn.dataset.id))
		})

		document.querySelectorAll('.deactivate-btn').forEach(btn => {
			btn.addEventListener('click', () => deactivateErva(btn.dataset.id))
		})

		document.querySelectorAll('.reactivate-btn').forEach(btn => {
			btn.addEventListener('click', () => reactivateErva(btn.dataset.id))
		})

		document.querySelectorAll('.desc-btn').forEach(btn => {
			btn.addEventListener('click', () => {
				const erva = ervas.find(e => e._id === btn.dataset.id)
				if (erva && erva.descricao) {
					document.getElementById('desc-text').textContent = erva.descricao
					openModal('desc-modal')
				}
			})
		})
	}

	async function deactivateErva(id) {
		const isConfirmed = await showConfirm('Tem a certeza que deseja desativar esta erva aromática? Ela não aparecerá mais nas listas por defeito.')
		if (!isConfirmed) {
			return
		}

		try {
			const response = await apiFetch(`/api/ervas/${id}`, { method: 'PATCH', body: JSON.stringify({ ativo: false }) })
			const data = await response.json()
			if (response.ok && data.success) {
				showAlert('page-alert', 'Erva aromática desativada com sucesso.', 'success')
				loadErvas()
			} else {
				showAlert('page-alert', data.message || 'Erro ao desativar erva.', 'error')
			}
		} catch (error) {
			showAlert('page-alert', 'Falha de rede ao desativar.', 'error')
		}
	}

	async function reactivateErva(id) {
		const isConfirmed = await showConfirm('Deseja reativar esta erva aromática? Ela voltará a constar nas listagens ativas.')
		if (!isConfirmed) {
			return
		}

		try {
			const response = await apiFetch(`/api/ervas/${id}`, { method: 'PATCH', body: JSON.stringify({ ativo: true }) })
			const data = await response.json()
			if (response.ok && data.success) {
				showAlert('page-alert', 'Erva aromática reativada com sucesso.', 'success')
				loadErvas()
			} else {
				showAlert('page-alert', data.message || 'Erro ao reativar erva.', 'error')
			}
		} catch (error) {
			showAlert('page-alert', 'Falha de rede ao reativar.', 'error')
		}
	}

	function showConfirm(msg) {
		return new Promise(resolve => {
			const confirmMessage = document.getElementById('confirm-message')
			const confirmYes = document.getElementById('confirm-yes')
			const confirmNo = document.getElementById('confirm-no')

			confirmMessage.textContent = msg
			openModal('confirm-modal')

			const cleanup = () => {
				confirmYes.removeEventListener('click', handleYes)
				confirmNo.removeEventListener('click', handleNo)
				closeModal('confirm-modal')
			}

			const handleYes = () => {
				cleanup()
				resolve(true)
			}

			const handleNo = () => {
				cleanup()
				resolve(false)
			}

			confirmYes.addEventListener('click', handleYes)
			confirmNo.addEventListener('click', handleNo)
		})
	}

	function openFormModal(id = null) {
		hideAlert('modal-alert')
		form.reset()
		editingId = id

		if (id) {
			document.getElementById('modal-title').textContent = 'Editar Erva Aromática'
			const erva = ervas.find(e => e._id === id)
			if (erva) {
				document.getElementById('nome').value = erva.nome
				document.getElementById('nomeCientifico').value = erva.nomeCientifico
				document.getElementById('variedade').value = erva.variedade
				document.getElementById('familia').value = erva.familia
				document.getElementById('cicloDiasFim').value = erva.cicloDiasFim
				document.getElementById('descricao').value = erva.descricao || ''

				const cond = erva.condicoesIdeais || {}
				document.getElementById('tempMin').value = cond.temperaturaMin ?? ''
				document.getElementById('tempMax').value = cond.temperaturaMax ?? ''
				document.getElementById('humMin').value = cond.humidadeMin ?? ''
				document.getElementById('humMax').value = cond.humidadeMax ?? ''
				document.getElementById('lumMin').value = cond.luminosidadeMin ?? ''
				document.getElementById('lumMax').value = cond.luminosidadeMax ?? ''
			}
		} else {
			document.getElementById('modal-title').textContent = 'Nova Erva Aromática'
		}

		openModal('modal')
	}

	addBtn.addEventListener('click', () => openFormModal())
	importBtn.addEventListener('click', () => openModal('import-modal'))

	form.addEventListener('submit', async (e) => {
		e.preventDefault()
		const submitBtn = document.getElementById('submit-btn')
		submitBtn.disabled = true

		const readNum = (id) => document.getElementById(id).value !== '' ? Number(document.getElementById(id).value) : undefined

		const payload = {
			nome: document.getElementById('nome').value.trim(),
			nomeCientifico: document.getElementById('nomeCientifico').value.trim(),
			variedade: document.getElementById('variedade').value.trim(),
			familia: document.getElementById('familia').value.trim(),
			cicloDiasFim: Number(document.getElementById('cicloDiasFim').value),
			descricao: document.getElementById('descricao').value.trim(),
			condicoesIdeais: {
				temperaturaMin: readNum('tempMin'),
				temperaturaMax: readNum('tempMax'),
				humidadeMin: readNum('humMin'),
				humidadeMax: readNum('humMax'),
				luminosidadeMin: readNum('lumMin'),
				luminosidadeMax: readNum('lumMax')
			}
		}

		try {
			const url = editingId ? `/api/ervas/${editingId}` : '/api/ervas'
			const response = await apiFetch(url, {
				method: editingId ? 'PATCH' : 'POST',
				body: JSON.stringify(payload)
			})

			const data = await response.json()
			if (response.ok && data.success) {
				form.reset()
				closeModal('modal', 'modal-form')
				loadErvas()
			} else {
				throw new Error(data.message || 'Erro ao guardar dados.')
			}
		} catch (error) {
			showAlert('modal-alert', error.message, 'error')
		} finally {
			submitBtn.disabled = false
		}
	})

	importForm.addEventListener('submit', async (e) => {
		e.preventDefault()
		const fileInput = document.getElementById('csv-file')
		if (!fileInput.files.length) {
			return showAlert('import-alert', 'Selecione um ficheiro.', 'error')
		}

		const formData = new FormData()
		formData.append('file', fileInput.files[0])

		const submitBtn = document.getElementById('submit-import-btn')
		submitBtn.disabled = true

		try {
			const response = await fetch('/api/ervas/importar', {
				method: 'POST',
				body: formData
			})
			const data = await response.json()
			if (response.ok && data.success) {
				closeModal('import-modal', 'import-form')
				showAlert('page-alert', data.message, 'success')
				loadErvas()
			} else {
				throw new Error(data.message)
			}
		} catch (error) {
			showAlert('import-alert', error.message, 'error')
		} finally {
			submitBtn.disabled = false
		}
	})

	loadErvas()
})
