import { apiFetch } from '/js/storage/api.js'
import { showAlert, hideAlert } from '/js/utils/alert.js'

document.addEventListener('DOMContentLoaded', () => {
	const tbody = document.getElementById('table-body')
	const modal = document.getElementById('modal'), form = document.getElementById('modal-form')
	const divModal = document.getElementById('dividir-modal'), divForm = document.getElementById('dividir-form')
	const concModal = document.getElementById('concluir-modal'), concForm = document.getElementById('concluir-form')
	const altPlanoModal = document.getElementById('alterar-plano-modal'), altPlanoForm = document.getElementById('alterar-plano-form')
	const perdasModal = document.getElementById('perdas-modal'), perdasForm = document.getElementById('perdas-form')
	const comprometerModal = document.getElementById('comprometer-modal'), comprometerForm = document.getElementById('comprometer-form')

	let lotes = [], activeLoteId = null, todosPlanos = []

	async function loadBaseData() {
		try {
			const [ervasRes, planosRes] = await Promise.all([apiFetch('/api/ervas'), apiFetch('/api/planos')])
			const ervasData = await ervasRes.json()
			const planosData = await planosRes.json()

			if (ervasData.success) {
				document.getElementById('ervaId').innerHTML = '<option value="">Selecione a Erva...</option>' + ervasData.data.map(e => `<option value="${e._id}">${e.nome}</option>`).join('')
			}

			if (planosData.success) {
				todosPlanos = planosData.data
				// Desativamos os planos até que uma erva seja selecionada
				const planoSelect = document.getElementById('planoId')
				planoSelect.innerHTML = '<option value="">Primeiro, selecione uma Erva Aromática</option>'
				planoSelect.disabled = true
			}

			await loadLotes()
		} catch (error) { console.error(error) }
	}

	// Adicionar o EventListener para filtrar planos com base na Erva selecionada
	document.getElementById('ervaId').addEventListener('change', (e) => {
		const selecionadaId = e.target.value
		const planoSelect = document.getElementById('planoId')

		if (!selecionadaId) {
			planoSelect.innerHTML = '<option value="">Primeiro, selecione uma Erva Aromática</option>'
			planoSelect.disabled = true
			return
		}

		// Filtramos os planos que pertencem a ervaId (pode vir populada como objeto no backend, ou ser só o ID)
		// Por segurança, verificamos se p.ervaId._id existe ou comparamos o p.ervaId diretamente se for string
		const planosFiltrados = todosPlanos.filter(p => (p.ervaId?._id || p.ervaId) === selecionadaId)

		planoSelect.disabled = false
		if (planosFiltrados.length === 0) {
			planoSelect.innerHTML = '<option value="">Sem planos registados para esta Erva</option>'
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
			if (lote.dataInicio && lote.ervaId?.cicloDiasFim) {
				const diasPassados = Math.floor((new Date() - new Date(lote.dataInicio)) / (1000 * 60 * 60 * 24))
				progressoTexto = `${diasPassados} de ${lote.ervaId.cicloDiasFim} dias`
			}

			const nomeETipoPlano = lote.planoId ? `${lote.planoId.nome ? lote.planoId.nome + ' - ' : ''}${lote.planoId.tipo}` : 'N/A'

			// Histórico Visualizer Button
			let htmlHistorico = '<span class="text-xs color-muted">Sem histórico</span>'
			if (lote.historicoPlanos && lote.historicoPlanos.length > 0) {
				htmlHistorico = `<button class="action-btn hist-btn" data-id="${lote._id}">Ver Histórico</button>`
			}

			return `
			<tr>
				<td class="text-bold color-primary">${lote.nome}</td>
				<td class="text-bold color-dark">${lote.ervaId?.nome || 'N/A'}</td>
				<td>${nomeETipoPlano} <span class="text-xs color-muted">(${lote.modo})</span></td>
				<td>${htmlHistorico}</td>
				<td class="text-bold">${lote.quantidadeAtual ?? lote.quantidadeInicial - lote.perdas} uds</td>
                <td><span class="text-xs">${progressoTexto}</span></td>
				<td><span class="alert-badge badge-${badge}">${lote.estado.charAt(0).toUpperCase() + lote.estado.slice(1)}</span></td>
				<td>
					<div class="actions-scroll-container">
                    ${lote.estado === 'ativo' ? `
					    <button class="action-btn alt-plano-btn" data-id="${lote._id}" data-ervaid="${lote.ervaId?._id || lote.ervaId}">Alt. Plano</button>
					    <button class="action-btn div-btn" data-id="${lote._id}">Dividir</button>
						<button class='action-btn perdas-btn text-warning'  data-id="${lote._id}">Perdas</button>
                        <button class="action-btn conc-btn" data-id="${lote._id}">Concluir</button>
						<button class="action-btn comprometer-btn color-danger" data-id="${lote._id}">Comprometer</button>
                    ` : `<span class="text-xs color-muted">Prod.: ${lote.produtividade ?? 0}%</span>`}
					</div>
				</td>
			</tr>
		`}).join('')

		document.querySelectorAll('.alt-plano-btn').forEach(btn => btn.addEventListener('click', () => {
			activeLoteId = btn.dataset.id

			const ervaId = btn.dataset.ervaid
			const planosFiltrados = todosPlanos.filter(p => (p.ervaId?._id || p.ervaId) === ervaId)

			const selectNovoPlano = document.getElementById('novoPlanoId')
			if (planosFiltrados.length === 0) {
				selectNovoPlano.innerHTML = '<option value="">Sem planos registados</option>'
			} else {
				selectNovoPlano.innerHTML = '<option value="">Selecione o Novo Plano...</option>' + planosFiltrados.map(p => `<option value="${p._id}">${p.nome ? p.nome + ' - ' : ''}${p.tipo}</option>`).join('')
			}

			altPlanoModal.classList.add('open')
		}))

		document.querySelectorAll('.div-btn').forEach(btn => btn.addEventListener('click', () => {
			activeLoteId = btn.dataset.id
			divModal.classList.add('open')
		}))
		document.querySelectorAll('.conc-btn').forEach(btn => btn.addEventListener('click', () => {
			activeLoteId = btn.dataset.id
			const loteAtual = lotes.find(l => l._id === activeLoteId)
			const qtdMax = loteAtual.quantidadeAtual ?? (loteAtual.quantidadeInicial - loteAtual.perdas)
			document.getElementById('quantidadeColhidaFinal').max = qtdMax
			document.getElementById('concluir-help-text').innerText = `Insira a quantidade colhida. O limite máximo real possível é ${qtdMax} uds.`
			concModal.classList.add('open')
		}))
		document.querySelectorAll('.perdas-btn').forEach(btn => btn.addEventListener('click', () => {
			activeLoteId = btn.dataset.id
			perdasModal.classList.add('open')
		}))
		document.querySelectorAll('.comprometer-btn').forEach(btn => btn.addEventListener('click', () => {
			activeLoteId = btn.dataset.id
			comprometerModal.classList.add('open')
		}))

		document.querySelectorAll('.hist-btn').forEach(btn => btn.addEventListener('click', () => {
			const lote = lotes.find(l => l._id === btn.dataset.id)
			const content = document.getElementById('historico-content')
			let ui = '<ul class="text-sm color-dark historico-list">'
			lote.historicoPlanos.forEach(hist => {
				const inicio = new Date(hist.dataInicio).toLocaleDateString('pt-PT')
				const fim = hist.dataFim ? new Date(hist.dataFim).toLocaleDateString('pt-PT') : 'Presente'
				const nome = hist.planoId ? `${hist.planoId.nome ? hist.planoId.nome + ' (' + hist.planoId.tipo + ')' : hist.planoId.tipo}` : 'Plano Removido'
				ui += `<li><strong>${nome}</strong>: ${inicio} a ${fim}</li>`
			})
			ui += '</ul>'
			content.innerHTML = ui
			document.getElementById('historico-modal').classList.add('open')
		}))
	}

	document.getElementById('add-btn').addEventListener('click', () => modal.classList.add('open'))
	document.getElementById('close-modal').addEventListener('click', () => modal.classList.remove('open'))
	document.getElementById('close-dividir').addEventListener('click', () => divModal.classList.remove('open'))
	document.getElementById('close-concluir').addEventListener('click', () => concModal.classList.remove('open'))
	document.getElementById('close-alterar-plano').addEventListener('click', () => altPlanoModal.classList.remove('open'))
	document.getElementById('close-historico').addEventListener('click', () => document.getElementById('historico-modal').classList.remove('open'))
	document.getElementById('close-perdas').addEventListener('click', () => perdasModal.classList.remove('open'))
	document.getElementById('close-comprometer').addEventListener('click', () => comprometerModal.classList.remove('open'))

	document.getElementById('export-btn').addEventListener('click', () => {
		window.open('/api/lotes/exportar', '_blank')
	})

	form.addEventListener('submit', async (e) => {
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
				form.reset()
				modal.classList.remove('open')
				loadLotes()
			}
		} catch (error) { showAlert('modal-alert', error.message, 'error') }
	})

	divForm.addEventListener('submit', async (e) => {
		e.preventDefault()
		try {
			const payload = {
				quantidadeRetirada: document.getElementById('quantidadeRetirada').value,
				novoNome: document.getElementById('novoNomeLote').value
			}
			const response = await apiFetch(`/api/lotes/${activeLoteId}/dividir`, { method: 'POST', body: JSON.stringify(payload) })
			const data = await response.json()
			if (response.ok && data.success) {
				divForm.reset()
				divModal.classList.remove('open')
				showAlert('page-alert', 'Lote dividido.', 'success')
				loadLotes()
			} else throw new Error(data.message)
		} catch (error) { showAlert('dividir-alert', error.message, 'error') }
	})

	concForm.addEventListener('submit', async (e) => {
		e.preventDefault()
		try {
			const payload = { quantidadeColhida: document.getElementById('quantidadeColhidaFinal').value }
			const response = await apiFetch(`/api/lotes/${activeLoteId}/concluir`, { method: 'PATCH', body: JSON.stringify(payload) })
			const data = await response.json()
			if (response.ok && data.success) {
				concForm.reset()
				concModal.classList.remove('open')
				showAlert('page-alert', 'Lote concluído.', 'success')
				loadLotes()
			} else {
				showAlert('concluir-alert', data.message || 'Erro ao concluir lote.', 'error')
			}
		} catch (error) { showAlert('concluir-alert', error.message, 'error') }
	})

	altPlanoForm.addEventListener('submit', async (e) => {
		e.preventDefault()
		try {
			const payload = { novoPlanoId: document.getElementById('novoPlanoId').value }
			const response = await apiFetch(`/api/lotes/${activeLoteId}/alterar-plano`, { method: 'PATCH', body: JSON.stringify(payload) })
			const data = await response.json()
			if (response.ok && data.success) {
				altPlanoForm.reset()
				altPlanoModal.classList.remove('open')
				showAlert('page-alert', 'Plano do lote alterado com sucesso!', 'success')
				loadLotes()
			} else throw new Error(data.message)
		} catch (error) { showAlert('alterar-plano-alert', error.message, 'error') }
	})

	perdasForm.addEventListener('submit', async (e) => {
		e.preventDefault()
		try {
			const payload = { quantidadePerdida: document.getElementById('qtdPerdida').value }
			const response = await apiFetch(`/api/lotes/${activeLoteId}/registar-perdas`, {
				method: 'PATCH',
				body: JSON.stringify(payload)
			})
			const data = await response.json()
			if (data.success) {
				showAlert('perdas-alert', 'Perda parcial registada no sistema.', 'success')
				setTimeout(() => {
					perdasModal.classList.remove('open')
					perdasForm.reset()
					loadBaseData()
				}, 1000)
			} else {
				showAlert('perdas-alert', data.message || 'Erro ao registar perda.', 'error')
			}
		} catch (error) { showAlert('perdas-alert', error.message, 'error') }
	})

	comprometerForm.addEventListener('submit', async (e) => {
		e.preventDefault()
		try {
			const response = await apiFetch(`/api/lotes/${activeLoteId}/comprometer`, { method: 'PATCH', body: JSON.stringify({}) })
			const data = await response.json()
			if (response.ok && data.success) {
				comprometerForm.reset()
				comprometerModal.classList.remove('open')
				showAlert('page-alert', 'Lote declarado como comprometido com sucesso.', 'success')
				loadLotes()
			} else {
				showAlert('comprometer-alert', data.message || 'Erro ao comprometer lote.', 'error')
			}
		} catch (error) { showAlert('comprometer-alert', error.message, 'error') }
	})

	loadBaseData()
})
