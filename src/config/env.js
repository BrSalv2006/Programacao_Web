export function validateEnv() {
	const requiredEnv = [
		'HOSTNAME',
		'MONGODB_URI',
		'DB_NAME',
		'ACTIVE_KEY_ID'
	]

	const missing = requiredEnv.filter(key => !process.env[key])

	if (missing.length > 0) {
		console.error(`FATAL ERROR: Variáveis de ambiente em falta: ${missing.join(', ')}`)
		process.exit(1)
	}

	if (!process.env[`JWT_ACCESS_SECRET_${process.env.ACTIVE_KEY_ID}`] ||
		!process.env[`JWT_REFRESH_SECRET_${process.env.ACTIVE_KEY_ID}`]) {
		console.error(`FATAL ERROR: Segredos JWT em falta para a chave ativa: ${process.env.ACTIVE_KEY_ID}`)
		process.exit(1)
	}
}
