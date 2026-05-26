const sanitize = (req, _res, next) => {
	const clean = (input) => {
		if (input instanceof Object) {
			for (const key in input) {
				if (key.startsWith('$') || key.includes('.')) {
					delete input[key]
				} else {
					clean(input[key])
				}
			}
		}
	}

	if (req.body) clean(req.body)
	if (req.query) clean(req.query)
	if (req.params) clean(req.params)

	next()
}

export default sanitize
