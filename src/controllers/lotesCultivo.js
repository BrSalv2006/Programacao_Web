import express from 'express'
import LoteCultivo from '../models/loteCultivo.js'
import requireRole from '../middleware/requireRole.js'
import asyncHandler from '../middleware/asyncHandler.js'
import {
	criarLote,
	dividirLote,
	alterarPlanoLote,
	concluirLote,
	registarPerdasLote,
	comprometerLote,
	obterResumoLote,
	gerarLotesCsv
} from '../services/lotesService.js'

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
	const csvContent = await gerarLotesCsv()
	res.setHeader('Content-Type', 'text/csv; charset=utf-8')
	res.setHeader('Content-Disposition', 'attachment; filename="lotes-cultivo.csv"')
	res.status(200).send(csvContent)
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
	const resultado = await criarLote(req.body, req.user)
	res.status(resultado.status).json(resultado.payload)
}))

router.post('/:id/dividir', requireRole('Administrador', 'Responsável'), asyncHandler(async (req, res) => {
	const resultado = await dividirLote(req.params.id, req.body.quantidadeRetirada, req.body.novoNome, req.user)
	res.status(resultado.status).json(resultado.payload)
}))

router.patch('/:id/alterar-plano', requireRole('Administrador', 'Responsável'), asyncHandler(async (req, res) => {
	const resultado = await alterarPlanoLote(req.params.id, req.body.novoPlanoId, req.user)
	res.status(resultado.status).json(resultado.payload)
}))

router.patch('/:id/concluir', requireRole('Administrador', 'Responsável'), asyncHandler(async (req, res) => {
	const resultado = await concluirLote(req.params.id, req.body.perdas, req.body.quantidadeColhida, req.user)
	res.status(resultado.status).json(resultado.payload)
}))

router.patch('/:id/registar-perdas', asyncHandler(async (req, res) => {
	const resultado = await registarPerdasLote(req.params.id, req.body.quantidadePerdida, req.user)
	res.status(resultado.status).json(resultado.payload)
}))

router.patch('/:id/comprometer', requireRole('Administrador', 'Responsável'), asyncHandler(async (req, res) => {
	const resultado = await comprometerLote(req.params.id, req.user)
	res.status(resultado.status).json(resultado.payload)
}))

router.get('/:id/resumo', asyncHandler(async (req, res) => {
	const resultado = await obterResumoLote(req.params.id)
	res.status(resultado.status).json(resultado.payload)
}))

export default router
