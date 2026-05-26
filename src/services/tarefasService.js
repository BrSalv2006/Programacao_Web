import Tarefa from '../models/tarefa.js'
import LoteCultivo from '../models/loteCultivo.js'
import LogAuditoria from '../models/logAuditoria.js'
import { gerarTarefasAutomaticas } from './lotesService.js'
import { csvLine } from './csvUtils.js'

export async function garantirTarefasDoDia() {
	const lotesAtivos = await LoteCultivo.find({ estado: 'ativo' }).select('_id planoId estado')
	for (const lote of lotesAtivos) {
		try {
			await gerarTarefasAutomaticas(lote)
		} catch (error) {
			console.error(error.message)
		}
	}
}

export async function validarTarefasPlano(loteId, tipoTarefa, dataAgendada) {
	const lote = await LoteCultivo.findById(loteId).populate('planoId')
	if (!lote) return 'Lote de cultivo não encontrado.'
	if (lote.estado !== 'ativo') return 'Apenas é possível agendar tarefas para lotes ativos.'

	const plano = lote.planoId
	if (!plano) return null

	if (plano.tarefasOperacionais?.tiposPermitidos && !plano.tarefasOperacionais.tiposPermitidos.includes(tipoTarefa)) {
		return `O tipo de tarefa '${tipoTarefa}' não é permitido neste plano de cultivo.`
	}

	if (plano.tipo === 'regular' && tipoTarefa === 'monitorização' && plano.tarefasOperacionais?.monitorizacaoFrequenciaHoras) {
		const frequencia = plano.tarefasOperacionais.monitorizacaoFrequenciaHoras
		const horaAgendada = new Date(dataAgendada).getHours()
		const hhmm = plano.tarefasOperacionais.horarioPreferencial?.match(/(\d{2}):(\d{2})/)
		const horaPreferencial = hhmm ? parseInt(hhmm[1], 10) : 8

		const diferencaHoras = Math.abs(horaAgendada - horaPreferencial)
		if (diferencaHoras % frequencia !== 0) {
			return `As tarefas de monitorização para este plano apenas podem ocorrer em intervalos de ${frequencia} horas, alinhadas com as ${horaPreferencial}:00.`
		}
	}

	if (plano.tipo === 'emergência' && plano.detalhesEmergencia?.intervaloMinimoHoras) {
		const ultimasTarefas = await Tarefa.find({ loteId, tipo: tipoTarefa }).sort({ dataAgendada: -1 }).limit(1)
		if (ultimasTarefas.length > 0) {
			const ultima = ultimasTarefas[0]
			const diffHoras = Math.abs(new Date(dataAgendada) - new Date(ultima.dataAgendada)) / 36e5
			if (diffHoras < plano.detalhesEmergencia.intervaloMinimoHoras) {
				return `O plano de emergência exige um intervalo mínimo de ${plano.detalhesEmergencia.intervaloMinimoHoras} horas entre tarefas.`
			}
		}
	}
	return null
}

export function aplicarHorarioPreferencial(dataAgendada, horarioPreferencial) {
	const data = new Date(dataAgendada)
	if (!horarioPreferencial) return data

	const hhmm = horarioPreferencial.match(/(\d{2}):(\d{2})/)
	if (!hhmm) return data

	if (data.getUTCHours() === 0) {
		data.setHours(parseInt(hhmm[1], 10), parseInt(hhmm[2], 10), 0, 0)
	}

	return data
}

function obterHorasTolerancia(plano, tarefa) {
	let horasTolerancia = 24

	if (plano) {
		if (plano.tipo === 'regular' && plano.tarefasOperacionais) {
			if (tarefa.tipo === 'rega' && plano.tarefasOperacionais.regaFrequenciaHoras) horasTolerancia = plano.tarefasOperacionais.regaFrequenciaHoras
			else if (tarefa.tipo === 'fertilização' && plano.tarefasOperacionais.fertilizacaoFrequenciaHoras) horasTolerancia = plano.tarefasOperacionais.fertilizacaoFrequenciaHoras
			else if (tarefa.tipo === 'monitorização' && plano.tarefasOperacionais.monitorizacaoFrequenciaHoras) horasTolerancia = plano.tarefasOperacionais.monitorizacaoFrequenciaHoras
		} else if (plano.tipo === 'emergência' && plano.detalhesEmergencia?.intervaloMinimoHoras) {
			horasTolerancia = plano.detalhesEmergencia.intervaloMinimoHoras
		}
	}

	return horasTolerancia
}

