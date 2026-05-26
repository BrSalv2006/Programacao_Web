import fs from 'fs'
import csv from 'csv-parser'
import ErvaAromatica from '../models/ervaAromatica.js'
import LogAuditoria from '../models/logAuditoria.js'

export async function listarErvas(all, view) {
	const query = all === 'true' ? {} : { ativo: true }
	let projection

	if (view === 'select') {
		projection = 'nome'
	} else if (view === 'planos') {
		projection = 'nome condicoesIdeais'
	}

	return ErvaAromatica.find(query)
		.select(projection || undefined)
		.sort({ nome: 1 })
}

export async function obterErva(ervaId) {
	const erva = await ErvaAromatica.findById(ervaId)

	if (!erva) {
		return { status: 404, payload: { success: false, message: 'Erva aromática não encontrada.' } }
	}

	return { status: 200, payload: { success: true, data: erva } }
}

export async function criarErva(body, user) {
	const erva = await ErvaAromatica.create(body)

	await LogAuditoria.create({
		utilizadorId: user._id,
		acao: 'CRIAR_ERVA',
		entidade: 'ErvaAromatica',
		entidadeId: erva._id,
		detalhes: { nome: erva.nome }
	})

	return { status: 201, payload: { success: true, data: erva } }
}

export async function atualizarErva(ervaId, body, user) {
	const ervaExistente = await ErvaAromatica.findById(ervaId)
	if (!ervaExistente) {
		return { status: 404, payload: { success: false, message: 'Erva aromática não encontrada.' } }
	}

	const ervaAtualizada = await ErvaAromatica.findByIdAndUpdate(ervaId, body, { returnDocument: 'after', runValidators: true })
	await LogAuditoria.create({
		utilizadorId: user._id,
		acao: 'ATUALIZAR_ERVA',
		entidade: 'ErvaAromatica',
		entidadeId: ervaAtualizada._id,
		detalhes: { nome: ervaAtualizada.nome }
	})

	return { status: 200, payload: { success: true, data: ervaAtualizada } }
}

export async function importarErvas(filePath, user) {
	const resultados = []
	const erros = []

	return new Promise((resolve, reject) => {
		fs.createReadStream(filePath)
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
				} catch {
					erros.push(data)
				}
			})
			.on('end', async () => {
				try {
					const inseridos = await ErvaAromatica.insertMany(resultados, { ordered: false })

					await LogAuditoria.create({
						utilizadorId: user._id,
						acao: 'IMPORTAR_ERVAS',
						entidade: 'ErvaAromatica',
						detalhes: { totalInseridos: inseridos.length, totalErros: erros.length }
					})

					resolve({
						status: 201,
						payload: { success: true, message: `Importação concluída. ${inseridos.length} registos inseridos.` }
					})
				} catch (err) {
					if (err.writeErrors) {
						resolve({
							status: 207,
							payload: {
								success: true,
								message: `Importação parcial. ${err.insertedDocs.length} inseridos, ${err.writeErrors.length} falharam.`,
								erros: err.writeErrors.map(e => e.errmsg)
							}
						})
					} else {
						reject(err)
					}
				}
			})
			.on('error', reject)
	})
}
