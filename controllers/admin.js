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

router.get('/logs/exportar', requireRole('Administrador'), async (req, res, next) => {
	try {
		const { acao, entidade } = req.query
		let query = {}

		if (acao) {
			query.acao = { $regex: acao, $options: 'i' }
		}
		if (entidade) {
			query.entidade = entidade
		}

		const logs = await LogAuditoria.find(query).populate('utilizadorId', 'name').sort({ createdAt: -1 })

		const linhas = ['Data,Utilizador,Acao,Entidade,Detalhes']

		logs.forEach(log => {
			const date = new Date(log.createdAt).toLocaleString('pt-PT')
			const user = log.utilizadorId ? log.utilizadorId.name : 'Sistema'

			let detalhesText = ''
			if (log.detalhes) {
				const entries = Object.entries(log.detalhes).filter(([k]) => !['_id', '__v', 'createdAt', 'updatedAt'].includes(k))
				detalhesText = entries.map(([k, v]) => {
					const valStr = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)
					return `${k}: ${valStr}`
				}).join(' | ')
			}

			const escapedDetalhes = detalhesText.replace(/"/g, '""')

			linhas.push(`"${date}","${user}","${log.acao || ''}","${log.entidade || ''}","${escapedDetalhes}"`)
		})

		const csvContent = '\uFEFF' + linhas.join('\n')

		res.setHeader('Content-Type', 'text/csv; charset=utf-8')
		res.setHeader('Content-Disposition', 'attachment; filename="logs-auditoria.csv"')
		res.status(200).send(csvContent)
	} catch (error) {
		next(error)
	}
})

export default router
