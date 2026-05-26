import Users from '../models/user.js'
import LogAuditoria from '../models/logAuditoria.js'
import { csvLine } from './csvUtils.js'

export async function listarUsers() {
	return Users.find().sort({ createdAt: -1 })
}

export async function atualizarRoleUser(userId, role, user) {
	const userAtualizado = await Users.findByIdAndUpdate(userId, { role }, { returnDocument: 'after' })
	if (!userAtualizado) {
		return { status: 404, payload: { success: false, message: 'User não encontrado.' } }
	}

	await LogAuditoria.create({
		utilizadorId: user._id,
		acao: 'ATUALIZAR_PERFIL_UTILIZADOR',
		entidade: 'User',
		entidadeId: userAtualizado._id,
		detalhes: { role: userAtualizado.role }
	})

	return { status: 200, payload: { success: true, data: userAtualizado, message: 'Perfil atualizado.' } }
}

export async function listarLogs() {
	return LogAuditoria.find().populate('utilizadorId', 'name email').sort({ createdAt: -1 }).limit(200)
}

export async function gerarLogsCsv({ acao, entidade } = {}) {
	let query = {}

	if (acao) query.acao = { $regex: acao, $options: 'i' }
	if (entidade) query.entidade = entidade

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

		linhas.push(csvLine([
			date,
			user,
			log.acao || '',
			log.entidade || '',
			detalhesText
		]))
	})

	return '\uFEFF' + linhas.join('\n')
}
