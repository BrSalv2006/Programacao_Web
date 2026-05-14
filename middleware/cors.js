const cors = (req, res, next) => {
	const origin = req.headers.origin

	if (origin) {
		res.setHeader('Access-Control-Allow-Origin', origin)
	} else {
		res.setHeader('Access-Control-Allow-Origin', '*')
	}

	res.setHeader('Access-Control-Allow-Credentials', 'true')
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

	if (req.method === 'OPTIONS') {
		return res.status(204).end()
	}

	next()
}

export default cors
