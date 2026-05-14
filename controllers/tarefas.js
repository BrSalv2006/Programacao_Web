import express from 'express'
import Tarefa from '../models/tarefa.js'
import LoteCultivo from '../models/loteCultivo.js'
import PlanoCultivo from '../models/planoCultivo.js'
import LogAuditoria from '../models/logAuditoria.js'
import requireRole from '../middleware/requireRole.js'

const router = express.Router()

async function validarTarefasPlano(loteId, tipoTarefa, dataAgendada) {
	const lote = await LoteCultivo.findById(loteId).populate('planoId')
	if (!lote) {
		throw new Error('Lote de cultivo não encontrado.')
	}
	if (lote.estado !== 'ativo') {
		throw new Error('Apenas é possível agendar tarefas para lotes ativos.')
	}

	const plano = lote.planoId
	if (!plano) {
		return
	}

	if (plano.tarefasOperacionais && plano.tarefasOperacionais.tiposPermitidos) {
		if (!plano.tarefasOperacionais.tiposPermitidos.includes(tipoTarefa)) {
			throw new Error(`O tipo de tarefa '${tipoTarefa}' não é permitido neste plano de cultivo.`)
		}
	}

	if (plano.tipo === 'emergência' && plano.detalhesEmergencia?.intervaloMinimoHoras) {
		const ultimasTarefas = await Tarefa.find({ loteId, tipo: tipoTarefa }).sort({ dataAgendada: -1 }).limit(1)
		if (ultimasTarefas.length > 0) {
			const ultima = ultimasTarefas[0]
			const diffHoras = Math.abs(new Date(dataAgendada) - new Date(ultima.dataAgendada)) / 36e5
			if (diffHoras < plano.detalhesEmergencia.intervaloMinimoHoras) {
				throw new Error(`O plano de emergência exige um intervalo mínimo de ${plano.detalhesEmergencia.intervaloMinimoHoras} horas entre tarefas deste tipo.`)
			}
		}
	}
}

router.get('/', async (req, res, next) => {
	try {
		const tarefasPendentes = await Tarefa.find({ estado: 'Pendente' }).populate({
			path: 'loteId',
			populate: { path: 'planoId' }
		})

		for (const tarefa of tarefasPendentes) {
			let horasTolerancia = 24

			if (tarefa.loteId && tarefa.loteId.planoId) {
				const plano = tarefa.loteId.planoId
				if (plano.tipo === 'regular' && plano.tarefasOperacionais) {
					if (tarefa.tipo === 'rega' && plano.tarefasOperacionais.regaFrequenciaHoras) {
						horasTolerancia = plano.tarefasOperacionais.regaFrequenciaHoras
					} else if (tarefa.tipo === 'fertilização' && plano.tarefasOperacionais.fertilizacaoFrequenciaHoras) {
						horasTolerancia = plano.tarefasOperacionais.fertilizacaoFrequenciaHoras
					} else if (tarefa.tipo === 'monitorização' && plano.tarefasOperacionais.monitorizacaoFrequenciaHoras) {
						horasTolerancia = plano.tarefasOperacionais.monitorizacaoFrequenciaHoras
					}
				} else if (plano.tipo === 'emergência' && plano.detalhesEmergencia?.intervaloMinimoHoras) {
					horasTolerancia = plano.detalhesEmergencia.intervaloMinimoHoras
				}
			}

			const limiteExpiracao = new Date(tarefa.dataAgendada.getTime() + horasTolerancia * 60 * 60 * 1000)
			if (Date.now() > limiteExpiracao.getTime()) {
				tarefa.estado = 'Expirada'
				await tarefa.save()
			}
		}

		const filter = req.query.loteId ? { loteId: req.query.loteId } : {}
		const tarefas = await Tarefa.find(filter)
			.populate('loteId', 'estado modo')
			.populate('responsavelId', 'name')
			.sort({ dataAgendada: 1 })

		res.status(200).json({ success: true, data: tarefas })
	} catch (error) {
		next(error)
	}
})

router.get('/exportar', requireRole('Administrador', 'Responsável'), async (req, res, next) => {
	try {
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
	} catch (error) {
		next(error)
	}
})

router.post('/', requireRole('Administrador', 'Técnico'), async (req, res, next) => {
	try {
		await validarTarefasPlano(req.body.loteId, req.body.tipo, req.body.dataAgendada)

		// Ajustar a hora da tarefa para a do horarioPreferencial se existir e for uma data inicial (input de type="date")
		const lote = await LoteCultivo.findById(req.body.loteId).populate('planoId')
		if (lote && lote.planoId && lote.planoId.tarefasOperacionais?.horarioPreferencial) {
			const hhmm = lote.planoId.tarefasOperacionais.horarioPreferencial.match(/(\d{2}):(\d{2})/)
			if (hhmm) {
				const data = new Date(req.body.dataAgendada)
				// Verifica se a hora atual é à meia-noite (UTC) ou 01:00, comummente submetido por type="date"
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
	} catch (error) {
		if (error.message.includes('não é permitido') || error.message.includes('exige um intervalo mínimo') || error.message.includes('ativos')) {
			return res.status(400).json({ success: false, message: error.message })
		}
		next(error)
	}
})

router.patch('/:id', requireRole('Administrador', 'Técnico'), async (req, res, next) => {
	try {
		const tarefaExistente = await Tarefa.findById(req.params.id)
		if (!tarefaExistente) {
			return res.status(404).json({ success: false, message: 'Tarefa não encontrada.' })
		}

		if (req.body.dataAgendada || req.body.tipo) {
			const tipoCheck = req.body.tipo || tarefaExistente.tipo
			const dataCheck = req.body.dataAgendada || tarefaExistente.dataAgendada
			await validarTarefasPlano(tarefaExistente.loteId, tipoCheck, dataCheck)
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
	} catch (error) {
		next(error)
	}
})

export default router
