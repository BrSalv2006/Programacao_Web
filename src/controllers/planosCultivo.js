import express from 'express'
import PlanoCultivo from '../models/planoCultivo.js'
import LogAuditoria from '../models/logAuditoria.js'
import requireRole from '../middleware/requireRole.js'
import asyncHandler from '../middleware/asyncHandler.js'
import LoteCultivo from '../models/loteCultivo.js'
import Tarefa from '../models/tarefa.js'
import { gerarTarefasAutomaticas } from '../services/lotesService.js'

const router = express.Router()

router.get('/', asyncHandler(async (req, res) => {
	const view = req.query.view
	if (view === 'select') {
		const planos = await PlanoCultivo.find()
			.select('nome tipo ervaId')
			.sort({ createdAt: -1 })
		return res.status(200).json({ success: true, data: planos })
	}

	const planos = await PlanoCultivo.find()
		.populate('ervaId', 'nome')
		.sort({ createdAt: -1 })

	res.status(200).json({ success: true, data: planos })
}))

router.post('/', requireRole('Administrador', 'Responsável'), asyncHandler(async (req, res) => {
	const tarefasOps = req.body?.tarefasOperacionais
	if (tarefasOps?.colheitaNoFim && tarefasOps?.colheitaFrequenciaHoras) {
		return res.status(400).json({ success: false, message: 'Não é permitido definir colheita recorrente e colheita no fim do ciclo em simultâneo.' })
	}
	if (tarefasOps?.colheitaNoFim) {
		tarefasOps.colheitaFrequenciaHoras = null
	}

	const novoPlano = await PlanoCultivo.create(req.body)

	await LogAuditoria.create({
		utilizadorId: req.user._id,
		acao: 'CRIAR_PLANO_CULTIVO',
		entidade: 'PlanoCultivo',
		entidadeId: novoPlano._id,
		detalhes: { tipo: novoPlano.tipo, ervaId: novoPlano.ervaId }
	})

	res.status(201).json({ success: true, data: novoPlano })
}))

router.patch('/:id', requireRole('Administrador', 'Responsável'), asyncHandler(async (req, res) => {
	const tarefasOps = req.body?.tarefasOperacionais
	if (tarefasOps?.colheitaNoFim && tarefasOps?.colheitaFrequenciaHoras) {
		return res.status(400).json({ success: false, message: 'Não é permitido definir colheita recorrente e colheita no fim do ciclo em simultâneo.' })
	}
	if (tarefasOps?.colheitaNoFim) {
		tarefasOps.colheitaFrequenciaHoras = null
	}

	const planoAtualizado = await PlanoCultivo.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true })

	if (!planoAtualizado) {
		return res.status(404).json({ success: false, message: 'Plano não encontrado.' })
	}

	if (planoAtualizado.tarefasOperacionais?.colheitaNoFim) {
		const lotesAtivos = await LoteCultivo.find({ planoId: planoAtualizado._id, estado: 'ativo' })
			.select('_id planoId estado dataInicio')

		for (const lote of lotesAtivos) {
			await Tarefa.deleteMany({ loteId: lote._id, tipo: 'colheita', estado: 'Pendente' })
			await gerarTarefasAutomaticas(lote)
		}
	}

	await LogAuditoria.create({
		utilizadorId: req.user._id,
		acao: 'ATUALIZAR_PLANO_CULTIVO',
		entidade: 'PlanoCultivo',
		entidadeId: planoAtualizado._id,
		detalhes: req.body
	})

	res.status(200).json({ success: true, data: planoAtualizado })
}))

export default router
