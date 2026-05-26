import mongoose from 'mongoose'

const schema = new mongoose.Schema({
	ipAddress: {
		type: String,
		required: [true, 'O endereço IP é obrigatório'],
		unique: true
	},
	requestCount: {
		type: Number,
		default: 1
	},
}, { timestamps: true })

schema.index({ createdAt: 1 }, { expireAfterSeconds: 900 })

export default mongoose.model('RateLimit', schema)
