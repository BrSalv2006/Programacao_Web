import { apiFetch } from '/js/storage/api.js'
import { showAlert } from '/js/utils/alert.js'

document.addEventListener('DOMContentLoaded', async () => {
	const exportBtn = document.getElementById('export-btn')
	const medicoesTableBody = document.getElementById('medicoes-table-body')
	const loteSelect = document.getElementById('loteId')
	const maxLinhas = 50
	if (exportBtn) {
		exportBtn.addEventListener('click', () => {
			window.open('/api/medicoes/exportar', '_blank')
		})
	}

	function renderMedicoes(medicoes) {
		if (!medicoesTableBody) return

		if (!medicoes || medicoes.length === 0) {
			medicoesTableBody.innerHTML = '<tr><td colspan="5" class="color-muted text-center">Sem medições registadas.</td></tr>'
			return
		}

		const linhas = medicoes.slice(0, maxLinhas).map(m => `
			<tr>
				<td>${new Date(m.dataHora).toLocaleString('pt-PT')}</td>
				<td>${m.temperatura} ºC</td>
				<td>${m.humidade} %</td>
				<td>${m.luminosidade} lx</td>
				<td>${m.falhaSensor ? 'Sim' : 'Não'}</td>
			</tr>
		`).join('')

		medicoesTableBody.innerHTML = linhas
	}

	async function carregarMedicoes(loteId) {
		if (!medicoesTableBody) return

		if (!loteId) {
			medicoesTableBody.innerHTML = '<tr><td colspan="5" class="color-muted text-center">Selecione um lote para ver medições.</td></tr>'
			return
		}

		try {
			const res = await apiFetch(`/api/medicoes?loteId=${encodeURIComponent(loteId)}`)
			const data = await res.json()
			if (res.ok && data.success) {
				renderMedicoes(data.data)
			} else {
				throw new Error(data.message || 'Erro ao carregar medições.')
			}
		} catch (error) {
			medicoesTableBody.innerHTML = `<tr><td colspan="5" class="color-danger text-center">${error.message}</td></tr>`
		}
	}

	try {
		const res = await apiFetch('/api/lotes?view=select')
		const data = await res.json()
		if (data.success) {
			const ativos = data.data.filter(l => l.estado === 'ativo')
			loteSelect.innerHTML = '<option value="">Selecione o Lote</option>' +
				ativos.map(l => `<option value="${l._id}">Lote ${l.ervaId?.nome || 'Desconhecido'} (${l.modo})</option>`).join('')
		}
	} catch (e) { }

	if (loteSelect) {
		loteSelect.addEventListener('change', () => carregarMedicoes(loteSelect.value))
	}

	document.getElementById('sensor-form').addEventListener('submit', async (e) => {
		e.preventDefault()
		const payload = {
			loteId: document.getElementById('loteId').value,
			temperatura: Number(document.getElementById('temperatura').value),
			humidade: Number(document.getElementById('humidade').value),
			luminosidade: Number(document.getElementById('luminosidade').value),
			falhaSensor: false
		}

		try {
			const res = await apiFetch('/api/medicoes', { method: 'POST', body: JSON.stringify(payload) })
			if (res.ok) {
				showAlert('sensor-alert', 'Medição submetida. Verifique os alertas no painel!', 'success')
				await carregarMedicoes(payload.loteId)
				e.target.reset()
			}
		} catch (err) {
			showAlert('sensor-alert', 'Erro ao submeter em modo online.', 'error')
		}
	})
})
