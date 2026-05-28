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

function podeAutorizarPontual(user) {
	return ['Administrador', 'Responsável'].includes(user?.role)
}

function filtroPlanosSelect() {
	return {
		$or: [
			{ tipo: { $ne: 'pontual' } },
			{
				tipo: 'pontual',
				autorizadoPor: { $exists: true, $ne: null },
				dataAutorizacao: { $exists: true, $ne: null }
			}
		]
	}
}

function limparCamposAutorizacao(payload) {
	delete payload.autorizadoPor
	delete payload.dataAutorizacao
	delete payload.autorizarPontual
}

function prepararAutorizacaoCriacao(payload, user) {
	if (payload.tipo !== 'pontual') {
		limparCamposAutorizacao(payload)
		return { autorizacaoAplicada: false }
	}

	if (!podeAutorizarPontual(user)) {
		limparCamposAutorizacao(payload)
		return { autorizacaoAplicada: false }
	}

	payload.autorizadoPor = user._id
	payload.dataAutorizacao = new Date()
	delete payload.autorizarPontual
	return { autorizacaoAplicada: true }
}

function prepararAutorizacaoAtualizacao(payload, user, planoExistente) {
	const tipoAtual = payload.tipo || planoExistente?.tipo
	if (tipoAtual !== 'pontual') {
		limparCamposAutorizacao(payload)
		return { autorizacaoAplicada: false }
	}

	const solicitouAutorizacao = Boolean(payload.autorizarPontual)
	if (solicitouAutorizacao && !podeAutorizarPontual(user)) {
		return {
			erro: {
				status: 403,
				payload: { success: false, message: 'Apenas responsáveis e administradores podem autorizar planos pontuais.' }
			}
		}
	}

	limparCamposAutorizacao(payload)

	let autorizacaoAplicada = false
	if (solicitouAutorizacao && podeAutorizarPontual(user)) {
		payload.autorizadoPor = user._id
		payload.dataAutorizacao = new Date()
		autorizacaoAplicada = true
	}

	return { autorizacaoAplicada }
}

export async function listarPlanos(view) {
	if (view === 'select') {
		return PlanoCultivo.find(filtroPlanosSelect())
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

	const payload = { ...body }
	const autorizacao = prepararAutorizacaoCriacao(payload, user)

	const novoPlano = await PlanoCultivo.create(payload)

	await LogAuditoria.create({
		utilizadorId: user._id,
		acao: 'CRIAR_PLANO_CULTIVO',
		entidade: 'PlanoCultivo',
		entidadeId: novoPlano._id,
		detalhes: { tipo: novoPlano.tipo, ervaId: novoPlano.ervaId, autorizadoPontual: autorizacao.autorizacaoAplicada }
	})

	return { status: 201, payload: { success: true, data: novoPlano } }
}

export async function atualizarPlano(planoId, body, user) {
	const erroValidacao = validarTarefasOperacionais(body)
	if (erroValidacao) {
		return { status: 400, payload: { success: false, message: erroValidacao } }
	}

	const planoExistente = await PlanoCultivo.findById(planoId)
	if (!planoExistente) {
		return { status: 404, payload: { success: false, message: 'Plano não encontrado.' } }
	}

	const payload = { ...body }
	const autorizacao = prepararAutorizacaoAtualizacao(payload, user, planoExistente)
	if (autorizacao.erro) {
		return autorizacao.erro
	}

	const planoAtualizado = await PlanoCultivo.findByIdAndUpdate(planoId, payload, { returnDocument: 'after', runValidators: true })

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
		detalhes: { ...body, autorizadoPontual: autorizacao.autorizacaoAplicada }
	})

	return { status: 200, payload: { success: true, data: planoAtualizado } }
}

export async function aprovarPlanoPontual(planoId, user) {
	if (!podeAutorizarPontual(user)) {
		return { status: 403, payload: { success: false, message: 'Apenas responsáveis e administradores podem autorizar planos pontuais.' } }
	}

	const plano = await PlanoCultivo.findById(planoId)
	if (!plano) {
		return { status: 404, payload: { success: false, message: 'Plano não encontrado.' } }
	}

	if (plano.tipo !== 'pontual') {
		return { status: 400, payload: { success: false, message: 'Apenas planos pontuais podem ser autorizados.' } }
	}

	const jaAutorizado = Boolean(plano.autorizadoPor && plano.dataAutorizacao)
	if (!jaAutorizado) {
		plano.autorizadoPor = user._id
		plano.dataAutorizacao = new Date()
		await plano.save()

		await LogAuditoria.create({
			utilizadorId: user._id,
			acao: 'AUTORIZAR_PLANO_PONTUAL',
			entidade: 'PlanoCultivo',
			entidadeId: plano._id,
			detalhes: { tipo: plano.tipo, ervaId: plano.ervaId }
		})
	}

	return { status: 200, payload: { success: true, data: plano } }
}
