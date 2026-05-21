import express from 'express'
import LoteCultivo from '../models/loteCultivo.js'
import PlanoCultivo from '../models/planoCultivo.js'
import Tarefa from '../models/tarefa.js'
import MedicaoAmbiental from '../models/medicaoAmbiental.js'
import LogAuditoria from '../models/logAuditoria.js'
import requireRole from '../middleware/requireRole.js'

const router = express.Router()

async function gerarTarefasAutomaticas(lote) {
	if (lote.estado !== 'ativo') return

	const plano = await PlanoCultivo.findById(lote.planoId)
	if (!plano) return

	const currentTarefas = await Tarefa.find({ loteId: lote._id, estado: 'Pendente' })
	if (currentTarefas.length > 0) return // já tem tarefas para não duplicar

	// Tentar colocar pelo menos 1 semana de tarefas
	const diasAsSimular = Math.min(plano.duracaoPrevistaDias || 7, 7)
	const horasTotais = diasAsSimular * 24

	const hhmm = plano.tarefasOperacionais?.horarioPreferencial?.match(/(\d{2}):(\d{2})/)
	const horaPreferencial = hhmm ? parseInt(hhmm[1], 10) : 8

	const gerarAgendamentos = (frequenciaHoras, tipo) => {
		if (!frequenciaHoras || frequenciaHoras <= 0) return
		const agora = new Date()
		let atual = new Date(agora)

		atual.setHours(horaPreferencial, 0, 0, 0)
		if (atual < agora) atual.setTime(atual.getTime() + frequenciaHoras * 3600000)

		const agendamentos = []
		const limite = new Date(agora.getTime() + horasTotais * 3600000)

		while (atual <= limite) {
			agendamentos.push({
				loteId: lote._id,
				tipo,
				estado: 'Pendente',
				dataAgendada: new Date(atual)
			})
			atual.setTime(atual.getTime() + frequenciaHoras * 3600000)
		}
		return agendamentos
	}

	let tarefasParaCriar = []

	if (plano.tipo === 'regular' && plano.tarefasOperacionais) {
		const ops = plano.tarefasOperacionais
		if (ops.tiposPermitidos?.includes('rega')) {
			tarefasParaCriar.push(...(gerarAgendamentos(ops.regaFrequenciaHoras, 'rega') || []))
		}
		if (ops.tiposPermitidos?.includes('fertilização')) {
			tarefasParaCriar.push(...(gerarAgendamentos(ops.fertilizacaoFrequenciaHoras, 'fertilização') || []))
		}
		if (ops.tiposPermitidos?.includes('monitorização')) {
			tarefasParaCriar.push(...(gerarAgendamentos(ops.monitorizacaoFrequenciaHoras, 'monitorização') || []))
		}
	} else if (plano.tipo === 'emergência' && plano.detalhesEmergencia) {
		tarefasParaCriar.push(...(gerarAgendamentos(plano.detalhesEmergencia.intervaloMinimoHoras, plano.detalhesEmergencia.tipoIntervencao === 'remediar' ? 'outro' : 'monitorização') || []))
	}

	if (tarefasParaCriar.length > 0) {
		await Tarefa.insertMany(tarefasParaCriar)
	}
}

function prepararPayloadLote(body) {
	const payload = { ...body }
	if (payload.planoId && !payload.planosAssociados) payload.planosAssociados = [payload.planoId]
	return payload
}

router.get('/', async (req, res, next) => {
	try {
		const lotes = await LoteCultivo.find()
			.populate('ervaId', 'nome cicloDiasFim')
			.populate('planoId', 'nome tipo')
			.populate('planosAssociados', 'nome tipo')
			.populate('historicoPlanos.planoId', 'nome tipo')
			.sort({ createdAt: -1 })
		res.status(200).json({ success: true, data: lotes })
	} catch (error) {
		next(error)
	}
})

router.get('/exportar', requireRole('Administrador', 'Responsável'), async (req, res, next) => {
	try {
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
			linhas.push([
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
			].map(valor => `"${String(valor).replace(/"/g, '""')}"`).join(','))
		})

		res.setHeader('Content-Type', 'text/csv; charset=utf-8')
		res.setHeader('Content-Disposition', 'attachment; filename="lotes-cultivo.csv"')
		res.status(200).send(linhas.join('\n'))
	} catch (error) {
		next(error)
	}
})

