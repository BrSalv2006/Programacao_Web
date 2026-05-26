import PlanoCultivo from '../models/planoCultivo.js'
import LogAuditoria from '../models/logAuditoria.js'
import LoteCultivo from '../models/loteCultivo.js'
import Tarefa from '../models/tarefa.js'
import { gerarTarefasAutomaticas } from './lotesService.js'

function validarTarefasOperacionais(body) {
	const tarefasOps = body?.tarefasOperacionais
	if (tarefasOps?.colheitaNoFim && tarefasOps?.colheitaFrequenciaHoras) {
		return 'Não é permitido definir colheita recorrente e colheita no fim do ciclo em simultâneo.'
	}
	if (tarefasOps?.colheitaNoFim) {
		tarefasOps.colheitaFrequenciaHoras = null
	}
	return null
}

export async function listarPlanos(view) {
	if (view === 'select') {
		return PlanoCultivo.find()
			.select('nome tipo ervaId')
			.sort({ createdAt: -1 })
	}

	return PlanoCultivo.find()
		.populate('ervaId', 'nome')
		.sort({ createdAt: -1 })
}

export async function criarPlano(body, user) {
	const erroValidacao = validarTarefasOperacionais(body)
	if (erroValidacao) {
		return { status: 400, payload: { success: false, message: erroValidacao } }
	}

	const novoPlano = await PlanoCultivo.create(body)

	await LogAuditoria.create({
		utilizadorId: user._id,
		acao: 'CRIAR_PLANO_CULTIVO',
		entidade: 'PlanoCultivo',
		entidadeId: novoPlano._id,
		detalhes: { tipo: novoPlano.tipo, ervaId: novoPlano.ervaId }
	})

	return { status: 201, payload: { success: true, data: novoPlano } }
}

export async function atualizarPlano(planoId, body, user) {
	const erroValidacao = validarTarefasOperacionais(body)
	if (erroValidacao) {
		return { status: 400, payload: { success: false, message: erroValidacao } }
	}

	const planoAtualizado = await PlanoCultivo.findByIdAndUpdate(planoId, body, { returnDocument: 'after', runValidators: true })

	if (!planoAtualizado) {
		return { status: 404, payload: { success: false, message: 'Plano não encontrado.' } }
	}

	if (planoAtualizado.tarefasOperacionais?.colheitaNoFim) {
		const lotesAtivos = await LoteCultivo.find({ planoId: planoAtualizado._id, estado: 'ativo' })
			.select('_id planoId estado dataInicio')

		for (const lote of lotesAtivos) {
			await Tarefa.deleteMany({ loteId: lote._id, tipo: 'colheita', estado: 'Pendente' })
			await gerarTarefasAutomaticas(lote)
		}
	}

	await LogAuditoria.create({
		utilizadorId: user._id,
		acao: 'ATUALIZAR_PLANO_CULTIVO',
		entidade: 'PlanoCultivo',
		entidadeId: planoAtualizado._id,
		detalhes: body
	})

	return { status: 200, payload: { success: true, data: planoAtualizado } }
}
