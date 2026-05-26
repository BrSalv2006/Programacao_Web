import express from 'express'
import LoteCultivo from '../models/loteCultivo.js'
import PlanoCultivo from '../models/planoCultivo.js'
import Tarefa from '../models/tarefa.js'
import MedicaoAmbiental from '../models/medicaoAmbiental.js'
import LogAuditoria from '../models/logAuditoria.js'
import requireRole from '../middleware/requireRole.js'
import asyncHandler from '../middleware/asyncHandler.js'
import { gerarTarefasAutomaticas, prepararPayloadLote } from '../services/lotesService.js'

const router = express.Router()

router.get('/', asyncHandler(async (req, res) => {
	const view = req.query.view
	if (view === 'compact') {
		const lotes = await LoteCultivo.find()
			.select('estado')
			.sort({ createdAt: -1 })
		return res.status(200).json({ success: true, data: lotes })
	}
	if (view === 'select') {
		const lotes = await LoteCultivo.find()
			.select('ervaId estado modo')
			.populate('ervaId', 'nome')
			.sort({ createdAt: -1 })
		return res.status(200).json({ success: true, data: lotes })
	}

	const lotes = await LoteCultivo.find()
		.populate('ervaId', 'nome')
		.populate('planoId', 'nome tipo duracaoPrevistaDias')
		.populate('historicoPlanos.planoId', 'nome tipo')
		.sort({ createdAt: -1 })
	res.status(200).json({ success: true, data: lotes })
}))

router.get('/exportar', requireRole('Administrador', 'Responsável'), asyncHandler(async (req, res) => {
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
}))

router.get('/:id', asyncHandler(async (req, res) => {
	const lote = await LoteCultivo.findById(req.params.id)
		.populate('ervaId', 'nome')
		.populate('planoId')
		.populate('planosAssociados')
		.populate('historicoPlanos.planoId', 'nome tipo')
	if (!lote) {
		return res.status(404).json({ success: false, message: 'Lote de cultivo não encontrado.' })
	}
	res.status(200).json({ success: true, data: lote })
}))

router.post('/', requireRole('Administrador', 'Responsável'), asyncHandler(async (req, res) => {
	const planoBase = await PlanoCultivo.findById(req.body.planoId).select('tipo').lean()
	if (!planoBase) {
		return res.status(400).json({ success: false, message: 'Plano de cultivo inválido.' })
	}
	if (planoBase.tipo !== 'regular') {
		return res.status(400).json({ success: false, message: 'A criação do lote exige um plano de cultivo regular.' })
	}

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
}))

router.post('/:id/dividir', requireRole('Administrador', 'Responsável'), asyncHandler(async (req, res) => {
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
}))

router.patch('/:id/alterar-plano', requireRole('Administrador', 'Responsável'), asyncHandler(async (req, res) => {
	const { novoPlanoId } = req.body
	if (!novoPlanoId) return res.status(400).json({ success: false, message: 'ID do novo plano é obrigatório.' })

	const novoPlano = await PlanoCultivo.findById(novoPlanoId).select('tipo').lean()
	if (!novoPlano) {
		return res.status(400).json({ success: false, message: 'Plano de cultivo inválido.' })
	}
	if (novoPlano.tipo !== 'regular') {
		return res.status(400).json({ success: false, message: 'A alteração do lote exige um plano de cultivo regular.' })
	}

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
}))

router.patch('/:id/concluir', requireRole('Administrador', 'Responsável'), asyncHandler(async (req, res) => {
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
}))

router.patch('/:id/registar-perdas', requireRole('Administrador', 'Responsável', 'Técnico'), asyncHandler(async (req, res) => {
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
}))

router.patch('/:id/comprometer', requireRole('Administrador', 'Responsável'), asyncHandler(async (req, res) => {
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
}))

router.get('/:id/resumo', asyncHandler(async (req, res) => {
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
}))

export default router
