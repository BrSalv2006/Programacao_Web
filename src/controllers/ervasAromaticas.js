import express from 'express'
import multer from 'multer'
import fs from 'fs'
import requireRole from '../middleware/requireRole.js'
import asyncHandler from '../middleware/asyncHandler.js'
import {
	listarErvas,
	obterErva,
	criarErva,
	atualizarErva,
	importarErvas
} from '../services/ervasAromaticasService.js'

const router = express.Router()
const upload = multer({ dest: 'uploads/' })

router.get('/', asyncHandler(async (req, res) => {
	const ervas = await listarErvas(req.query.all, req.query.view)

	res.status(200).json({ success: true, data: ervas })
}))

router.get('/:id', asyncHandler(async (req, res) => {
	const resultado = await obterErva(req.params.id)
	res.status(resultado.status).json(resultado.payload)
}))

router.post('/', requireRole('Administrador', 'Responsável'), asyncHandler(async (req, res) => {
	const resultado = await criarErva(req.body, req.user)
	res.status(resultado.status).json(resultado.payload)
}))

router.patch('/:id', requireRole('Administrador', 'Responsável'), asyncHandler(async (req, res) => {
	const resultado = await atualizarErva(req.params.id, req.body, req.user)
	res.status(resultado.status).json(resultado.payload)
}))

router.post('/importar', requireRole('Administrador', 'Responsável'), upload.single('file'), asyncHandler(async (req, res) => {
	if (!req.file) {
		return res.status(400).json({ success: false, message: 'Ficheiro não enviado.' })
	}

	try {
		const resultado = await importarErvas(req.file.path, req.user)
		res.status(resultado.status).json(resultado.payload)
	} finally {
		if (req.file && fs.existsSync(req.file.path)) {
			fs.unlinkSync(req.file.path)
		}
	}
}))

export default router
