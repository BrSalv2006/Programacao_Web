import LoteCultivo from '../models/loteCultivo.js'
import { gerarTarefasAutomaticas } from './lotesService.js'

export async function gerarTarefasDiarias() {
	const lotesAtivos = await LoteCultivo.find({ estado: 'ativo' }).select('_id planoId estado')
	for (const lote of lotesAtivos) {
		try {
			await gerarTarefasAutomaticas(lote)
		} catch (error) {
			console.error('Falha ao gerar tarefas diarias:', error.message)
		}
	}
}

export function agendarGeracaoDiaria() {
	const agora = new Date()
	const proximaMeiaNoite = new Date(agora)
	proximaMeiaNoite.setHours(24, 0, 0, 0)
	const msAteMeiaNoite = proximaMeiaNoite.getTime() - agora.getTime()

	setTimeout(async () => {
		await gerarTarefasDiarias()
		setInterval(gerarTarefasDiarias, 24 * 60 * 60 * 1000)
	}, msAteMeiaNoite)
}
