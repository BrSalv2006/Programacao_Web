document.addEventListener('DOMContentLoaded', () => {
	initDB()
		.then(() => {
			carregarEstatisticas()
		})
		.catch(err => {
			console.error("Erro ao inicializar a base de dados no Dashboard:", err)
			document.querySelectorAll('.stat-value').forEach(el => el.textContent = 'Erro')
		})
})

async function carregarEstatisticas() {
	try {
		const alertas = await dbGetAll("alertas")
		const alertasPendentes = alertas.filter(a => a.estado === "Pendente").length

		const valAlertas = document.getElementById('val-alertas')
		valAlertas.textContent = alertasPendentes

		if (alertasPendentes === 0) {
			valAlertas.classList.add('zero')
			valAlertas.textContent = "0"
		} else {
			valAlertas.classList.remove('zero')
		}

		const lotes = await dbGetAll("lotes")
		const lotesAtivos = lotes.filter(l => l.estado === "Ativo").length
		document.getElementById('val-lotes').textContent = lotesAtivos

		const ervas = await dbGetAll("ervas")
		document.getElementById('val-plantas').textContent = ervas.length

		const tarefas = await dbGetAll("tarefas")
		document.getElementById('val-tarefas').textContent = tarefas.length

	} catch (error) {
		console.error("Erro ao ler dados para as estatísticas:", error)
	}
}
