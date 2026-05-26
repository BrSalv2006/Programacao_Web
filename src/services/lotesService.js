import PlanoCultivo from '../models/planoCultivo.js'
import Tarefa from '../models/tarefa.js'

export async function gerarTarefasAutomaticas(lote) {
	if (lote.estado !== 'ativo') return

	const plano = await PlanoCultivo.findById(lote.planoId)
	if (!plano) return

	const inicioDia = new Date()
	inicioDia.setHours(0, 0, 0, 0)
	const fimDia = new Date()
	fimDia.setHours(23, 59, 59, 999)

	const hhmm = plano.tarefasOperacionais?.horarioPreferencial?.match(/(\d{2}):(\d{2})/)
	const horaPreferencial = hhmm ? parseInt(hhmm[1], 10) : 8

	const gerarAgendamentos = async (frequenciaHoras, tipo) => {
		if (!frequenciaHoras || frequenciaHoras <= 0) return

		const [ultimaTarefa, tarefasExistentes] = await Promise.all([
			Tarefa.findOne({ loteId: lote._id, tipo }).sort({ dataAgendada: -1 }).select('dataAgendada').lean(),
			Tarefa.find({ loteId: lote._id, tipo, dataAgendada: { $gte: inicioDia, $lte: fimDia } }).select('dataAgendada').lean()
		])

		const existentesSet = new Set((tarefasExistentes || []).map(t => new Date(t.dataAgendada).getTime()))
		let atual

		if (ultimaTarefa?.dataAgendada) {
			atual = new Date(new Date(ultimaTarefa.dataAgendada).getTime() + frequenciaHoras * 3600000)
		} else {
			const base = new Date(inicioDia)
			base.setHours(horaPreferencial, 0, 0, 0)
			atual = base
		}

		while (atual < inicioDia) {
			atual = new Date(atual.getTime() + frequenciaHoras * 3600000)
		}

		const agendamentos = []
		const limite = fimDia

		while (atual <= limite) {
			if (!existentesSet.has(atual.getTime())) {
				agendamentos.push({
					loteId: lote._id,
					tipo,
					estado: 'Pendente',
					dataAgendada: new Date(atual)
				})
			}
			atual = new Date(atual.getTime() + frequenciaHoras * 3600000)
		}
		return agendamentos
	}

	let tarefasParaCriar = []

	if (plano.tipo === 'regular' && plano.tarefasOperacionais) {
		const ops = plano.tarefasOperacionais
		if (ops.tiposPermitidos?.includes('rega')) {
			tarefasParaCriar.push(...(await gerarAgendamentos(ops.regaFrequenciaHoras, 'rega') || []))
		}
		if (ops.tiposPermitidos?.includes('fertilização')) {
			tarefasParaCriar.push(...(await gerarAgendamentos(ops.fertilizacaoFrequenciaHoras, 'fertilização') || []))
		}
		if (ops.tiposPermitidos?.includes('monitorização')) {
			tarefasParaCriar.push(...(await gerarAgendamentos(ops.monitorizacaoFrequenciaHoras, 'monitorização') || []))
		}
		if (ops.tiposPermitidos?.includes('colheita')) {
			if (ops.colheitaNoFim) {
				const diasDuracao = Number(plano.duracaoPrevistaDias || 0)
				if (diasDuracao > 0) {
					const dataFim = lote.dataInicio ? new Date(lote.dataInicio) : new Date()
					dataFim.setDate(dataFim.getDate() + diasDuracao)
					dataFim.setHours(horaPreferencial, 0, 0, 0)

					if (dataFim >= inicioDia && dataFim <= fimDia) {
						const existeColheita = await Tarefa.findOne({
							loteId: lote._id,
							tipo: 'colheita',
							dataAgendada: { $gte: inicioDia, $lte: fimDia }
						}).select('_id').lean()

						if (!existeColheita) {
							tarefasParaCriar.push({
								loteId: lote._id,
								tipo: 'colheita',
								estado: 'Pendente',
								dataAgendada: new Date(dataFim)
							})
						}
					}
				}
			} else if (ops.colheitaFrequenciaHoras) {
				tarefasParaCriar.push(...(await gerarAgendamentos(ops.colheitaFrequenciaHoras, 'colheita') || []))
			}
		}
	} else if (plano.tipo === 'emergência' && plano.detalhesEmergencia) {
		tarefasParaCriar.push(...(await gerarAgendamentos(plano.detalhesEmergencia.intervaloMinimoHoras, plano.detalhesEmergencia.tipoIntervencao === 'remediar' ? 'outro' : 'monitorização') || []))
	}

	if (tarefasParaCriar.length > 0) {
		await Tarefa.insertMany(tarefasParaCriar)
	}
}

export function prepararPayloadLote(body) {
	const payload = { ...body }
	if (payload.planoId && !payload.planosAssociados) payload.planosAssociados = [payload.planoId]
	return payload
}
