import express from 'express'
import jwt from 'jsonwebtoken'
import argon2 from 'argon2'
import crypto from 'crypto'
import Users from '../models/user.js'
import auth from '../middleware/auth.js'
import asyncHandler from '../middleware/asyncHandler.js'

const router = express.Router()

router.get('/me', auth, (req, res) => {
	res.status(200).json({ success: true, data: req.user })
})

function generateTokens(user) {
	const payload = { sub: user.id }
	const kid = process.env.ACTIVE_KEY_ID
	const accessSecret = process.env[`JWT_ACCESS_SECRET_${kid}`]
	const refreshSecret = process.env[`JWT_REFRESH_SECRET_${kid}`]

	const access = jwt.sign(payload, accessSecret, {
		keyid: kid,
		algorithm: 'HS256',
		expiresIn: '15m',
		issuer: 'greenherb-api',
		audience: 'greenherb-client'
	})

	const refresh = jwt.sign(payload, refreshSecret, {
		keyid: kid,
		algorithm: 'HS256',
		expiresIn: '7d',
		issuer: 'greenherb-api',
		audience: 'greenherb-client'
	})

	return { access, refresh }
}

router.post('/register', asyncHandler(async (req, res) => {
	const { name, email, password, confirmPassword } = req.body

	if (password !== confirmPassword) {
		return res.status(400).json({ success: false, message: 'As palavras-passe não coincidem.' })
	}

	try {
		const user = await Users.create({ email, password, name })
		const userResponse = user.toObject()
		delete userResponse.password
		delete userResponse.refreshTokens
		res.status(201).json({ success: true, data: userResponse })
	} catch (error) {
		if (error.code === 11000) {
			return res.status(409).json({ success: false, message: 'Esta conta já está registada' })
		}
		throw error // Passa para o asyncHandler se for outro erro
	}
}))

router.post('/login', asyncHandler(async (req, res) => {
	const { email, password } = req.body
	const user = await Users.findOne({ email }).select('+password +refreshTokens')

	if (!user) {
		return res.status(401).json({ success: false, message: 'Credenciais Inválidas.' })
	}

	const isMatch = await argon2.verify(user.password, password)

	if (!isMatch) {
		return res.status(401).json({ success: false, message: 'Credenciais Inválidas.' })
	}

	const tokens = generateTokens(user)
	user.refreshTokens.push(tokens.refresh)
	await user.save()

	const isProduction = process.env.NODE_ENV === 'production'

	res.cookie('access', tokens.access, {
		httpOnly: true,
		secure: isProduction,
		sameSite: isProduction ? 'strict' : 'lax',
		maxAge: 3 * 60 * 60 * 1000,
		path: '/'
	})

	res.cookie('refresh', tokens.refresh, {
		httpOnly: true,
		secure: isProduction,
		sameSite: isProduction ? 'strict' : 'lax',
		maxAge: 7 * 24 * 60 * 60 * 1000,
		path: '/api/auth'
	})

	res.status(200).json({ success: true, message: 'Sessão iniciada com sucesso.' })
}))

router.post('/refresh', asyncHandler(async (req, res) => {
	const refreshToken = req.cookies?.refresh

	if (!refreshToken) {
		return res.status(401).json({ success: false, message: 'Nenhum token de atualização fornecido.' })
	}

	try {
		const decoded = jwt.decode(refreshToken, { complete: true })
		const kid = decoded?.header?.kid
		const refreshSecret = process.env[`JWT_REFRESH_SECRET_${kid}`]

		if (!refreshSecret) {
			return res.status(401).json({ success: false, message: 'Versão do token inválida.' })
		}

		jwt.verify(refreshToken, refreshSecret, {
			algorithms: ['HS256'],
			issuer: 'greenherb-api',
			audience: 'greenherb-client'
		})

		const user = await Users.findOne({ refreshTokens: refreshToken }).select('+refreshTokens')

		if (!user) {
			return res.status(401).json({ success: false, message: 'Token revogado ou inválido.' })
		}

		const tokens = generateTokens(user)
		user.refreshTokens = user.refreshTokens.filter(t => t !== refreshToken)
		user.refreshTokens.push(tokens.refresh)
		await user.save()

		const isProduction = process.env.NODE_ENV === 'production'

		res.cookie('access', tokens.access, {
			httpOnly: true,
			secure: isProduction,
			sameSite: isProduction ? 'strict' : 'lax',
			maxAge: 3 * 60 * 60 * 1000,
			path: '/'
		})

		res.cookie('refresh', tokens.refresh, {
			httpOnly: true,
			secure: isProduction,
			sameSite: isProduction ? 'strict' : 'lax',
			maxAge: 7 * 24 * 60 * 60 * 1000,
			path: '/api/auth',
		})

		res.status(200).json({ success: true, message: 'Tokens atualizados com sucesso.' })
	} catch (error) {
		res.status(401).json({ success: false, message: 'Token de atualização inválido ou expirado.' })
	}
}))

router.post('/logout', asyncHandler(async (req, res) => {
	const refreshToken = req.cookies?.refresh

	if (refreshToken) {
		const user = await Users.findOne({ refreshTokens: refreshToken }).select('+refreshTokens')
		if (user) {
			user.refreshTokens = user.refreshTokens.filter(t => t !== refreshToken)
			await user.save()
		}
	}

	res.clearCookie('access', { path: '/' })
	res.clearCookie('refresh', { path: '/api/auth' })

	res.status(200).json({ success: true, message: 'Sessão terminada com sucesso. Token revogado.' })
}))

router.post('/password/request', asyncHandler(async (req, res) => {
	const { email } = req.body
	const user = await Users.findOne({ email })

	if (!user) {
		return res.status(200).json({ success: true, message: 'E-mail não encontrado' })
	}

	const resetToken = crypto.randomBytes(32).toString('hex')
	user.resetToken = resetToken
	user.resetTokenExpires = Date.now() + 1 * 60 * 60 * 1000
	await user.save()

	const resetUrl = `${process.env.HOSTNAME}/password/reset/?token=${resetToken}&email=${encodeURIComponent(email)}`

	console.log('\n=============================================')
	console.log('🔐 REPOSIÇÃO DE PALAVRA-PASSE: LINK GERADO 🔐')
	console.log(`📧 E-mail: ${email}`)
	console.log(`🔗 Link: ${resetUrl}`)
	console.log('=============================================\n')

	res.status(200).json({ success: true, message: 'Link gerado com sucesso. Verifique a consola do servidor.' })
}))

router.post('/password/reset', asyncHandler(async (req, res) => {
	const { email, token, newPassword } = req.body
	const user = await Users.findOne({ email, resetToken: token, resetTokenExpires: { $gt: Date.now() } }).select('+resetToken +resetTokenExpires')

	if (!user) {
		return res.status(400).json({ success: false, message: 'O link de reposição é inválido ou expirou.' })
	}

	user.password = newPassword
	user.resetToken = undefined
	user.resetTokenExpires = undefined
	await user.save()

	res.status(200).json({ success: true, message: 'Palavra-passe alterada com sucesso.' })
}))

export default router
