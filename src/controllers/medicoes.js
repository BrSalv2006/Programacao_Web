import express from 'express'
import MedicaoAmbiental from '../models/medicaoAmbiental.js'
import Alerta from '../models/alerta.js'
import LoteCultivo from '../models/loteCultivo.js'
import Tarefa from '../models/tarefa.js'
import LogAuditoria from '../models/logAuditoria.js'
import requireRole from '../middleware/requireRole.js'
import asyncHandler from '../middleware/asyncHandler.js'
import {
	avaliarFalhasSensor,
	avaliarCondicoesPlano,
	escolherAcaoAutomacao
} from '../services/medicoesService.js'

const router = express.Router()

router.get('/', asyncHandler(async (req, res) => {
	const filter = req.query.loteId ? { loteId: req.query.loteId } : {}
	const medicoes = await MedicaoAmbiental.find(filter).sort({ dataHora: -1 })
	res.status(200).json({ success: true, data: medicoes })
}))

router.get('/exportar', requireRole('Administrador', 'Responsável'), asyncHandler(async (req, res) => {
	const medicoes = await MedicaoAmbiental.find().sort({ dataHora: -1 })

	const linhas = [
		'Lote ID,Data e Hora,Temperatura (°C),Humidade (%),Luminosidade (lux),Falha de Sensor'
	]

	medicoes.forEach(m => {
		linhas.push([
			m.loteId,
			m.dataHora?.toISOString() || '',
			m.temperatura,
			m.humidade,
			m.luminosidade,
			m.falhaSensor ? 'Sim' : 'Não'
		].map(valor => `"${String(valor).replace(/"/g, '""')}"`).join(','))
	})

	res.setHeader('Content-Type', 'text/csv; charset=utf-8')
	res.setHeader('Content-Disposition', 'attachment; filename="medicoes.csv"')
	res.status(200).send(linhas.join('\n'))
}))

router.post('/', requireRole('Administrador', 'Técnico'), asyncHandler(async (req, res) => {
	const novaMedicao = await MedicaoAmbiental.create(req.body)
	const falhasSensor = avaliarFalhasSensor(novaMedicao)
	if (novaMedicao.falhaSensor) falhasSensor.push('Falha de sensor reportada')

	if (falhasSensor.length > 0 && !novaMedicao.falhaSensor) {
		novaMedicao.falhaSensor = true
		await novaMedicao.save()
	}

	const lote = await LoteCultivo.findById(req.body.loteId).populate('planoId')

	if (falhasSensor.length > 0 && lote) {
		await Alerta.create({
			loteId: lote._id,
			medicaoId: novaMedicao._id,
			nivel: 'Crítico',
			tipo: falhasSensor.join(', ')
		})
	}

	if (lote && lote.planoId && lote.planoId.condicoesIdeais && falhasSensor.length === 0) {
		const problemas = avaliarCondicoesPlano(novaMedicao, lote.planoId.condicoesIdeais)

		if (problemas.length > 0) {
			const acao = escolherAcaoAutomacao(problemas)
			await Alerta.create({
				loteId: lote._id,
				medicaoId: novaMedicao._id,
				nivel: problemas.some(p => p.includes('alta') || p.includes('baixa')) ? 'Crítico' : 'Aviso',
				tipo: problemas.join(', ')
			})

			if (lote.modo === 'Automático') {
				let dataAgendada = new Date()
				if (lote.planoId?.tarefasOperacionais?.horarioPreferencial) {
					const hhmm = lote.planoId.tarefasOperacionais.horarioPreferencial.match(/(\d{2}):(\d{2})/)
					if (hhmm) dataAgendada.setHours(parseInt(hhmm[1], 10), parseInt(hhmm[2], 10), 0, 0)
				}

				const tarefa = await Tarefa.create({
					loteId: lote._id,
					tipo: acao.tarefa,
					estado: 'Executada',
					dataAgendada: dataAgendada,
					dataExecucao: new Date()
				})

				await LogAuditoria.create({
					utilizadorId: req.user._id,
					acao: 'EXECUTAR_AUTOMACAO',
					entidade: 'Tarefa',
					entidadeId: tarefa._id,
					detalhes: { acao: acao.descricao, problemas, modo: lote.modo }
				})
			} else {
				let dataAgendada = new Date()
				if (lote.planoId?.tarefasOperacionais?.horarioPreferencial) {
					const hhmm = lote.planoId.tarefasOperacionais.horarioPreferencial.match(/(\d{2}):(\d{2})/)
					if (hhmm) dataAgendada.setHours(parseInt(hhmm[1], 10), parseInt(hhmm[2], 10), 0, 0)
				}

				const tarefa = await Tarefa.create({
					loteId: lote._id,
					tipo: acao.tarefa,
					estado: 'Pendente',
					dataAgendada: dataAgendada
				})

				await Alerta.create({
					loteId: lote._id,
					medicaoId: novaMedicao._id,
					nivel: 'Informativo',
					tipo: `Sugestão de automação: ${acao.descricao}`
				})

				await LogAuditoria.create({
					utilizadorId: req.user._id,
					acao: 'SUGERIR_AUTOMACAO',
					entidade: 'Tarefa',
					entidadeId: tarefa._id,
					detalhes: { acao: acao.descricao, problemas, modo: lote.modo }
				})
			}
		}
	}

	await LogAuditoria.create({
		utilizadorId: req.user._id,
		acao: 'REGISTAR_MEDICAO_AMBIENTAL',
		entidade: 'MedicaoAmbiental',
		entidadeId: novaMedicao._id,
		detalhes: { loteId: req.body.loteId, falhaSensor: novaMedicao.falhaSensor }
	})

	res.status(201).json({ success: true, data: novaMedicao })
}))

router.get('/alertas', asyncHandler(async (req, res) => {
	const view = req.query.view
	if (view === 'compact') {
		const alertas = await Alerta.find()
			.select('tipo nivel estado createdAt')
			.sort({ createdAt: -1 })
		return res.status(200).json({ success: true, data: alertas })
	}

	const alertas = await Alerta.find().sort({ createdAt: -1 })
	res.status(200).json({ success: true, data: alertas })
}))

router.patch('/alertas/:id', requireRole('Administrador', 'Responsável'), asyncHandler(async (req, res) => {
	if (req.body.estado === 'Ignorado' && !req.body.justificacao?.trim()) {
		return res.status(400).json({ success: false, message: 'A justificação é obrigatória ao ignorar um alerta.' })
	}

	const alertaAtualizado = await Alerta.findByIdAndUpdate(
		req.params.id,
		req.body,
		{ returnDocument: 'after', runValidators: true }
	)

	if (!alertaAtualizado) {
		return res.status(404).json({ success: false, message: 'Alerta não encontrado.' })
	}

	await LogAuditoria.create({
		utilizadorId: req.user._id,
		acao: 'TRATAR_ALERTA',
		entidade: 'Alerta',
		entidadeId: alertaAtualizado._id,
		detalhes: { estado: alertaAtualizado.estado, justificacao: alertaAtualizado.justificacao }
	})

	res.status(200).json({ success: true, data: alertaAtualizado })
}))

export default router
