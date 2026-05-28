import express from 'express'
import MedicaoAmbiental from '../models/medicaoAmbiental.js'
import Alerta from '../models/alerta.js'
import requireRole from '../middleware/requireRole.js'
import asyncHandler from '../middleware/asyncHandler.js'
import {
	processarNovaMedicao,
	gerarMedicoesCsv,
	atualizarAlerta
} from '../services/medicoesService.js'

const router = express.Router()

router.get('/', asyncHandler(async (req, res) => {
	const filter = req.query.loteId ? { loteId: req.query.loteId } : {}
	const medicoes = await MedicaoAmbiental.find(filter).sort({ dataHora: -1 })
	res.status(200).json({ success: true, data: medicoes })
}))

router.get('/exportar', requireRole('Administrador', 'Responsável'), asyncHandler(async (req, res) => {
	const csvContent = await gerarMedicoesCsv()
	res.setHeader('Content-Type', 'text/csv; charset=utf-8')
	res.setHeader('Content-Disposition', 'attachment; filename="medicoes.csv"')
	res.status(200).send(csvContent)
}))

router.post('/', asyncHandler(async (req, res) => {
	const novaMedicao = await processarNovaMedicao(req.body, req.user)
	res.status(201).json({ success: true, data: novaMedicao })
}))

router.get('/alertas', asyncHandler(async (req, res) => {
	const view = req.query.view
	if (view === 'compact') {
		const alertas = await Alerta.find()
			.select('tipo nivel estado createdAt')
			.sort({ createdAt: -1 })
		return res.status(200).json({ success: true, data: alertas })
	}

	const alertas = await Alerta.find().populate('loteId', 'nome').sort({ createdAt: -1 })
	res.status(200).json({ success: true, data: alertas })
}))

router.patch('/alertas/:id', requireRole('Administrador', 'Responsável'), asyncHandler(async (req, res) => {
	const resultado = await atualizarAlerta(req.params.id, req.body, req.user)
	res.status(resultado.status).json(resultado.payload)
}))

export default router
