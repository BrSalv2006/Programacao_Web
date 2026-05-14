const cookieParser = (req, res, next) => {
	req.cookies = {}

	const cookieHeader = req.headers.cookie

	if (cookieHeader) {
		cookieHeader.split(';').forEach(cookie => {
			const parts = cookie.split('=')
			const name = parts.shift().trim()
			const value = decodeURIComponent(parts.join('=').trim())

			if (name) {
				req.cookies[name] = value
			}
		})
	}

	next()
}

export default cookieParser