router.get('/:id', async (req, res, next) => {
	try {
		const lote = await LoteCultivo.findById(req.params.id)
			.populate('ervaId', 'nome')
			.populate('planoId')
			.populate('planosAssociados')
			.populate('historicoPlanos.planoId', 'nome tipo')
		if (!lote) {
			return res.status(404).json({ success: false, message: 'Lote de cultivo não encontrado.' })
		}
		res.status(200).json({ success: true, data: lote })
	} catch (error) {
		next(error)
	}
})

router.post('/', requireRole('Administrador', 'Responsável'), async (req, res, next) => {
	try {
		const novoLote = await LoteCultivo.create(prepararPayloadLote(req.body))

		await gerarTarefasAutomaticas(novoLote)

		await LogAuditoria.create({
			utilizadorId: req.user._id,
			acao: 'CRIAR_LOTE_CULTIVO',
			entidade: 'LoteCultivo',
			entidadeId: novoLote._id,
			detalhes: { ervaId: novoLote.ervaId, planoId: novoLote.planoId, modo: novoLote.modo }
		})

		res.status(201).json({ success: true, data: novoLote })
	} catch (error) {
		next(error)
	}
})

router.post('/:id/dividir', requireRole('Administrador', 'Responsável'), async (req, res, next) => {
	try {
		const { quantidadeRetirada, novoNome } = req.body
		if (!quantidadeRetirada || quantidadeRetirada <= 0) {
			return res.status(400).json({ success: false, message: 'Quantidade inválida.' })
		}

		const loteOriginal = await LoteCultivo.findById(req.params.id)
		if (!loteOriginal) {
			return res.status(404).json({ success: false, message: 'Lote não encontrado.' })
		}
		if (loteOriginal.estado !== 'ativo') {
			return res.status(400).json({ success: false, message: 'Só é possível dividir lotes ativos.' })
		}

		const atual = loteOriginal.quantidadeAtual

		if (quantidadeRetirada >= atual) {
			return res.status(400).json({ success: false, message: 'Quantidade a retirar deve ser menor que a quantidade atual do lote.' })
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
			utilizadorId: req.user._id,
			acao: 'DIVIDIR_LOTE_CULTIVO',
			entidade: 'LoteCultivo',
			entidadeId: loteOriginal._id,
			detalhes: { quantidadeRetirada, novoLoteId: novoLote._id }
		})

		res.status(201).json({ success: true, message: 'Lote dividido com sucesso.', data: novoLote })
	} catch (error) {
		next(error)
	}
})

router.patch('/:id/alterar-plano', requireRole('Administrador', 'Responsável'), async (req, res, next) => {
	try {
		const { novoPlanoId } = req.body
		if (!novoPlanoId) return res.status(400).json({ success: false, message: 'ID do novo plano é obrigatório.' })

		const lote = await LoteCultivo.findById(req.params.id)
		if (!lote) return res.status(404).json({ success: false, message: 'Lote não encontrado.' })

		if (lote.estado !== 'ativo') return res.status(400).json({ success: false, message: 'Apenas lotes ativos podem alterar o plano de cultivo.' })

		lote.planoId = novoPlanoId
		await lote.save()

		await gerarTarefasAutomaticas(lote)

		await LogAuditoria.create({
			utilizadorId: req.user._id,
			acao: 'ALTERAR_PLANO_LOTE',
			entidade: 'LoteCultivo',
			entidadeId: lote._id,
			detalhes: { novoPlanoId }
		})

		res.status(200).json({ success: true, message: 'Plano do lote alterado com sucesso.', data: lote })
	} catch (error) {
		next(error)
	}
})

