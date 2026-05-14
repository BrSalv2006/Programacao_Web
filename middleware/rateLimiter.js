import RateLimits from '../models/rateLimit.js'

const REQUEST_LIMIT = Number.parseInt(process.env.REQUEST_LIMIT, 10) || 100

const getClientIpAddress = (req) => {
	const forwardedFor = req.headers['x-forwarded-for']

	if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
		return forwardedFor.split(',')[0].trim()
	}

	return req.socket.remoteAddress
}

const rateLimiter = async (req, res, next) => {
	const ipAddress = getClientIpAddress(req)

	try {
		let ipAddressRecord = await RateLimits.findOne({ ipAddress })

		if (!ipAddressRecord) {
			await RateLimits.create({ ipAddress, requestCount: 1 })
			return next()
		}

		if (ipAddressRecord.requestCount >= REQUEST_LIMIT) {
			return res.status(429).json({
				success: false,
				message: 'Muitos pedidos deste endereço IP. Por favor, tente novamente mais tarde.'
			})
		}

		ipAddressRecord.requestCount++
		await ipAddressRecord.save()
		next()
	} catch (error) {
		console.error('Erro no Rate Limiter (MongoDB):', error.message)
		next()
	}
}

export default rateLimiter
