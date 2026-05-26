import mongoose from 'mongoose'
import argon2 from 'argon2'

const schema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, 'O nome é obrigatório'],
		trim: true
	},
	email: {
		type: String,
		required: [true, 'O e-mail é obrigatório'],
		unique: true,
		lowercase: true,
		trim: true,
		match: [/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/, 'Por favor, introduza um e-mail válido']
	},
	password: {
		type: String,
		required: [true, 'A palavra-passe é obrigatória'],
		match: [/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, 'A palavra-passe deve ter pelo menos 8 caracteres, incluindo uma letra maiúscula, uma minúscula, um número e um símbolo'],
		select: false
	},
	role: {
		type: String,
		enum: ['Pendente', 'Técnico', 'Responsável', 'Administrador'],
		default: 'Pendente'
	},
	refreshTokens: {
		type: [String],
		default: [],
		select: false
	},
	resetToken: {
		type: String,
		select: false
	},
	resetTokenExpires: {
		type: Date,
		select: false
	}
}, { timestamps: true, validateModifiedOnly: true })

schema.pre('save', async function () {
	if (!this.isModified('password')) {
		return
	}

	this.password = await argon2.hash(this.password)
})

export default mongoose.model('User', schema)
