import { apiFetch } from '/js/storage/api.js'
import { showAlert } from '/js/utils/alert.js'

document.addEventListener('DOMContentLoaded', async () => {
	const exportBtn = document.getElementById('export-btn')
	if (exportBtn) {
		exportBtn.addEventListener('click', () => {
			window.open('/api/medicoes/exportar', '_blank')
		})
	}

	try {
		const res = await apiFetch('/api/lotes')
		const data = await res.json()
		if (data.success) {
			const ativos = data.data.filter(l => l.estado === 'ativo')
			document.getElementById('loteId').innerHTML = '<option value="">Selecione o Lote</option>' +
				ativos.map(l => `<option value="${l._id}">Lote ${l.ervaId?.nome || 'Desconhecido'} (${l.modo})</option>`).join('')
		}
	} catch (e) { }

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
				e.target.reset()
			}
		} catch (err) { showAlert('sensor-alert', 'Erro ao submeter em modo online.', 'error') }
	})
})
