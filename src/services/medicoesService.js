import MedicaoAmbiental from '../models/medicaoAmbiental.js'
import Alerta from '../models/alerta.js'
import LoteCultivo from '../models/loteCultivo.js'
import Tarefa from '../models/tarefa.js'
import LogAuditoria from '../models/logAuditoria.js'
import { csvLine } from './csvUtils.js'

export const limitesFisicos = {
	temperatura: { min: -20, max: 60 },
	humidade: { min: 0, max: 100 },
	luminosidade: { min: 0, max: 200000 }
}

export function valorValido(valor) {
	return typeof valor === 'number' && Number.isFinite(valor)
}

export function avaliarFalhasSensor(medicao) {
	const problemas = []

	Object.entries(limitesFisicos).forEach(([campo, limite]) => {
		const valor = medicao[campo]
		if (!valorValido(valor)) {
			problemas.push(`Dados em falta: ${campo}`)
			return
		}
		if (valor < limite.min || valor > limite.max) {
			problemas.push(`Dados incoerentes: ${campo}`)
		}
	})

	return problemas
}

export function avaliarCondicoesPlano(medicao, condicoes = {}) {
	const problemas = []

	if (valorValido(condicoes.temperaturaMax) && medicao.temperatura > condicoes.temperaturaMax)
		problemas.push({ tipo: 'temperatura_alta', msg: `Temperatura alta: Real ${medicao.temperatura}ºC, Max Esperado: ${condicoes.temperaturaMax}ºC` })
	if (valorValido(condicoes.temperaturaMin) && medicao.temperatura < condicoes.temperaturaMin)
		problemas.push({ tipo: 'temperatura_baixa', msg: `Temperatura baixa: Real ${medicao.temperatura}ºC, Min Esperado: ${condicoes.temperaturaMin}ºC` })

	if (valorValido(condicoes.humidadeMax) && medicao.humidade > condicoes.humidadeMax)
		problemas.push({ tipo: 'humidade_alta', msg: `Humidade alta: Real ${medicao.humidade}%, Max Esperado: ${condicoes.humidadeMax}%` })
	if (valorValido(condicoes.humidadeMin) && medicao.humidade < condicoes.humidadeMin)
		problemas.push({ tipo: 'humidade_baixa', msg: `Humidade baixa: Real ${medicao.humidade}%, Min Esperado: ${condicoes.humidadeMin}%` })

	if (valorValido(condicoes.luminosidadeMax) && medicao.luminosidade > condicoes.luminosidadeMax)
		problemas.push({ tipo: 'luminosidade_alta', msg: `Luminosidade alta: Real ${medicao.luminosidade}lux, Max Esperado: ${condicoes.luminosidadeMax}lux` })
	if (valorValido(condicoes.luminosidadeMin) && medicao.luminosidade < condicoes.luminosidadeMin)
		problemas.push({ tipo: 'luminosidade_baixa', msg: `Luminosidade baixa: Real ${medicao.luminosidade}lux, Min Esperado: ${condicoes.luminosidadeMin}lux` })

	return problemas
}

export function escolherAcaoAutomacao(problemas) {
	if (problemas.some(p => p.tipo === 'humidade_baixa')) return { tarefa: 'rega', descricao: 'Ativar sistema de rega/aspersão' }
	if (problemas.some(p => p.tipo.includes('temperatura'))) return { tarefa: 'monitorização', descricao: 'Ajustar sistema de climatização' }
	if (problemas.some(p => p.tipo.includes('luminosidade'))) return { tarefa: 'monitorização', descricao: 'Ajustar iluminação/estores' }
	return { tarefa: 'monitorização', descricao: 'Verificar condições ambientais' }
}

function obterDataAgendadaPreferencial(horarioPreferencial) {
	const dataAgendada = new Date()
	if (!horarioPreferencial) return dataAgendada

	const hhmm = horarioPreferencial.match(/(\d{2}):(\d{2})/)
	if (hhmm) {
		dataAgendada.setHours(parseInt(hhmm[1], 10), parseInt(hhmm[2], 10), 0, 0)
	}

	return dataAgendada
}

