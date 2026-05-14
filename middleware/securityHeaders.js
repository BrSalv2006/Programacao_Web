const securityHeaders = (req, res, next) => {
	res.setHeader('Content-Security-Policy', 'default-src \'self\'; script-src \'self\'; style-src \'self\'; img-src \'self\' data:; font-src \'self\'; object-src \'none\'; upgrade-insecure-requests')
	res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
	res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
	res.setHeader('Origin-Agent-Cluster', '?1')
	res.setHeader('Referrer-Policy', 'no-referrer')
	res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
	res.setHeader('X-Content-Type-Options', 'nosniff')
	res.setHeader('X-DNS-Prefetch-Control', 'off')
	res.setHeader('X-Download-Options', 'noopen')
	res.setHeader('X-Frame-Options', 'SAMEORIGIN')
	res.setHeader('X-Permitted-Cross-Domain-Policies', 'none')
	res.setHeader('X-XSS-Protection', '0')

	next()
}

export default securityHeaders
