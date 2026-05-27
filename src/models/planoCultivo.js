import mongoose from 'mongoose'

const schema = new mongoose.Schema({
	nome: {
		type: String,
		trim: true,
		required: [true, 'O nome do plano é obrigatório']
	},
	tipo: {
		type: String,
		enum: ['regular', 'emergência', 'pontual'],
		required: [true, 'O tipo de plano é obrigatório']
	},
	ervaId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'ErvaAromatica',
		required: [true, 'A erva aromática é obrigatória']
	},
	condicoesIdeais: {
		temperaturaMin: {
			type: Number,
			required: function () { return this.tipo === 'regular' }
		},
		temperaturaMax: {
			type: Number,
			required: function () { return this.tipo === 'regular' }
		},
		humidadeMin: {
			type: Number,
			required: function () { return this.tipo === 'regular' }
		},
		humidadeMax: {
			type: Number,
			required: function () { return this.tipo === 'regular' }
		},
		luminosidadeMin: {
			type: Number,
			required: function () { return this.tipo === 'regular' }
		},
		luminosidadeMax: {
			type: Number,
			required: function () { return this.tipo === 'regular' }
		}
	},
	tarefasOperacionais: {
		tiposPermitidos: {
			type: [String],
			enum: ['rega', 'fertilização', 'colheita', 'monitorização'],
			default: ['rega', 'fertilização', 'colheita', 'monitorização']
		},
		regaFrequenciaHoras: {
			type: Number,
			required: function () { return this.tipo === 'regular' }
		},
		monitorizacaoFrequenciaHoras: { type: Number },
		fertilizacaoFrequenciaHoras: {
			type: Number,
			required: false
		},
		colheitaFrequenciaHoras: {
			type: Number,
			required: false
		},
		colheitaNoFim: {
			type: Boolean,
			default: false
		},
		fertilizacaoDosagem: {
			type: String,
			required: false
		},
		horarioPreferencial: {
			type: String
		}
	},
	planoRega: {
		type: String,
		required: function () { return this.tipo === 'regular' }
	},
	fertilizacao: {
		type: String,
		required: false
	},
	duracaoPrevistaDias: {
		type: Number,
		required: function () { return this.tipo === 'regular' },
		min: [1, 'A duração prevista deve ser no mínimo 1 dia']
	},
	detalhesEmergencia: {
		intervaloMinimoHoras: {
			type: Number,
			required: function () { return this.tipo === 'emergência' }
		},
		tipoIntervencao: {
			type: String,
			required: function () { return this.tipo === 'emergência' }
		},
		dosagemOuIntensidade: {
			type: String,
			required: function () { return this.tipo === 'emergência' }
		}
	},
	finalidadePontual: {
		type: String,
		trim: true,
		required: function () { return this.tipo === 'pontual' }
	},
	autorizadoPor: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User'
	},
	dataAutorizacao: {
		type: Date
	}
}, { timestamps: true })

export default mongoose.model('PlanoCultivo', schema)
