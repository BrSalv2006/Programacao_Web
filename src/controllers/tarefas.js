import express from 'express'
import Tarefa from '../models/tarefa.js'
import LoteCultivo from '../models/loteCultivo.js'
import LogAuditoria from '../models/logAuditoria.js'
import requireRole from '../middleware/requireRole.js'
import asyncHandler from '../middleware/asyncHandler.js'
import { gerarTarefasAutomaticas } from '../services/lotesService.js'

const router = express.Router()

async function garantirTarefasDoDia() {
	const lotesAtivos = await LoteCultivo.find({ estado: 'ativo' }).select('_id planoId estado')
	for (const lote of lotesAtivos) {
		try {
			await gerarTarefasAutomaticas(lote)
		} catch (error) {
			console.error(error.message)
		}
	}
}

async function validarTarefasPlano(loteId, tipoTarefa, dataAgendada) {
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

router.get('/', asyncHandler(async (req, res) => {
	await garantirTarefasDoDia()

	const tarefasPendentes = await Tarefa.find({ estado: 'Pendente' }).populate({
		path: 'loteId',
		populate: { path: 'planoId' }
	})

	const agora = new Date()

	for (const tarefa of tarefasPendentes) {
		const lote = tarefa.loteId
		const plano = lote?.planoId

		if (lote && lote.modo === 'Automático' && tarefa.dataAgendada <= agora) {
			tarefa.estado = 'Executada'
			tarefa.dataExecucao = agora
			if (req.user) tarefa.responsavelId = req.user._id
			await tarefa.save()
			await LogAuditoria.create({
				utilizadorId: req.user ? req.user._id : null,
				acao: 'EXECUCAO_AUTOMATICA_TAREFA',
				entidade: 'Tarefa',
				entidadeId: tarefa._id,
				detalhes: { motivo: `Lote em modo Automático cumpriu a hora agendada para ${tarefa.tipo}` }
			})
			continue
		}

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

		const limiteExpiracao = new Date(tarefa.dataAgendada.getTime() + horasTolerancia * 36e5)
		if (agora.getTime() > limiteExpiracao.getTime()) {
			tarefa.estado = 'Expirada'
			await tarefa.save()
		}
	}

	const filter = req.query.loteId ? { loteId: req.query.loteId } : {}
	const view = req.query.view
	if (view === 'compact') {
		const tarefas = await Tarefa.find(filter)
			.select('estado')
			.sort({ dataAgendada: 1 })
		return res.status(200).json({ success: true, data: tarefas })
	}

	const tarefas = await Tarefa.find(filter)
		.populate('loteId', 'estado modo')
		.populate('responsavelId', 'name')
		.sort({ dataAgendada: 1 })

	res.status(200).json({ success: true, data: tarefas })
}))

router.get('/exportar', requireRole('Administrador', 'Responsável'), asyncHandler(async (req, res) => {
	const tarefas = await Tarefa.find()
		.populate('loteId', 'estado modo')
		.populate('responsavelId', 'name')
		.sort({ dataAgendada: -1 })

	const linhas = [
		'Lote ID,Tipo de Tarefa,Estado,Data Agendada,Data Execução,Responsável'
	]

	tarefas.forEach(t => {
		linhas.push([
			t.loteId?._id || '',
			t.tipo,
			t.estado,
			t.dataAgendada?.toISOString() || '',
			t.dataExecucao?.toISOString() || '',
			t.responsavelId?.name || ''
		].map(valor => `"${String(valor).replace(/"/g, '""')}"`).join(','))
	})

	res.setHeader('Content-Type', 'text/csv; charset=utf-8')
	res.setHeader('Content-Disposition', 'attachment; filename="tarefas.csv"')
	res.status(200).send(linhas.join('\n'))
}))

router.post('/', requireRole('Administrador', 'Técnico'), asyncHandler(async (req, res) => {
	const erroValidacao = await validarTarefasPlano(req.body.loteId, req.body.tipo, req.body.dataAgendada)
	if (erroValidacao) return res.status(400).json({ success: false, message: erroValidacao })

	const lote = await LoteCultivo.findById(req.body.loteId).populate('planoId')
	if (lote && lote.planoId && lote.planoId.tarefasOperacionais?.horarioPreferencial) {
		const hhmm = lote.planoId.tarefasOperacionais.horarioPreferencial.match(/(\d{2}):(\d{2})/)
		if (hhmm) {
			const data = new Date(req.body.dataAgendada)
			if (data.getUTCHours() === 0) {
				data.setHours(parseInt(hhmm[1], 10), parseInt(hhmm[2], 10), 0, 0)
				req.body.dataAgendada = data
			}
		}
	}

	const novaTarefa = await Tarefa.create(req.body)

	await LogAuditoria.create({
		utilizadorId: req.user._id,
		acao: 'CRIAR_TAREFA',
		entidade: 'Tarefa',
		entidadeId: novaTarefa._id,
		detalhes: req.body
	})

	res.status(201).json({ success: true, data: novaTarefa })
}))

router.patch('/:id', requireRole('Administrador', 'Técnico'), asyncHandler(async (req, res) => {
	const tarefaExistente = await Tarefa.findById(req.params.id)
	if (!tarefaExistente) {
		return res.status(404).json({ success: false, message: 'Tarefa não encontrada.' })
	}

	if (req.body.dataAgendada || req.body.tipo) {
		const tipoCheck = req.body.tipo || tarefaExistente.tipo
		const dataCheck = req.body.dataAgendada || tarefaExistente.dataAgendada
		const erroValidacao = await validarTarefasPlano(tarefaExistente.loteId, tipoCheck, dataCheck)
		if (erroValidacao) return res.status(400).json({ success: false, message: erroValidacao })
	}

	if (req.body.estado === 'Executada' && tarefaExistente.estado !== 'Executada') {
		const dataAtual = new Date()
		const dataAgendada = new Date(tarefaExistente.dataAgendada)
		if (dataAtual < dataAgendada) {
			return res.status(400).json({ success: false, message: 'A tarefa apenas pode ser executada na data agendada ou após a mesma.' })
		}

		const tarefasAnterioresPendentes = await Tarefa.findOne({
			loteId: tarefaExistente.loteId,
			estado: 'Pendente',
			dataAgendada: { $lt: dataAgendada }
		})
		if (tarefasAnterioresPendentes) {
			return res.status(400).json({ success: false, message: 'Existem tarefas anteriores pendentes para este lote. Deve concluir as tarefas mais antigas primeiro.' })
		}

		req.body.dataExecucao = dataAtual
	}

	const tarefaAtualizada = await Tarefa.findByIdAndUpdate(
		req.params.id,
		req.body,
		{ returnDocument: 'after', runValidators: true }
	)

	await LogAuditoria.create({
		utilizadorId: req.user._id,
		acao: 'ATUALIZAR_TAREFA',
		entidade: 'Tarefa',
		entidadeId: tarefaAtualizada._id,
		detalhes: req.body
	})

	res.status(200).json({ success: true, data: tarefaAtualizada })
}))

export default router
