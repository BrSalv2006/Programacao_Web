import { apiFetch } from '/js/storage/api.js'
import { showAlert } from '/js/utils/alert.js'
import { openModal, closeModal, setupModalCloseButtons } from '/js/utils/modal.js'

document.addEventListener('DOMContentLoaded', () => {
	setupModalCloseButtons()

	const tbody = document.getElementById('table-body')
	const forms = {
		criar: document.getElementById('modal-form'),
		dividir: document.getElementById('dividir-form'),
		concluir: document.getElementById('concluir-form'),
		altPlano: document.getElementById('alterar-plano-form'),
		perdas: document.getElementById('perdas-form'),
		comprometer: document.getElementById('comprometer-form')
	}

	let lotes = [], activeLoteId = null, todosPlanos = []

	async function loadBaseData() {
		try {
			const [ervasRes, planosRes] = await Promise.all([apiFetch('/api/ervas?view=select'), apiFetch('/api/planos?view=select')])
			const ervasData = await ervasRes.json()
			const planosData = await planosRes.json()

			if (ervasData.success) {
				document.getElementById('ervaId').innerHTML = '<option value="">Selecione a Erva...</option>' + ervasData.data.map(e => `<option value="${e._id}">${e.nome}</option>`).join('')
			}

			if (planosData.success) {
				todosPlanos = planosData.data
				const planoSelect = document.getElementById('planoId')
				planoSelect.innerHTML = '<option value="">Primeiro, selecione uma Erva Aromática</option>'
				planoSelect.disabled = true
			}

			await loadLotes()
		} catch (error) { console.error(error) }
	}

	document.getElementById('ervaId').addEventListener('change', (e) => {
		const selecionadaId = e.target.value
		const planoSelect = document.getElementById('planoId')

		if (!selecionadaId) {
			planoSelect.innerHTML = '<option value="">Primeiro, selecione uma Erva Aromática</option>'
			planoSelect.disabled = true
			return
		}

		const planosFiltrados = todosPlanos.filter(p => (p.ervaId?._id || p.ervaId) === selecionadaId && p.tipo === 'regular')

		planoSelect.disabled = false
		if (planosFiltrados.length === 0) {
			planoSelect.innerHTML = '<option value="">Sem planos regulares registados para esta Erva</option>'
		} else {
			planoSelect.innerHTML = '<option value="">Selecione o Plano...</option>' + planosFiltrados.map(p => `<option value="${p._id}">${p.nome ? p.nome + ' - ' : ''}${p.tipo}</option>`).join('')
		}
	})

	async function loadLotes() {
		try {
			const response = await apiFetch('/api/lotes')
			const data = await response.json()
			if (data.success) {
				lotes = data.data
				renderTable()
			}
		} catch (error) {
			tbody.innerHTML = `<tr><td colspan="6" class="color-danger text-center">Erro ao carregar dados.</td></tr>`
		}
	}

	function renderTable() {
		if (lotes.length === 0) {
			tbody.innerHTML = `<tr><td colspan="8" class="color-muted text-center">Nenhum lote registado.</td></tr>`
			return
		}

		tbody.innerHTML = lotes.map(lote => {
			let badge = lote.estado === 'ativo' ? 'Informativo' : (lote.estado === 'concluído' ? 'success' : 'Crítico')
			let progressoTexto = 'N/A'
			const duracaoPlano = lote.planoId?.duracaoPrevistaDias

			if (lote.dataInicio && duracaoPlano) {
				const diasPassados = Math.floor((new Date() - new Date(lote.dataInicio)) / (1000 * 60 * 60 * 24))
				progressoTexto = `${diasPassados} de ${duracaoPlano} dias`
			}

			const nomeETipoPlano = lote.planoId ? `${lote.planoId.nome ? lote.planoId.nome + ' - ' : ''}${lote.planoId.tipo}` : 'N/A'
			const htmlHistorico = lote.historicoPlanos?.length > 0
				? `<button class="action-btn hist-btn" data-id="${lote._id}">Ver Histórico</button>`
				: '<span class="text-xs color-muted">Sem histórico</span>'

			const btnResumo = `<button class="action-btn resumo-btn text-bold color-primary" data-id="${lote._id}">Ver Detalhes</button>`

			const acoesHtml = lote.estado === 'ativo'
				? `
					${btnResumo}
					<button class="action-btn alt-plano-btn" data-id="${lote._id}" data-ervaid="${lote.ervaId?._id || lote.ervaId}">Alt. Plano</button>
					<button class="action-btn div-btn" data-id="${lote._id}">Dividir</button>
					<button class='action-btn perdas-btn text-warning' data-id="${lote._id}">Perdas</button>
					<button class="action-btn conc-btn" data-id="${lote._id}">Concluir</button>
					<button class="action-btn comprometer-btn color-danger" data-id="${lote._id}">Comprometer</button>
				`
				: `${btnResumo} <span class="text-xs color-muted ml-2">Prod.: ${lote.produtividade ?? 0}%</span>`

			return `
			<tr>
				<td class="text-bold color-primary">${lote.nome}</td>
				<td class="text-bold color-dark">${lote.ervaId?.nome || 'N/A'}</td>
				<td>${nomeETipoPlano} <span class="text-xs color-muted">(${lote.modo})</span></td>
				<td>${htmlHistorico}</td>
				<td class="text-bold">${lote.quantidadeAtual ?? lote.quantidadeInicial - lote.perdas} uds</td>
				<td><span class="text-xs">${progressoTexto}</span></td>
				<td><span class="alert-badge badge-${badge}">${lote.estado.charAt(0).toUpperCase() + lote.estado.slice(1)}</span></td>
				<td><div class="actions-scroll-container">${acoesHtml}</div></td>
			</tr>
		`}).join('')
	}

	tbody.addEventListener('click', (e) => {
		const target = e.target
		if (!target.classList.contains('action-btn')) return

		activeLoteId = target.dataset.id
		const loteAtual = lotes.find(l => l._id === activeLoteId)

		if (target.classList.contains('resumo-btn')) {
			abrirResumoLote(activeLoteId)
		}
		else if (target.classList.contains('alt-plano-btn')) {
			const ervaId = target.dataset.ervaid
			const planosFiltrados = todosPlanos.filter(p => (p.ervaId?._id || p.ervaId) === ervaId && p.tipo === 'regular')
			const selectNovoPlano = document.getElementById('novoPlanoId')
			selectNovoPlano.innerHTML = planosFiltrados.length === 0
				? '<option value="">Sem planos regulares registados</option>'
				: '<option value="">Selecione o Novo Plano...</option>' + planosFiltrados.map(p => `<option value="${p._id}">${p.nome ? p.nome + ' - ' : ''}${p.tipo}</option>`).join('')
			openModal('alterar-plano-modal')
		}
		else if (target.classList.contains('div-btn')) openModal('dividir-modal')
		else if (target.classList.contains('conc-btn')) {
			const qtdMax = loteAtual.quantidadeAtual ?? (loteAtual.quantidadeInicial - loteAtual.perdas)
			document.getElementById('quantidadeColhidaFinal').max = qtdMax
			document.getElementById('concluir-help-text').innerText = `Insira a quantidade colhida. O limite máximo real possível é ${qtdMax} uds.`
			openModal('concluir-modal')
		}
		else if (target.classList.contains('perdas-btn')) openModal('perdas-modal')
		else if (target.classList.contains('comprometer-btn')) openModal('comprometer-modal')
		else if (target.classList.contains('hist-btn')) {
			const content = document.getElementById('historico-content')
			let ui = '<ul class="text-sm color-dark historico-list">'
			loteAtual.historicoPlanos.forEach(hist => {
				const inicio = new Date(hist.dataInicio).toLocaleDateString('pt-PT')
				const fim = hist.dataFim ? new Date(hist.dataFim).toLocaleDateString('pt-PT') : 'Presente'
				const nome = hist.planoId ? `${hist.planoId.nome ? hist.planoId.nome + ' (' + hist.planoId.tipo + ')' : hist.planoId.tipo}` : 'Plano Removido'
				ui += `<li><strong>${nome}</strong>: ${inicio} a ${fim}</li>`
			})
			ui += '</ul>'
			content.innerHTML = ui
			openModal('historico-modal')
		}
	})

	document.getElementById('export-btn').addEventListener('click', () => window.open('/api/lotes/exportar', '_blank'))

	forms.criar.addEventListener('submit', async (e) => {
		e.preventDefault()
		const payload = {
			nome: document.getElementById('nomeLote').value,
			ervaId: document.getElementById('ervaId').value,
			planoId: document.getElementById('planoId').value,
			quantidadeInicial: Number(document.getElementById('quantidadeInicial').value),
			modo: document.getElementById('modo').value
		}
		try {
			const response = await apiFetch('/api/lotes', { method: 'POST', body: JSON.stringify(payload) })
			if (response.ok) {
				closeModal('modal', 'modal-form')
				loadLotes()
			}
		} catch (error) { showAlert('modal-alert', error.message, 'error') }
	})

	forms.dividir.addEventListener('submit', async (e) => {
		e.preventDefault()
		try {
			const payload = {
				quantidadeRetirada: document.getElementById('quantidadeRetirada').value,
				novoNome: document.getElementById('novoNomeLote').value
			}
			const response = await apiFetch(`/api/lotes/${activeLoteId}/dividir`, { method: 'POST', body: JSON.stringify(payload) })
			const data = await response.json()
			if (response.ok && data.success) {
				closeModal('dividir-modal', 'dividir-form')
				showAlert('page-alert', 'Lote dividido.', 'success')
				loadLotes()
			} else throw new Error(data.message)
		} catch (error) { showAlert('dividir-alert', error.message, 'error') }
	})

	forms.concluir.addEventListener('submit', async (e) => {
		e.preventDefault()
		try {
			const payload = { quantidadeColhida: document.getElementById('quantidadeColhidaFinal').value }
			const response = await apiFetch(`/api/lotes/${activeLoteId}/concluir`, { method: 'PATCH', body: JSON.stringify(payload) })
			const data = await response.json()
			if (response.ok && data.success) {
				closeModal('concluir-modal', 'concluir-form')
				showAlert('page-alert', 'Lote concluído.', 'success')
				loadLotes()
			} else throw new Error(data.message || 'Erro ao concluir lote.')
		} catch (error) { showAlert('concluir-alert', error.message, 'error') }
	})

	forms.altPlano.addEventListener('submit', async (e) => {
		e.preventDefault()
		try {
			const payload = { novoPlanoId: document.getElementById('novoPlanoId').value }
			const response = await apiFetch(`/api/lotes/${activeLoteId}/alterar-plano`, { method: 'PATCH', body: JSON.stringify(payload) })
			const data = await response.json()
			if (response.ok && data.success) {
				closeModal('alterar-plano-modal', 'alterar-plano-form')
				showAlert('page-alert', 'Plano do lote alterado com sucesso!', 'success')
				loadLotes()
			} else throw new Error(data.message)
		} catch (error) { showAlert('alterar-plano-alert', error.message, 'error') }
	})

	forms.perdas.addEventListener('submit', async (e) => {
		e.preventDefault()
		try {
			const payload = { quantidadePerdida: document.getElementById('qtdPerdida').value }
			const response = await apiFetch(`/api/lotes/${activeLoteId}/registar-perdas`, { method: 'PATCH', body: JSON.stringify(payload) })
			const data = await response.json()
			if (data.success) {
				showAlert('perdas-alert', 'Perda parcial registada no sistema.', 'success')
				setTimeout(() => {
					closeModal('perdas-modal', 'perdas-form')
					loadBaseData()
				}, 1000)
			} else throw new Error(data.message || 'Erro ao registar perda.')
		} catch (error) { showAlert('perdas-alert', error.message, 'error') }
	})

	forms.comprometer.addEventListener('submit', async (e) => {
		e.preventDefault()
		try {
			const response = await apiFetch(`/api/lotes/${activeLoteId}/comprometer`, { method: 'PATCH', body: JSON.stringify({}) })
			const data = await response.json()
			if (response.ok && data.success) {
				closeModal('comprometer-modal', 'comprometer-form')
				showAlert('page-alert', 'Lote declarado como comprometido com sucesso.', 'success')
				loadLotes()
			} else throw new Error(data.message || 'Erro ao comprometer lote.')
		} catch (error) { showAlert('comprometer-alert', error.message, 'error') }
	})

	async function abrirResumoLote(id) {
		openModal('resumo-modal')
		const dataContainer = document.getElementById('resumo-data')
		const loading = document.getElementById('resumo-loading')

		loading.classList.remove('d-none')
		dataContainer.classList.add('d-none')
		loading.innerHTML = 'A carregar informações...'

		try {
			const response = await apiFetch(`/api/lotes/${id}/resumo?limit=5`)
			const json = await response.json()

			if (!response.ok || !json.success) throw new Error(json.message || 'Erro ao carregar resumo.')

			const { lote, tarefasPendentes, tarefasExecutadas, medicoes, alertas } = json.data

			const loteInfo = `
				<div class="grid-2 mb-4 p-4 bg-light-rounded">
					<div><p class="text-sm color-muted">Erva Cultivada</p><p class="text-bold">${lote.ervaId?.nome || 'N/A'}</p></div>
					<div><p class="text-sm color-muted">Modo / Estado</p><p class="text-bold">${lote.modo} / <span class="color-primary">${lote.estado}</span></p></div>
					<div class="mt-2"><p class="text-sm color-muted">Quantidades (Inicial / Atual)</p><p class="text-bold">${lote.quantidadeInicial} / ${lote.quantidadeAtual ?? (lote.quantidadeInicial - lote.perdas)} uds</p></div>
					<div class="mt-2"><p class="text-sm color-muted">Perdas Registadas</p><p class="text-bold color-danger">${lote.perdas} uds</p></div>
				</div>
			`

			const alertasHtml = alertas?.length > 0
				? alertas.slice(0, 5).map(a => `
					<div class="alerta-card ${a.nivel === 'Crítico' ? 'border-left-danger' : 'border-left-warning'}">
						<div class="text-sm text-bold">${a.nivel} - ${new Date(a.createdAt).toLocaleString('pt-PT')}</div>
						<div class="text-sm">${a.tipo} <span class="color-muted text-xs">(${a.estado})</span></div>
					</div>`).join('')
				: '<p class="text-sm color-muted">Nenhum alerta registado para este lote.</p>'

			const tarefasPendHtml = tarefasPendentes?.length > 0
				? `<ul class="list-disc">${tarefasPendentes.slice(0, 5).map(t => `<li class="text-sm">${new Date(t.dataAgendada).toLocaleDateString('pt-PT')} - <strong>${t.tipo}</strong></li>`).join('')}</ul>`
				: '<p class="text-sm color-muted">Sem tarefas pendentes.</p>'

			const tarefasExecHtml = tarefasExecutadas?.length > 0
				? `<ul class="list-disc">${tarefasExecutadas.slice(0, 5).map(t => `<li class="text-sm">${new Date(t.dataExecucao).toLocaleDateString('pt-PT')} - <strong>${t.tipo}</strong></li>`).join('')}</ul>`
				: '<p class="text-sm color-muted">Nenhuma tarefa executada.</p>'

			const medicoesHtml = medicoes?.length > 0
				? `<table class="table text-sm w-full mt-2">
					<thead><tr><th>Data/Hora</th><th>Temp.</th><th>Humid.</th><th>Lumin.</th></tr></thead>
					<tbody>${medicoes.map(m => `
						<tr>
							<td>${new Date(m.dataHora).toLocaleString('pt-PT')}</td>
							<td>${m.temperatura} ºC</td>
							<td>${m.humidade} %</td>
							<td>${m.luminosidade} lx</td>
						</tr>
					`).join('')}</tbody>
				   </table>`
				: '<p class="text-sm color-muted">Nenhuma medição ambiental registada.</p>'

			dataContainer.innerHTML = `
				${loteInfo}
				<h3 class="text-md text-bold mb-2 border-bottom pb-1">🚨 Últimos Alertas</h3>
				<div class="mb-4">${alertasHtml}</div>

				<div class="grid-2 gap-4 mb-4">
					<div><h3 class="text-md text-bold mb-2 border-bottom pb-1">📅 Tarefas Pendentes</h3>${tarefasPendHtml}</div>
					<div><h3 class="text-md text-bold mb-2 border-bottom pb-1">✅ Tarefas Executadas</h3>${tarefasExecHtml}</div>
				</div>

				<h3 class="text-md text-bold mb-2 border-bottom pb-1">📊 Histórico de Medições (Recentes)</h3>
				<div class="overflow-x-auto">${medicoesHtml}</div>
			`

			loading.classList.add('d-none')
			dataContainer.classList.remove('d-none')

		} catch (error) {
			loading.innerHTML = `<span class="color-danger">${error.message}</span>`
		}
	}

	loadBaseData()
})
