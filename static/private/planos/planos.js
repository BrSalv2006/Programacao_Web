import { apiFetch } from '/js/storage/api.js'
import { showAlert, hideAlert } from '/js/utils/alert.js'

document.addEventListener('DOMContentLoaded', () => {
	const tbodyRegular = document.getElementById('table-regular-body')
	const tbodyEmergencia = document.getElementById('table-emergencia-body')
	const tbodyPontual = document.getElementById('table-pontual-body')
	const modal = document.getElementById('modal')
	const form = document.getElementById('modal-form')
	const addButton = document.getElementById('add-btn')
	const closeModalButton = document.getElementById('close-modal')
	const ervaSelect = document.getElementById('ervaId')
	const tipoSelect = document.getElementById('tipo')
	const colheitaFrequenciaInput = document.getElementById('colheitaFrequenciaHoras')
	const colheitaNoFimInput = document.getElementById('colheitaNoFim')

	let planos = []
	let ervasOptions = []
	let editingId = null

	const tipoLabels = {
		regular: 'Regular',
		emergência: 'Emergência',
		pontual: 'Pontual'
	}

	function readNumber(id) {
		const value = document.getElementById(id).value
		return value === '' ? undefined : Number(value)
	}

	function setRequired(ids, required) {
		ids.forEach(id => {
			const element = document.getElementById(id)
			if (element) element.required = required
		})
	}

	function setGroupDisabled(groupId, disabled) {
		document.querySelectorAll(`#${groupId} input, #${groupId} textarea, #${groupId} select`).forEach(element => {
			element.disabled = disabled
		})
	}

	function updateTypeFields() {
		const tipo = tipoSelect.value
		document.getElementById('regular-fields').classList.toggle('d-none', tipo !== 'regular')
		document.getElementById('emergencia-fields').classList.toggle('d-none', tipo !== 'emergência')
		document.getElementById('pontual-fields').classList.toggle('d-none', tipo !== 'pontual')
		setGroupDisabled('regular-fields', tipo !== 'regular')
		setGroupDisabled('emergencia-fields', tipo !== 'emergência')
		setGroupDisabled('pontual-fields', tipo !== 'pontual')

		setRequired([
			'temperaturaMin', 'temperaturaMax', 'humidadeMin', 'humidadeMax',
			'luminosidadeMin', 'luminosidadeMax', 'planoRega', 'duracaoPrevistaDias', 'regaFrequenciaHoras'
		], tipo === 'regular')
		setRequired(['intervaloMinimoHoras', 'tipoIntervencao', 'dosagemOuIntensidade'], tipo === 'emergência')
		setRequired(['finalidadePontual'], tipo === 'pontual')

		if (tipo === 'regular') {
			syncColheitaInputs()
		}
	}

	function syncColheitaInputs() {
		if (colheitaNoFimInput.checked) {
			colheitaFrequenciaInput.value = ''
			colheitaFrequenciaInput.disabled = true
		} else {
			colheitaFrequenciaInput.disabled = false
		}

		const hasFrequencia = colheitaFrequenciaInput.value !== '' && Number(colheitaFrequenciaInput.value) > 0
		colheitaNoFimInput.disabled = hasFrequencia
	}

	async function loadBaseData() {
		try {
			const ervasResponse = await apiFetch('/api/ervas?view=planos')
			const ervasData = await ervasResponse.json()
			if (ervasData.success) {
				ervasOptions = ervasData.data
				ervaSelect.innerHTML = '<option value="">Selecione uma erva...</option>' + ervasOptions.map(e => `<option value="${e._id}">${e.nome}</option>`).join('')
			}

			await loadPlanos()
		} catch (error) {
			console.error(error)
		}
	}

	async function loadPlanos() {
		try {
			const response = await apiFetch('/api/planos')
			const data = await response.json()
			if (data.success) {
				planos = data.data
				renderTable()
			}
		} catch (error) {
			const errorHtml = `<tr><td colspan="6" class="color-danger text-center">Erro ao carregar dados.</td></tr>`
			tbodyRegular.innerHTML = errorHtml
			tbodyEmergencia.innerHTML = errorHtml
			tbodyPontual.innerHTML = errorHtml
		}
	}

	function renderTable() {
		const renderRegularRow = (plano) => {
			const cond = plano.condicoesIdeais || {}
			const temperatura = cond.temperaturaMin !== undefined && cond.temperaturaMax !== undefined ? `${cond.temperaturaMin} - ${cond.temperaturaMax}` : 'N/A'
			const humidade = cond.humidadeMin !== undefined && cond.humidadeMax !== undefined ? `${cond.humidadeMin} - ${cond.humidadeMax}` : 'N/A'
			const luminosidade = cond.luminosidadeMin !== undefined && cond.luminosidadeMax !== undefined ? `${cond.luminosidadeMin} - ${cond.luminosidadeMax}` : 'N/A'
			const ervaNome = plano.ervaId ? plano.ervaId.nome : 'N/A'

			return `
			<tr>
				<td class="text-bold color-dark">${plano.nome || 'N/A'}</td>
				<td>${ervaNome}</td>
				<td>${temperatura}</td>
				<td>${humidade}</td>
				<td>${luminosidade}</td>
				<td>
					<button class="action-btn edit-btn" data-id="${plano._id}" title="Editar">Editar</button>
				</td>
			</tr>
			`
		}

		const renderEmergenciaRow = (plano) => {
			const ervaNome = plano.ervaId ? plano.ervaId.nome : 'N/A'
			const emergencia = plano.detalhesEmergencia || {}

			return `
			<tr>
				<td class="text-bold color-dark">${plano.nome || 'N/A'}</td>
				<td>${ervaNome}</td>
				<td>${emergencia.tipoIntervencao || 'N/A'}</td>
				<td>${emergencia.intervaloMinimoHoras ? emergencia.intervaloMinimoHoras + ' h' : 'N/A'}</td>
				<td>${emergencia.dosagemOuIntensidade || 'N/A'}</td>
				<td>
					<button class="action-btn edit-btn" data-id="${plano._id}" title="Editar">Editar</button>
				</td>
			</tr>
			`
		}

		const renderPontualRow = (plano) => {
			const ervaNome = plano.ervaId ? plano.ervaId.nome : 'N/A'

			return `
			<tr>
				<td class="text-bold color-dark">${plano.nome || 'N/A'}</td>
				<td>${ervaNome}</td>
				<td>${plano.finalidadePontual || 'N/A'}</td>
				<td>
					<button class="action-btn edit-btn" data-id="${plano._id}" title="Editar">Editar</button>
				</td>
			</tr>
			`
		}

		const renderRows = (planosArray, renderFunc, colsCount) => {
			if (planosArray.length === 0) return `<tr><td colspan="${colsCount}" class="color-muted text-center">Nenhum plano registado.</td></tr>`
			return planosArray.map(renderFunc).join('')
		}

		tbodyRegular.innerHTML = renderRows(planos.filter(p => p.tipo === 'regular'), renderRegularRow, 6)
		tbodyEmergencia.innerHTML = renderRows(planos.filter(p => p.tipo === 'emergência'), renderEmergenciaRow, 6)
		tbodyPontual.innerHTML = renderRows(planos.filter(p => p.tipo === 'pontual'), renderPontualRow, 4)
		document.querySelectorAll('.edit-btn').forEach(button => {
			button.addEventListener('click', () => openModal(button.dataset.id))
		})
	}

	function openModal(id = null) {
		hideAlert('modal-alert')
		form.reset()
		editingId = id

		if (id) {
			document.getElementById('modal-title').textContent = 'Editar Plano'
			const plano = planos.find(p => p._id === id)
			if (plano) {
				document.getElementById('nome').value = plano.nome || ''
				document.getElementById('tipo').value = plano.tipo
				if (plano.ervaId) document.getElementById('ervaId').value = plano.ervaId._id || plano.ervaId

				const cond = plano.condicoesIdeais || {}
				document.getElementById('temperaturaMin').value = cond.temperaturaMin || ''
				document.getElementById('temperaturaMax').value = cond.temperaturaMax || ''
				document.getElementById('humidadeMin').value = cond.humidadeMin || ''
				document.getElementById('humidadeMax').value = cond.humidadeMax || ''
				document.getElementById('luminosidadeMin').value = cond.luminosidadeMin || ''
				document.getElementById('luminosidadeMax').value = cond.luminosidadeMax || ''

				const tarefas = plano.tarefasOperacionais || {}
				document.getElementById('regaFrequenciaHoras').value = tarefas.regaFrequenciaHoras || ''
				document.getElementById('monitorizacaoFrequenciaHoras').value = tarefas.monitorizacaoFrequenciaHoras || ''
				document.getElementById('fertilizacaoFrequenciaHoras').value = tarefas.fertilizacaoFrequenciaHoras || ''
				document.getElementById('colheitaFrequenciaHoras').value = tarefas.colheitaFrequenciaHoras || ''
				document.getElementById('colheitaNoFim').checked = Boolean(tarefas.colheitaNoFim)
				document.getElementById('fertilizacaoDosagem').value = tarefas.fertilizacaoDosagem || ''
				document.getElementById('horarioPreferencial').value = tarefas.horarioPreferencial || ''

				document.getElementById('planoRega').value = plano.planoRega || ''
				document.getElementById('fertilizacao').value = plano.fertilizacao || ''
				document.getElementById('duracaoPrevistaDias').value = plano.duracaoPrevistaDias || ''

				const emergencia = plano.detalhesEmergencia || {}
				document.getElementById('intervaloMinimoHoras').value = emergencia.intervaloMinimoHoras || ''
				document.getElementById('tipoIntervencao').value = emergencia.tipoIntervencao || ''
				document.getElementById('dosagemOuIntensidade').value = emergencia.dosagemOuIntensidade || ''
				document.getElementById('finalidadePontual').value = plano.finalidadePontual || ''
			}
		} else {
			document.getElementById('modal-title').textContent = 'Novo Plano de Cultivo'
		}

		updateTypeFields()
		modal.classList.add('open')
	}

	ervaSelect.addEventListener('change', (e) => {
		if (editingId) return

		const ervaSelecionadaId = e.target.value
		if (!ervaSelecionadaId) return

		const erva = ervasOptions.find(item => item._id === ervaSelecionadaId)

		if (erva && erva.condicoesIdeais) {
			const cond = erva.condicoesIdeais
			document.getElementById('temperaturaMin').value = cond.temperaturaMin ?? ''
			document.getElementById('temperaturaMax').value = cond.temperaturaMax ?? ''
			document.getElementById('humidadeMin').value = cond.humidadeMin ?? ''
			document.getElementById('humidadeMax').value = cond.humidadeMax ?? ''
			document.getElementById('luminosidadeMin').value = cond.luminosidadeMin ?? ''
			document.getElementById('luminosidadeMax').value = cond.luminosidadeMax ?? ''

			if (!document.getElementById('regaFrequenciaHoras').value) document.getElementById('regaFrequenciaHoras').value = 24
		}
	})

	addButton.addEventListener('click', () => openModal())
	closeModalButton.addEventListener('click', () => modal.classList.remove('open'))
	tipoSelect.addEventListener('change', updateTypeFields)
	colheitaNoFimInput.addEventListener('change', syncColheitaInputs)
	colheitaFrequenciaInput.addEventListener('input', () => {
		if (colheitaFrequenciaInput.value !== '' && Number(colheitaFrequenciaInput.value) > 0) {
			colheitaNoFimInput.checked = false
		}
		syncColheitaInputs()
	})

	form.addEventListener('submit', async (event) => {
		event.preventDefault()
		updateTypeFields()
		if (!form.reportValidity()) return

		const submitButton = document.getElementById('submit-btn')
		submitButton.disabled = true
		submitButton.textContent = 'A guardar...'

		const tipo = document.getElementById('tipo').value
		const nome = document.getElementById('nome').value
		const colheitaNoFim = colheitaNoFimInput.checked
		const payload = {
			nome,
			tipo,
			tarefasOperacionais: {
				tiposPermitidos: ['rega', 'fertilização', 'colheita', 'monitorização'],
				regaFrequenciaHoras: readNumber('regaFrequenciaHoras'),
				monitorizacaoFrequenciaHoras: readNumber('monitorizacaoFrequenciaHoras'),
				fertilizacaoFrequenciaHoras: readNumber('fertilizacaoFrequenciaHoras'),
				colheitaFrequenciaHoras: colheitaNoFim ? null : readNumber('colheitaFrequenciaHoras'),
				colheitaNoFim: colheitaNoFim,
				fertilizacaoDosagem: document.getElementById('fertilizacaoDosagem').value || undefined,
				horarioPreferencial: document.getElementById('horarioPreferencial').value || undefined,
			}
		}

		const ervaId = document.getElementById('ervaId').value
		if (ervaId) payload.ervaId = ervaId
		if (tipo === 'regular') {
			payload.condicoesIdeais = {
				temperaturaMin: readNumber('temperaturaMin'),
				temperaturaMax: readNumber('temperaturaMax'),
				humidadeMin: readNumber('humidadeMin'),
				humidadeMax: readNumber('humidadeMax'),
				luminosidadeMin: readNumber('luminosidadeMin'),
				luminosidadeMax: readNumber('luminosidadeMax'),
			}
			payload.planoRega = document.getElementById('planoRega').value

			const fertilizacaoText = document.getElementById('fertilizacao').value
			if (fertilizacaoText) {
				payload.fertilizacao = fertilizacaoText
			} else {
				payload.tarefasOperacionais.tiposPermitidos = ['rega', 'colheita', 'monitorização']
			}
			payload.duracaoPrevistaDias = readNumber('duracaoPrevistaDias')
		}
		if (tipo === 'emergência') {
			payload.detalhesEmergencia = {
				intervaloMinimoHoras: readNumber('intervaloMinimoHoras'),
				tipoIntervencao: document.getElementById('tipoIntervencao').value,
				dosagemOuIntensidade: document.getElementById('dosagemOuIntensidade').value
			}
		}
		if (tipo === 'pontual') {
			payload.finalidadePontual = document.getElementById('finalidadePontual').value
		}

		try {
			const url = editingId ? `/api/planos/${editingId}` : '/api/planos'
			const method = editingId ? 'PATCH' : 'POST'

			const response = await apiFetch(url, {
				method,
				body: JSON.stringify(payload)
			})

			const data = await response.json()

			if (response.ok && data.success) {
				form.reset()
				modal.classList.remove('open')
				loadPlanos()
			} else {
				throw new Error(data.message || 'Erro ao guardar dados.')
			}
		} catch (error) {
			showAlert('modal-alert', error.message, 'error')
		} finally {
			submitButton.disabled = false
			submitButton.textContent = 'Guardar Plano'
		}
	})

	updateTypeFields()
	loadBaseData()
})
