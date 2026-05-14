import mongoose from 'mongoose'

const schema = new mongoose.Schema({
	loteId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'LoteCultivo',
		required: [true, 'O lote é obrigatório']
	},
	medicaoId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'MedicaoAmbiental'
	},
	nivel: {
		type: String,
		enum: ['Informativo', 'Aviso', 'Crítico'],
		required: [true, 'O nível de alerta é obrigatório']
	},
	tipo: {
		type: String,
		required: [true, 'O tipo ou descrição do alerta é obrigatório']
	},
	estado: {
		type: String,
		enum: ['Pendente', 'Resolvido', 'Ignorado'],
		default: 'Pendente'
	},
	justificacao: {
		type: String,
		required: function () { return this.estado === 'Ignorado' }
	}
}, { timestamps: true })

export default mongoose.model('Alerta', schema)
