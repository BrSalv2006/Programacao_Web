const requireRole = (...roles) => {
	return (req, res, next) => {
		if (!req.user) {
			return res.status(401).json({ success: false, message: 'Acesso negado. User não autenticado.' })
		}

		if (!roles.includes(req.user.role)) {
			return res.status(403).json({ success: false, message: 'Acesso negado. Não tem permissão para realizar esta ação.' })
		}

		next()
	}
}

export default requireRole
