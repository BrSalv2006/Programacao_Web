import mongoose from 'mongoose'

const schema = new mongoose.Schema({
	nome: {
		type: String,
		required: [true, 'O nome comum da erva aromática é obrigatório'],
		trim: true
	},
	nomeCientifico: {
		type: String,
		required: [true, 'O nome científico é obrigatório'],
		trim: true
	},
	variedade: {
		type: String,
		required: [true, 'A variedade é obrigatória'],
		trim: true
	},
	familia: {
		type: String,
		required: [true, 'A família botânica é obrigatória'],
		trim: true
	},
	cicloDiasFim: {
		type: Number,
		required: [true, 'O número estimado de dias para o ciclo de vida é obrigatório'],
		min: [1, 'O ciclo deve ter pelo menos 1 dia']
	},
	descricao: {
		type: String,
		trim: true
	},
	ativo: {
		type: Boolean,
		default: true
	}
}, { timestamps: true })

schema.index({ nomeCientifico: 1, variedade: 1 }, { unique: true })

export default mongoose.model('ErvaAromatica', schema)
