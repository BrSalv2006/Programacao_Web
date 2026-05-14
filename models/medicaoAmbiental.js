import mongoose from 'mongoose'

const schema = new mongoose.Schema({
	loteId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'LoteCultivo',
		required: [true, 'O lote é obrigatório']
	},
	temperatura: {
		type: Number
	},
	humidade: {
		type: Number
	},
	luminosidade: {
		type: Number
	},
	sensorId: {
		type: String,
		trim: true
	},
	falhaSensor: {
		type: Boolean,
		default: false
	},
	observacoes: {
		type: String,
		trim: true
	},
	dataHora: {
		type: Date,
		default: Date.now
	}
}, { timestamps: true })

export default mongoose.model('MedicaoAmbiental', schema)
