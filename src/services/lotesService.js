import PlanoCultivo from '../models/planoCultivo.js'
import Tarefa from '../models/tarefa.js'
import LoteCultivo from '../models/loteCultivo.js'
import MedicaoAmbiental from '../models/medicaoAmbiental.js'
import LogAuditoria from '../models/logAuditoria.js'
import { csvLine } from './csvUtils.js'

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

export async function criarLote(body, user) {
	const planoBase = await PlanoCultivo.findById(body.planoId).select('tipo').lean()
	if (!planoBase) {
		return { status: 400, payload: { success: false, message: 'Plano de cultivo inválido.' } }
	}
	if (planoBase.tipo !== 'regular') {
		return { status: 400, payload: { success: false, message: 'A criação do lote exige um plano de cultivo regular.' } }
	}

	const novoLote = await LoteCultivo.create(prepararPayloadLote(body))

	await gerarTarefasAutomaticas(novoLote)

	await LogAuditoria.create({
		utilizadorId: user._id,
		acao: 'CRIAR_LOTE_CULTIVO',
		entidade: 'LoteCultivo',
		entidadeId: novoLote._id,
		detalhes: { ervaId: novoLote.ervaId, planoId: novoLote.planoId, modo: novoLote.modo }
	})

	return { status: 201, payload: { success: true, data: novoLote } }
}

export async function dividirLote(loteId, quantidadeRetirada, novoNome, user) {
	if (!quantidadeRetirada || quantidadeRetirada <= 0) {
		return { status: 400, payload: { success: false, message: 'Quantidade inválida.' } }
	}

	const loteOriginal = await LoteCultivo.findById(loteId)
	if (!loteOriginal) {
		return { status: 404, payload: { success: false, message: 'Lote não encontrado.' } }
	}
	if (loteOriginal.estado !== 'ativo') {
		return { status: 400, payload: { success: false, message: 'Só é possível dividir lotes ativos.' } }
	}

	const atual = loteOriginal.quantidadeAtual

	if (quantidadeRetirada >= atual) {
		return { status: 400, payload: { success: false, message: 'Quantidade a retirar deve ser menor que a quantidade atual do lote.' } }
	}

	loteOriginal.quantidadeInicial -= quantidadeRetirada
	await loteOriginal.save()

	const novoLote = await LoteCultivo.create({
		nome: novoNome || (loteOriginal.nome + ' (Divisão)'),
		ervaId: loteOriginal.ervaId,
		planoId: loteOriginal.planoId,
		planosAssociados: loteOriginal.planosAssociados,
		modo: loteOriginal.modo,
		quantidadeInicial: quantidadeRetirada,
		loteOrigemId: loteOriginal._id,
		dataInicio: loteOriginal.dataInicio
	})

	await LogAuditoria.create({
		utilizadorId: user._id,
		acao: 'DIVIDIR_LOTE_CULTIVO',
		entidade: 'LoteCultivo',
		entidadeId: loteOriginal._id,
		detalhes: { quantidadeRetirada, novoLoteId: novoLote._id }
	})

	return { status: 201, payload: { success: true, message: 'Lote dividido com sucesso.', data: novoLote } }
}

export async function alterarPlanoLote(loteId, novoPlanoId, user) {
	if (!novoPlanoId) {
		return { status: 400, payload: { success: false, message: 'ID do novo plano é obrigatório.' } }
	}

	const novoPlano = await PlanoCultivo.findById(novoPlanoId).select('tipo').lean()
	if (!novoPlano) {
		return { status: 400, payload: { success: false, message: 'Plano de cultivo inválido.' } }
	}
	if (novoPlano.tipo !== 'regular') {
		return { status: 400, payload: { success: false, message: 'A alteração do lote exige um plano de cultivo regular.' } }
	}

	const lote = await LoteCultivo.findById(loteId)
	if (!lote) {
		return { status: 404, payload: { success: false, message: 'Lote não encontrado.' } }
	}

	if (lote.estado !== 'ativo') {
		return { status: 400, payload: { success: false, message: 'Apenas lotes ativos podem alterar o plano de cultivo.' } }
	}

	lote.planoId = novoPlanoId
	await lote.save()

	await gerarTarefasAutomaticas(lote)

	await LogAuditoria.create({
		utilizadorId: user._id,
		acao: 'ALTERAR_PLANO_LOTE',
		entidade: 'LoteCultivo',
		entidadeId: lote._id,
		detalhes: { novoPlanoId }
	})

	return { status: 200, payload: { success: true, message: 'Plano do lote alterado com sucesso.', data: lote } }
}

