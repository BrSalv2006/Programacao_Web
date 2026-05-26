const errorHandler = (error, req, res, next) => {
	void next
	const isProduction = process.env.NODE_ENV === 'production'

	if (error.name === 'ValidationError') {
		const messages = Object.values(error.errors).map(val => val.message)
		return res.status(400).json({ success: false, message: 'Erro de validação', details: messages })
	}

	if (error.code === 11000) {
		const duplicatedField = Object.keys(error.keyValue)[0]
		return res.status(409).json({ success: false, message: `O campo ${duplicatedField} já existe.` })
	}

	if (isProduction) {
		console.error(`[ERRO CRÍTICO] ${error.message}`)
	} else {
		console.error(error.stack)
	}

	res.status(500).json({
		success: false,
		message: 'Erro interno do servidor.',
		details: isProduction ? 'Ocorreu um erro inesperado.' : error.message,
		stack: isProduction ? null : error.stack
	})
}

export default errorHandler
