import jwt from 'jsonwebtoken'
import User from '../models/user.js'

const auth = async (req, res, next) => {
	const accessToken = req.cookies?.access || req.headers.authorization?.replace(/^Bearer /, '')

	if (!accessToken) {
		return res.status(401).json({ success: false, message: 'Acesso negado. Nenhum token fornecido.' })
	}

	try {
		const decoded = jwt.decode(accessToken, { complete: true })
		const kid = decoded?.header?.kid
		const accessSecret = process.env[`JWT_ACCESS_SECRET_${kid}`]

		if (!accessSecret) {
			return res.status(401).json({ success: false, message: 'Versão da chave do token inválida.' })
		}

		const payload = jwt.verify(accessToken, accessSecret, {
			algorithms: ['HS256'],
			issuer: 'greenherb-api',
			audience: 'greenherb-client'
		})

		const user = await User.findById(payload.sub).select('-password -refreshTokens').lean()
		if (!user) {
			return res.status(401).json({ success: false, message: 'Utilizador não encontrado.' })
		}

		req.user = user
		next()
	} catch (_error) {
		return res.status(401).json({ success: false, message: 'Token inválido ou expirado.' })
	}
}

export default auth
