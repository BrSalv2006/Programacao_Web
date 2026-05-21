const requireRole = (...roles) => {
	return (req, res, next) => {
		const isApiRequest = req.originalUrl.startsWith('/api/')

		if (!req.user) {
			if (!isApiRequest) {
				return res.redirect('/login/')
			}
			return res.status(401).json({ success: false, message: 'Acesso negado. User não autenticado.' })
		}

		if (!roles.includes(req.user.role)) {
			if (!isApiRequest) {
				return res.redirect('/dashboard/')
			}
			return res.status(403).json({ success: false, message: 'Acesso negado. Não tem permissão para realizar esta ação.' })
		}

		next()
	}
}

export default requireRole
