import express from 'express'
import Tarefa from '../models/tarefa.js'
import requireRole from '../middleware/requireRole.js'
import asyncHandler from '../middleware/asyncHandler.js'
import {
	garantirTarefasDoDia,
	atualizarEstadoTarefasPendentes,
	gerarTarefasCsv,
	criarTarefa,
	atualizarTarefa
} from '../services/tarefasService.js'

const router = express.Router()

router.get('/', asyncHandler(async (req, res) => {
	await garantirTarefasDoDia()

	const tarefasPendentes = await Tarefa.find({ estado: 'Pendente' }).populate({
		path: 'loteId',
		populate: { path: 'planoId' }
	})

	const agora = new Date()
	await atualizarEstadoTarefasPendentes(tarefasPendentes, req.user, agora)

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
	const csvContent = await gerarTarefasCsv()
	res.setHeader('Content-Type', 'text/csv; charset=utf-8')
	res.setHeader('Content-Disposition', 'attachment; filename="tarefas.csv"')
	res.status(200).send(csvContent)
}))

router.post('/', requireRole('Administrador', 'Técnico'), asyncHandler(async (req, res) => {
	const resultado = await criarTarefa(req.body, req.user)
	res.status(resultado.status).json(resultado.payload)
}))

router.patch('/:id', requireRole('Administrador', 'Técnico'), asyncHandler(async (req, res) => {
	const resultado = await atualizarTarefa(req.params.id, req.body, req.user)
	res.status(resultado.status).json(resultado.payload)
}))

export default router