router.patch('/:id/concluir', requireRole('Administrador', 'Responsável'), async (req, res, next) => {
	try {
		const { perdas, quantidadeColhida } = req.body
		const lote = await LoteCultivo.findById(req.params.id)
		if (!lote) {
			return res.status(404).json({ success: false, message: 'Lote não encontrado.' })
		}

		if (quantidadeColhida !== undefined) {
			const maxColheita = lote.quantidadeAtual || (lote.quantidadeInicial - lote.perdas)
			if (Number(quantidadeColhida) > maxColheita) {
				return res.status(400).json({ success: false, message: `A quantidade colhida ultrapassa o disponível (${maxColheita} uds).` })
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
			utilizadorId: req.user._id,
			acao: 'CONCLUIR_LOTE_CULTIVO',
			entidade: 'LoteCultivo',
			entidadeId: lote._id,
			detalhes: { perdas: lote.perdas, quantidadeColhida: lote.quantidadeColhida, produtividade: lote.produtividade }
		})
		res.status(200).json({ success: true, message: 'Lote concluído com sucesso.', data: lote })
	} catch (error) {
		next(error)
	}
})

router.patch('/:id/registar-perdas', requireRole('Administrador', 'Responsável', 'Técnico'), async (req, res, next) => {
	try {
		const { quantidadePerdida } = req.body
		if (!quantidadePerdida || Number(quantidadePerdida) <= 0) {
			return res.status(400).json({ success: false, message: 'A quantidade perdida informada deve ser superior a zero.' })
		}

		const lote = await LoteCultivo.findById(req.params.id)
		if (!lote) return res.status(404).json({ success: false, message: 'Lote não encontrado.' })

		if (lote.estado !== 'ativo') {
			return res.status(400).json({ success: false, message: 'Apenas é possível registar perdas isoladas em lotes ativos.' })
		}

		if ((lote.perdas + Number(quantidadePerdida)) > lote.quantidadeInicial) {
			return res.status(400).json({ success: false, message: 'A soma das perdas não pode exceder a quantidade inicial do lote.' })
		}

		lote.perdas += Number(quantidadePerdida)
		await lote.save()

		await LogAuditoria.create({
			utilizadorId: req.user._id,
			acao: 'REGISTAR_PERDAS_LOTE',
			entidade: 'LoteCultivo',
			entidadeId: lote._id,
			detalhes: { perdasRegistadas: quantidadePerdida, totalPerdasAgregadas: lote.perdas }
		})
		res.status(200).json({ success: true, message: 'Nova perda registada no lote com sucesso.', data: lote })
	} catch (error) {
		next(error)
	}
})

router.patch('/:id/comprometer', requireRole('Administrador', 'Responsável'), async (req, res, next) => {
	try {
		const lote = await LoteCultivo.findById(req.params.id)
		if (!lote) return res.status(404).json({ success: false, message: 'Lote não encontrado.' })

		lote.estado = 'comprometido'
		lote.dataFimReal = Date.now()
		lote.perdas = lote.quantidadeInicial
		lote.quantidadeColhida = 0
		await lote.save()

		await LogAuditoria.create({
			utilizadorId: req.user._id,
			acao: 'COMPROMETER_LOTE_CULTIVO',
			entidade: 'LoteCultivo',
			entidadeId: lote._id,
			detalhes: { perdas: lote.perdas }
		})

		res.status(200).json({ success: true, data: lote })
	} catch (error) {
		next(error)
	}
})

router.get('/:id/resumo', async (req, res, next) => {
	try {
		const lote = await LoteCultivo.findById(req.params.id)
			.populate('ervaId', 'nome')
			.populate('planoId')
			.populate('planosAssociados')

		if (!lote) return res.status(404).json({ success: false, message: 'Lote não encontrado.' })

		const [tarefasPendentes, tarefasExecutadas, medicoes] = await Promise.all([
			Tarefa.find({ loteId: lote._id, estado: 'Pendente' }).sort({ dataAgendada: 1 }),
			Tarefa.find({ loteId: lote._id, estado: 'Executada' }).sort({ dataExecucao: -1 }),
			MedicaoAmbiental.find({ loteId: lote._id }).sort({ dataHora: -1 }).limit(50)
		])

		res.status(200).json({
			success: true,
			data: {
				lote,
				planos: lote.planosAssociados,
				tarefasPendentes,
				tarefasExecutadas,
				medicoes
			}
		})
	} catch (error) {
		next(error)
	}
})

export default router
