import express from 'express'
import PlanoCultivo from '../models/planoCultivo.js'
import LogAuditoria from '../models/logAuditoria.js'
import requireRole from '../middleware/requireRole.js'

const router = express.Router()

router.get('/', async (req, res, next) => {
	try {
		const planos = await PlanoCultivo.find()
			.populate('ervaId', 'nome')
			.sort({ createdAt: -1 })

		res.status(200).json({ success: true, data: planos })
	} catch (error) {
		next(error)
	}
})

router.post('/', requireRole('Administrador', 'Responsável'), async (req, res, next) => {
	try {
		const novoPlano = await PlanoCultivo.create(req.body)

		await LogAuditoria.create({
			utilizadorId: req.user._id,
			acao: 'CRIAR_PLANO_CULTIVO',
			entidade: 'PlanoCultivo',
			entidadeId: novoPlano._id,
			detalhes: { tipo: novoPlano.tipo, ervaId: novoPlano.ervaId }
		})

		res.status(201).json({ success: true, data: novoPlano })
	} catch (error) {
		next(error)
	}
})

router.patch('/:id', requireRole('Administrador', 'Responsável'), async (req, res, next) => {
	try {
		const planoAtualizado = await PlanoCultivo.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true })

		if (!planoAtualizado) {
			return res.status(404).json({ success: false, message: 'Plano não encontrado.' })
		}

		await LogAuditoria.create({
			utilizadorId: req.user._id,
			acao: 'ATUALIZAR_PLANO_CULTIVO',
			entidade: 'PlanoCultivo',
			entidadeId: planoAtualizado._id,
			detalhes: req.body
		})

		res.status(200).json({ success: true, data: planoAtualizado })
	} catch (error) {
		next(error)
	}
})

export default router
