import express from 'express'
import Users from '../models/user.js'
import LogAuditoria from '../models/logAuditoria.js'
import requireRole from '../middleware/requireRole.js'

const router = express.Router()

router.get('/users', async (req, res, next) => {
	try {
		const users = await Users.find().sort({ createdAt: -1 })
		res.status(200).json({ success: true, data: users })
	} catch (error) {
		next(error)
	}
})

router.patch('/users/:id/role', async (req, res, next) => {
	try {
		const user = await Users.findByIdAndUpdate(req.params.id, { role: req.body.role }, { returnDocument: 'after' })
		if (!user) {
			return res.status(404).json({ success: false, message: 'User não encontrado.' })
		}

		await LogAuditoria.create({
			utilizadorId: req.user._id,
			acao: 'ATUALIZAR_PERFIL_UTILIZADOR',
			entidade: 'User',
			entidadeId: user._id,
			detalhes: { role: user.role }
		})

		res.status(200).json({ success: true, data: user, message: 'Perfil atualizado.' })
	} catch (error) {
		next(error)
	}
})

router.get('/logs', async (req, res, next) => {
	try {
		const logs = await LogAuditoria.find().populate('utilizadorId', 'name email').sort({ createdAt: -1 }).limit(200)
		res.status(200).json({ success: true, data: logs })
	} catch (error) {
		next(error)
	}
})

export default router