export async function processarNovaMedicao(body, user) {
	const novaMedicao = await MedicaoAmbiental.create(body)
	const falhasSensor = avaliarFalhasSensor(novaMedicao)
	if (novaMedicao.falhaSensor) falhasSensor.push('Falha de sensor reportada')

	if (falhasSensor.length > 0 && !novaMedicao.falhaSensor) {
		novaMedicao.falhaSensor = true
		await novaMedicao.save()
	}

	const lote = await LoteCultivo.findById(body.loteId).populate('planoId')

	if (falhasSensor.length > 0 && lote) {
		await Alerta.create({
			loteId: lote._id,
			medicaoId: novaMedicao._id,
			nivel: 'Crítico',
			tipo: falhasSensor.join(', ')
		})
	}

	if (lote && lote.planoId && lote.planoId.condicoesIdeais && falhasSensor.length === 0) {
		const problemasDocs = avaliarCondicoesPlano(novaMedicao, lote.planoId.condicoesIdeais)

		if (problemasDocs.length > 0) {
			const mensagens = problemasDocs.map(p => p.msg)
			const acao = escolherAcaoAutomacao(problemasDocs)

			await Alerta.create({
				loteId: lote._id,
				medicaoId: novaMedicao._id,
				nivel: problemasDocs.some(p => p.tipo.includes('alta') || p.tipo.includes('baixa')) ? 'Crítico' : 'Aviso',
				tipo: mensagens.join(' | ')
			})

			const horarioPreferencial = lote.planoId?.tarefasOperacionais?.horarioPreferencial
			const dataAgendada = obterDataAgendadaPreferencial(horarioPreferencial)

			if (lote.modo === 'Automático') {
				const hardwarePayload = {
					dispositivoId: `ATUADOR-${lote._id.toString().substring(0, 6).toUpperCase()}`,
					comando: acao.tarefa.toUpperCase(),
					parametros: acao.descricao,
					timestamp: new Date().toISOString()
				}
				console.log(`[SIMULAÇÃO HARDWARE IoT] -> Comando enviado:`, hardwarePayload)

				const tarefa = await Tarefa.create({
					loteId: lote._id,
					tipo: acao.tarefa,
					estado: 'Executada',
					dataAgendada: dataAgendada,
					dataExecucao: new Date()
				})

				await LogAuditoria.create({
					utilizadorId: user._id,
					acao: 'EXECUTAR_AUTOMACAO',
					entidade: 'Tarefa',
					entidadeId: tarefa._id,
					detalhes: { acao: acao.descricao, problemas: mensagens, modo: lote.modo, emulacaoIoT: hardwarePayload }
				})
			} else {
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
					utilizadorId: user._id,
					acao: 'SUGERIR_AUTOMACAO',
					entidade: 'Tarefa',
					entidadeId: tarefa._id,
					detalhes: { acao: acao.descricao, problemas: mensagens, modo: lote.modo }
				})
			}
		}
	}

	await LogAuditoria.create({
		utilizadorId: user._id,
		acao: 'REGISTAR_MEDICAO_AMBIENTAL',
		entidade: 'MedicaoAmbiental',
		entidadeId: novaMedicao._id,
		detalhes: { loteId: body.loteId, falhaSensor: novaMedicao.falhaSensor }
	})

	return novaMedicao
}

export async function gerarMedicoesCsv() {
	const medicoes = await MedicaoAmbiental.find().sort({ dataHora: -1 })

	const linhas = [
		'Lote ID,Data e Hora,Temperatura (°C),Humidade (%),Luminosidade (lux),Falha de Sensor'
	]

	medicoes.forEach(m => {
		linhas.push(csvLine([
			m.loteId,
			m.dataHora?.toISOString() || '',
			m.temperatura,
			m.humidade,
			m.luminosidade,
			m.falhaSensor ? 'Sim' : 'Não'
		]))
	})

	return linhas.join('\n')
}

export async function atualizarAlerta(alertaId, payload, user) {
	if (payload.estado === 'Ignorado' && !payload.justificacao?.trim()) {
		return { status: 400, payload: { success: false, message: 'A justificação é obrigatória ao ignorar um alerta.' } }
	}

	const alertaAtualizado = await Alerta.findByIdAndUpdate(
		alertaId,
		payload,
		{ returnDocument: 'after', runValidators: true }
	)

	if (!alertaAtualizado) {
		return { status: 404, payload: { success: false, message: 'Alerta não encontrado.' } }
	}

	await LogAuditoria.create({
		utilizadorId: user._id,
		acao: 'TRATAR_ALERTA',
		entidade: 'Alerta',
		entidadeId: alertaAtualizado._id,
		detalhes: { estado: alertaAtualizado.estado, justificacao: alertaAtualizado.justificacao }
	})

	return { status: 200, payload: { success: true, data: alertaAtualizado } }
}
