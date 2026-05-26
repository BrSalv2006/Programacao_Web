import mongoose from 'mongoose'

const schema = new mongoose.Schema({
	nome: {
		type: String,
		required: [true, 'O nome (ou código) do lote é obrigatório']
	},
	ervaId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'ErvaAromatica',
		required: [true, 'A erva aromática é obrigatória']
	},
	planoId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'PlanoCultivo',
		required: [true, 'O plano de cultivo é obrigatório']
	},
	planosAssociados: [{
		type: mongoose.Schema.Types.ObjectId,
		ref: 'PlanoCultivo'
	}],
	historicoPlanos: [{
		planoId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlanoCultivo' },
		dataInicio: { type: Date, default: Date.now },
		dataFim: { type: Date }
	}],
	estado: {
		type: String,
		enum: ['ativo', 'concluído', 'comprometido'],
		default: 'ativo'
	},
	modo: {
		type: String,
		enum: ['Manual', 'Automático'],
		default: 'Manual'
	},
	dataInicio: {
		type: Date,
		default: Date.now
	},
	dataFimReal: {
		type: Date
	},
	quantidadeInicial: {
		type: Number,
		required: [true, 'A quantidade inicial é obrigatória'],
		min: [1, 'A quantidade inicial deve ser no mínimo 1']
	},
	perdas: {
		type: Number,
		default: 0,
		min: [0, 'As perdas não podem ser negativas']
	},
	quantidadeColhida: {
		type: Number,
		default: 0,
		min: [0, 'A quantidade colhida não pode ser negativa']
	},
	loteOrigemId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'LoteCultivo'
	}
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } })

schema.virtual('quantidadeAtual').get(function () {
	if (this.estado === 'concluído') {
		return this.quantidadeColhida || 0
	}
	return Math.max((this.quantidadeInicial || 0) - (this.perdas || 0), 0)
})

schema.virtual('produtividade').get(function () {
	if (!this.quantidadeInicial || this.estado === 'comprometido') {
		return 0
	}
	const producao = this.estado === 'concluído' ? (this.quantidadeColhida || 0) : this.quantidadeAtual
	return Number(((producao / this.quantidadeInicial) * 100).toFixed(2))
})

schema.pre('save', function () {
	const associados = (this.planosAssociados || []).map(id => id.toString())
	if (this.planoId && !associados.includes(this.planoId.toString())) {
		this.planosAssociados = [this.planoId, ...(this.planosAssociados || [])]
	}

	if (this.isModified('planoId')) {
		if (this.historicoPlanos && this.historicoPlanos.length > 0) {
			const atual = this.historicoPlanos[this.historicoPlanos.length - 1]
			if (!atual.dataFim) {
				atual.dataFim = new Date()
			}

			if (atual.planoId.toString() !== this.planoId.toString()) {
				this.historicoPlanos.push({ planoId: this.planoId, dataInicio: new Date() })
			}
		} else {
			this.historicoPlanos = [{ planoId: this.planoId, dataInicio: this.dataInicio || new Date() }]
		}
	} else if (this.isNew && (!this.historicoPlanos || this.historicoPlanos.length === 0)) {
		this.historicoPlanos = [{ planoId: this.planoId, dataInicio: this.dataInicio || new Date() }]
	}
})

export default mongoose.model('LoteCultivo', schema)
