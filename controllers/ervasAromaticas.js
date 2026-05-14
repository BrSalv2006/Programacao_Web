import express from 'express'
import multer from 'multer'
import fs from 'fs'
import csv from 'csv-parser'
import path from 'path'
import ErvaAromatica from '../models/ervaAromatica.js'
import LogAuditoria from '../models/logAuditoria.js'
import requireRole from '../middleware/requireRole.js'

const router = express.Router()
const upload = multer({ dest: 'uploads/' })

router.get('/', async (req, res, next) => {
	try {
		const query = req.query.all === 'true' ? {} : { ativo: true }
		const ervas = await ErvaAromatica.find(query).sort({ nome: 1 })

		res.status(200).json({ success: true, data: ervas })
	} catch (error) {
		next(error)
	}
})

router.get('/:id', async (req, res, next) => {
	try {
		const erva = await ErvaAromatica.findById(req.params.id)

		if (!erva) {
			return res.status(404).json({ success: false, message: 'Erva aromática não encontrada.' })
		}

		res.status(200).json({ success: true, data: erva })
	} catch (error) {
		next(error)
	}
})

router.post('/', requireRole('Administrador', 'Responsável'), async (req, res, next) => {
	try {
		const erva = await ErvaAromatica.create(req.body)

		await LogAuditoria.create({
			utilizadorId: req.user._id,
			acao: 'CRIAR_ERVA',
			entidade: 'ErvaAromatica',
			entidadeId: erva._id,
			detalhes: { nome: erva.nome }
		})

		res.status(201).json({ success: true, data: erva })
	} catch (error) {
		next(error)
	}
})

router.patch('/:id', requireRole('Administrador', 'Responsável'), async (req, res, next) => {
	try {
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
	} catch (error) {
		next(error)
	}
})

router.post('/importar', requireRole('Administrador', 'Responsável'), upload.single('file'), async (req, res, next) => {
	try {
		if (!req.file) {
			return res.status(400).json({ success: false, message: 'Ficheiro não enviado.' })
		}

		const resultados = []
		const erros = []

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
						descricao: data.descricao?.trim()
					}
					resultados.push(novaErva)
				} catch (err) {
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

					fs.unlinkSync(req.file.path)
					res.status(201).json({ success: true, message: `Importação concluída. ${inseridos.length} registos inseridos.` })
				} catch (err) {
					fs.unlinkSync(req.file.path)
					if (err.writeErrors) {
						return res.status(207).json({
							success: true,
							message: `Importação parcial. ${err.insertedDocs.length} inseridos, ${err.writeErrors.length} falharam.`,
							erros: err.writeErrors.map(e => e.errmsg)
						})
					}
					next(err)
				}
			})
			.on('error', (error) => {
				fs.unlinkSync(req.file.path)
				next(error)
			})
	} catch (error) {
		if (req.file && fs.existsSync(req.file.path)) {
			fs.unlinkSync(req.file.path)
		}
		next(error)
	}
})

export default router
