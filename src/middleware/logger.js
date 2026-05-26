const ANSI_RESET = '\x1b[0m'
const ANSI_RED = '\x1b[31m'
const ANSI_YELLOW = '\x1b[33m'
const ANSI_CYAN = '\x1b[36m'
const ANSI_GREEN = '\x1b[32m'
const ANSI_WHITE = '\x1b[37m'

const getStatusCodeColor = (statusCode) => {
	if (statusCode >= 500) {
		return ANSI_RED
	}

	if (statusCode >= 400) {
		return ANSI_YELLOW
	}

	if (statusCode >= 300) {
		return ANSI_CYAN
	}

	if (statusCode >= 200) {
		return ANSI_GREEN
	}

	return ANSI_WHITE
}

const logger = (req, res, next) => {
	res.on('finish', () => {
		const timestamp = new Date().toLocaleString('pt-PT')
		const statusCode = res.statusCode
		const method = req.method
		const url = req.originalUrl
		const statusCodeColor = getStatusCodeColor(statusCode)

		console.log(`[${timestamp}] ${statusCodeColor}${statusCode}${ANSI_RESET} ${method} - ${url}`)
	})

	next()
}

export default logger