export async function concluirLote(loteId, perdas, quantidadeColhida, user) {
	const lote = await LoteCultivo.findById(loteId)
	if (!lote) {
		return { status: 404, payload: { success: false, message: 'Lote não encontrado.' } }
	}

	if (quantidadeColhida !== undefined) {
		const maxColheita = lote.quantidadeAtual || (lote.quantidadeInicial - lote.perdas)
		if (Number(quantidadeColhida) > maxColheita) {
			return { status: 400, payload: { success: false, message: `A quantidade colhida ultrapassa o disponível (${maxColheita} uds).` } }
		}
		lote.quantidadeColhida = Number(quantidadeColhida)
	}

	lote.estado = 'concluído'
	lote.dataFimReal = Date.now()
	if (perdas !== undefined) lote.perdas += Number(perdas)

	if (lote.historicoPlanos && lote.historicoPlanos.length > 0) {
		const activePlanHist = lote.historicoPlanos[lote.historicoPlanos.length - 1]
		if (activePlanHist && !activePlanHist.dataFim) {
			activePlanHist.dataFim = lote.dataFimReal
		}
	}

	await lote.save()
	await LogAuditoria.create({
		utilizadorId: user._id,
		acao: 'CONCLUIR_LOTE_CULTIVO',
		entidade: 'LoteCultivo',
		entidadeId: lote._id,
		detalhes: { perdas: lote.perdas, quantidadeColhida: lote.quantidadeColhida, produtividade: lote.produtividade }
	})

	return { status: 200, payload: { success: true, message: 'Lote concluído com sucesso.', data: lote } }
}

export async function registarPerdasLote(loteId, quantidadePerdida, user) {
	if (!quantidadePerdida || Number(quantidadePerdida) <= 0) {
		return { status: 400, payload: { success: false, message: 'A quantidade perdida informada deve ser superior a zero.' } }
	}

	const lote = await LoteCultivo.findById(loteId)
	if (!lote) {
		return { status: 404, payload: { success: false, message: 'Lote não encontrado.' } }
	}

	if (lote.estado !== 'ativo') {
		return { status: 400, payload: { success: false, message: 'Apenas é possível registar perdas isoladas em lotes ativos.' } }
	}

	if ((lote.perdas + Number(quantidadePerdida)) > lote.quantidadeInicial) {
		return { status: 400, payload: { success: false, message: 'A soma das perdas não pode exceder a quantidade inicial do lote.' } }
	}

	lote.perdas += Number(quantidadePerdida)
	await lote.save()

	await LogAuditoria.create({
		utilizadorId: user._id,
		acao: 'REGISTAR_PERDAS_LOTE',
		entidade: 'LoteCultivo',
		entidadeId: lote._id,
		detalhes: { perdasRegistadas: quantidadePerdida, totalPerdasAgregadas: lote.perdas }
	})

	return { status: 200, payload: { success: true, message: 'Nova perda registada no lote com sucesso.', data: lote } }
}

export async function comprometerLote(loteId, user) {
	const lote = await LoteCultivo.findById(loteId)
	if (!lote) {
		return { status: 404, payload: { success: false, message: 'Lote não encontrado.' } }
	}

	lote.estado = 'comprometido'
	lote.dataFimReal = Date.now()
	lote.perdas = lote.quantidadeInicial
	lote.quantidadeColhida = 0
	await lote.save()

	await LogAuditoria.create({
		utilizadorId: user._id,
		acao: 'COMPROMETER_LOTE_CULTIVO',
		entidade: 'LoteCultivo',
		entidadeId: lote._id,
		detalhes: { perdas: lote.perdas }
	})

	return { status: 200, payload: { success: true, data: lote } }
}

export async function obterResumoLote(loteId) {
	const lote = await LoteCultivo.findById(loteId)
		.populate('ervaId', 'nome')
		.populate('planoId')
		.populate('planosAssociados')

	if (!lote) {
		return { status: 404, payload: { success: false, message: 'Lote não encontrado.' } }
	}

	const [tarefasPendentes, tarefasExecutadas, medicoes] = await Promise.all([
		Tarefa.find({ loteId: lote._id, estado: 'Pendente' }).sort({ dataAgendada: 1 }),
		Tarefa.find({ loteId: lote._id, estado: 'Executada' }).sort({ dataExecucao: -1 }),
		MedicaoAmbiental.find({ loteId: lote._id }).sort({ dataHora: -1 }).limit(50)
	])

	return {
		status: 200,
		payload: {
			success: true,
			data: {
				lote,
				planos: lote.planosAssociados,
				tarefasPendentes,
				tarefasExecutadas,
				medicoes
			}
		}
	}
}

export async function gerarLotesCsv() {
	const lotes = await LoteCultivo.find()
		.populate('ervaId', 'nome')
		.populate('planoId', 'nome tipo')
		.populate('historicoPlanos.planoId', 'nome tipo')
		.sort({ createdAt: -1 })

	const linhas = [
		'erva,plano,estado,modo,dataInicio,dataFimReal,quantidadeInicial,perdas,quantidadeColhida,produtividade'
	]

	lotes.forEach(lote => {
		const nomePlano = lote.planoId ? `${lote.planoId.nome ? lote.planoId.nome + ' - ' : ''}${lote.planoId.tipo}` : ''
		linhas.push(csvLine([
			lote.ervaId?.nome || '',
			nomePlano,
			lote.estado,
			lote.modo,
			lote.dataInicio?.toISOString() || '',
			lote.dataFimReal?.toISOString() || '',
			lote.quantidadeInicial,
			lote.perdas,
			lote.quantidadeColhida,
			lote.produtividade
		]))
	})

	return linhas.join('\n')
}
