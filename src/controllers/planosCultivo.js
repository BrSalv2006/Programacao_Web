import express from 'express'
import requireRole from '../middleware/requireRole.js'
import asyncHandler from '../middleware/asyncHandler.js'
import {
	listarPlanos,
	criarPlano,
	atualizarPlano,
	aprovarPlanoPontual
} from '../services/planosCultivoService.js'

const router = express.Router()

router.get('/', asyncHandler(async (req, res) => {
	const planos = await listarPlanos(req.query.view)
	res.status(200).json({ success: true, data: planos })
}))

router.post('/', asyncHandler(async (req, res) => {
	const resultado = await criarPlano(req.body, req.user)
	res.status(resultado.status).json(resultado.payload)
}))

router.patch('/:id', asyncHandler(async (req, res) => {
	const resultado = await atualizarPlano(req.params.id, req.body, req.user)
	res.status(resultado.status).json(resultado.payload)
}))

router.patch('/:id/aprovar', requireRole('Administrador', 'Responsável'), asyncHandler(async (req, res) => {
	const resultado = await aprovarPlanoPontual(req.params.id, req.user)
	res.status(resultado.status).json(resultado.payload)
}))

export default router
