import express from 'express'
import asyncHandler from '../middleware/asyncHandler.js'
import {
	listarUsers,
	atualizarRoleUser,
	listarLogs,
	gerarLogsCsv
} from '../services/adminService.js'

const router = express.Router()

router.get('/users', asyncHandler(async (req, res) => {
	const users = await listarUsers()
	res.status(200).json({ success: true, data: users })
}))

router.patch('/users/:id/role', asyncHandler(async (req, res) => {
	const resultado = await atualizarRoleUser(req.params.id, req.body.role, req.user)
	res.status(resultado.status).json(resultado.payload)
}))

router.get('/logs', asyncHandler(async (req, res) => {
	const logs = await listarLogs()
	res.status(200).json({ success: true, data: logs })
}))

router.get('/logs/exportar', asyncHandler(async (req, res) => {
	const csvContent = await gerarLogsCsv(req.query)
	res.setHeader('Content-Type', 'text/csv; charset=utf-8')
	res.setHeader('Content-Disposition', 'attachment; filename="logs-auditoria.csv"')
	res.status(200).send(csvContent)
}))

export default router
