import mongoose from 'mongoose'

const schema = new mongoose.Schema({
	loteId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'LoteCultivo',
		required: [true, 'O lote é obrigatório']
	},
	tipo: {
		type: String,
		enum: ['rega', 'fertilização', 'colheita', 'monitorização', 'outro'],
		required: [true, 'O tipo de tarefa é obrigatório']
	},
	estado: {
		type: String,
		enum: ['Pendente', 'Executada', 'Expirada', 'Anulada'],
		default: 'Pendente'
	},
	dataAgendada: {
		type: Date,
		required: [true, 'A data agendada é obrigatória']
	},
	dataExecucao: {
		type: Date
	},
	responsavelId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User'
	}
}, { timestamps: true })

export default mongoose.model('Tarefa', schema)
