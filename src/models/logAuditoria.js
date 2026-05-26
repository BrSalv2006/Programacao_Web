import mongoose from 'mongoose'

const schema = new mongoose.Schema({
	utilizadorId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: [true, 'O ID do utilizador é obrigatório']
	},
	acao: {
		type: String,
		required: [true, 'A ação realizada é obrigatória']
	},
	entidade: {
		type: String,
		required: [true, 'A entidade afetada é obrigatória']
	},
	entidadeId: {
		type: mongoose.Schema.Types.ObjectId
	},
	detalhes: {
		type: mongoose.Schema.Types.Mixed
	}
}, { timestamps: true })

export default mongoose.model('LogAuditoria', schema)
