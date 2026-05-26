import express from 'express'
import multer from 'multer'
import fs from 'fs'
import csv from 'csv-parser'
import ErvaAromatica from '../models/ervaAromatica.js'
import LogAuditoria from '../models/logAuditoria.js'
import requireRole from '../middleware/requireRole.js'
import asyncHandler from '../middleware/asyncHandler.js'

const router = express.Router()
const upload = multer({ dest: 'uploads/' })

router.get('/', asyncHandler(async (req, res) => {
	const query = req.query.all === 'true' ? {} : { ativo: true }
	const view = req.query.view
	let projection

	if (view === 'select') {
		projection = 'nome'
	} else if (view === 'planos') {
		projection = 'nome condicoesIdeais'
	}

	const ervas = await ErvaAromatica.find(query)
		.select(projection || undefined)
		.sort({ nome: 1 })

	res.status(200).json({ success: true, data: ervas })
}))

router.get('/:id', asyncHandler(async (req, res) => {
	const erva = await ErvaAromatica.findById(req.params.id)

	if (!erva) {
		return res.status(404).json({ success: false, message: 'Erva aromática não encontrada.' })
	}

	res.status(200).json({ success: true, data: erva })
}))

router.post('/', requireRole('Administrador', 'Responsável'), asyncHandler(async (req, res) => {
	const erva = await ErvaAromatica.create(req.body)

	await LogAuditoria.create({
		utilizadorId: req.user._id,
		acao: 'CRIAR_ERVA',
		entidade: 'ErvaAromatica',
		entidadeId: erva._id,
		detalhes: { nome: erva.nome }
	})

	res.status(201).json({ success: true, data: erva })
}))

router.patch('/:id', requireRole('Administrador', 'Responsável'), asyncHandler(async (req, res) => {
	const erva = await ErvaAromatica.findById(req.params.id)
	if (!erva) {
		return res.status(404).json({ success: false, message: 'Erva aromática não encontrada.' })
	}

	const ervaAtualizada = await ErvaAromatica.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true })
	await LogAuditoria.create({
		utilizadorId: req.user._id,
		acao: 'ATUALIZAR_ERVA',
		entidade: 'ErvaAromatica',
		entidadeId: ervaAtualizada._id,
		detalhes: { nome: ervaAtualizada.nome }
	})

	res.status(200).json({ success: true, data: ervaAtualizada })
}))

router.post('/importar', requireRole('Administrador', 'Responsável'), upload.single('file'), asyncHandler(async (req, res) => {
	if (!req.file) {
		return res.status(400).json({ success: false, message: 'Ficheiro não enviado.' })
	}

	const resultados = []
	const erros = []

	try {
		await new Promise((resolve, reject) => {
			fs.createReadStream(req.file.path)
				.pipe(csv())
				.on('data', (data) => {
					try {
						const novaErva = {
							nome: data.nome?.trim(),
							nomeCientifico: data.nomeCientifico?.trim(),
							variedade: data.variedade?.trim(),
							familia: data.familia?.trim(),
							cicloDiasFim: Number(data.cicloDiasFim),
							descricao: data.descricao?.trim(),
							condicoesIdeais: {
								temperaturaMin: data.temperaturaMin ? Number(data.temperaturaMin) : undefined,
								temperaturaMax: data.temperaturaMax ? Number(data.temperaturaMax) : undefined,
								humidadeMin: data.humidadeMin ? Number(data.humidadeMin) : undefined,
								humidadeMax: data.humidadeMax ? Number(data.humidadeMax) : undefined,
								luminosidadeMin: data.luminosidadeMin ? Number(data.luminosidadeMin) : undefined,
								luminosidadeMax: data.luminosidadeMax ? Number(data.luminosidadeMax) : undefined
							},
							ativo: data.ativo ? (() => {
								const normalized = String(data.ativo).trim().toLowerCase()
								if (normalized === '1') return true
								if (normalized === '0') return false
								return normalized === 'true'
							})() : true
						}
						resultados.push(novaErva)
					} catch (error) {
						erros.push(data)
					}
				})
				.on('end', async () => {
					try {
						const inseridos = await ErvaAromatica.insertMany(resultados, { ordered: false })

						await LogAuditoria.create({
							utilizadorId: req.user._id,
							acao: 'IMPORTAR_ERVAS',
							entidade: 'ErvaAromatica',
							detalhes: { totalInseridos: inseridos.length, totalErros: erros.length }
						})

						res.status(201).json({ success: true, message: `Importação concluída. ${inseridos.length} registos inseridos.` })
						resolve()
					} catch (err) {
						if (err.writeErrors) {
							res.status(207).json({
								success: true,
								message: `Importação parcial. ${err.insertedDocs.length} inseridos, ${err.writeErrors.length} falharam.`,
								erros: err.writeErrors.map(e => e.errmsg)
							})
							resolve()
						} else {
							reject(err)
						}
					}
				})
				.on('error', reject)
		})
	} finally {
		if (req.file && fs.existsSync(req.file.path)) {
			fs.unlinkSync(req.file.path)
		}
	}
}))

export default router