export async function atualizarEstadoTarefasPendentes(tarefasPendentes, user, agora = new Date()) {
	for (const tarefa of tarefasPendentes) {
		const lote = tarefa.loteId
		const plano = lote?.planoId

		if (lote && lote.modo === 'Automático' && tarefa.dataAgendada <= agora) {
			tarefa.estado = 'Executada'
			tarefa.dataExecucao = agora
			if (user) tarefa.responsavelId = user._id
			await tarefa.save()
			await LogAuditoria.create({
				utilizadorId: user ? user._id : null,
				acao: 'EXECUCAO_AUTOMATICA_TAREFA',
				entidade: 'Tarefa',
				entidadeId: tarefa._id,
				detalhes: { motivo: `Lote em modo Automático cumpriu a hora agendada para ${tarefa.tipo}` }
			})
			continue
		}

		const horasTolerancia = obterHorasTolerancia(plano, tarefa)
		const limiteExpiracao = new Date(tarefa.dataAgendada.getTime() + horasTolerancia * 36e5)
		if (agora.getTime() > limiteExpiracao.getTime()) {
			tarefa.estado = 'Expirada'
			await tarefa.save()
		}
	}
}

export async function gerarTarefasCsv() {
	const tarefas = await Tarefa.find()
		.populate('loteId', 'estado modo')
		.populate('responsavelId', 'name')
		.sort({ dataAgendada: -1 })

	const linhas = [
		'Lote ID,Tipo de Tarefa,Estado,Data Agendada,Data Execução,Responsável'
	]

	tarefas.forEach(t => {
		linhas.push(csvLine([
			t.loteId?._id || '',
			t.tipo,
			t.estado,
			t.dataAgendada?.toISOString() || '',
			t.dataExecucao?.toISOString() || '',
			t.responsavelId?.name || ''
		]))
	})

	return linhas.join('\n')
}

export async function criarTarefa(body, user) {
	const erroValidacao = await validarTarefasPlano(body.loteId, body.tipo, body.dataAgendada)
	if (erroValidacao) {
		return { status: 400, payload: { success: false, message: erroValidacao } }
	}

	const payload = { ...body }
	const lote = await LoteCultivo.findById(payload.loteId).populate('planoId')
	if (lote && lote.planoId && lote.planoId.tarefasOperacionais?.horarioPreferencial) {
		const dataAjustada = aplicarHorarioPreferencial(payload.dataAgendada, lote.planoId.tarefasOperacionais.horarioPreferencial)
		payload.dataAgendada = dataAjustada
	}

	const novaTarefa = await Tarefa.create(payload)

	await LogAuditoria.create({
		utilizadorId: user._id,
		acao: 'CRIAR_TAREFA',
		entidade: 'Tarefa',
		entidadeId: novaTarefa._id,
		detalhes: payload
	})

	return { status: 201, payload: { success: true, data: novaTarefa } }
}

export async function atualizarTarefa(tarefaId, body, user) {
	const tarefaExistente = await Tarefa.findById(tarefaId)
	if (!tarefaExistente) {
		return { status: 404, payload: { success: false, message: 'Tarefa não encontrada.' } }
	}

	if (body.dataAgendada || body.tipo) {
		const tipoCheck = body.tipo || tarefaExistente.tipo
		const dataCheck = body.dataAgendada || tarefaExistente.dataAgendada
		const erroValidacao = await validarTarefasPlano(tarefaExistente.loteId, tipoCheck, dataCheck)
		if (erroValidacao) {
			return { status: 400, payload: { success: false, message: erroValidacao } }
		}
	}

	const payload = { ...body }
	if (payload.estado === 'Executada' && tarefaExistente.estado !== 'Executada') {
		const dataAtual = new Date()
		const dataAgendada = new Date(tarefaExistente.dataAgendada)
		if (dataAtual < dataAgendada) {
			return { status: 400, payload: { success: false, message: 'A tarefa apenas pode ser executada na data agendada ou após a mesma.' } }
		}

		const tarefasAnterioresPendentes = await Tarefa.findOne({
			loteId: tarefaExistente.loteId,
			estado: 'Pendente',
			dataAgendada: { $lt: dataAgendada }
		})
		if (tarefasAnterioresPendentes) {
			return { status: 400, payload: { success: false, message: 'Existem tarefas anteriores pendentes para este lote. Deve concluir as tarefas mais antigas primeiro.' } }
		}

		payload.dataExecucao = dataAtual
	}

	const tarefaAtualizada = await Tarefa.findByIdAndUpdate(
		tarefaId,
		payload,
		{ returnDocument: 'after', runValidators: true }
	)

	await LogAuditoria.create({
		utilizadorId: user._id,
		acao: 'ATUALIZAR_TAREFA',
		entidade: 'Tarefa',
		entidadeId: tarefaAtualizada._id,
		detalhes: payload
	})

	return { status: 200, payload: { success: true, data: tarefaAtualizada } }
}
