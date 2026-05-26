import jwt from 'jsonwebtoken'
import argon2 from 'argon2'
import crypto from 'crypto'
import Users from '../models/user.js'

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

function buildAuthCookies(tokens) {
	const isProduction = process.env.NODE_ENV === 'production'

	return [
		{
			name: 'access',
			value: tokens.access,
			options: {
				httpOnly: true,
				secure: isProduction,
				sameSite: isProduction ? 'strict' : 'lax',
				maxAge: 3 * 60 * 60 * 1000,
				path: '/'
			}
		},
		{
			name: 'refresh',
			value: tokens.refresh,
			options: {
				httpOnly: true,
				secure: isProduction,
				sameSite: isProduction ? 'strict' : 'lax',
				maxAge: 7 * 24 * 60 * 60 * 1000,
				path: '/api/auth'
			}
		}
	]
}

export async function registarUser(body) {
	const { name, email, password, confirmPassword } = body

	if (password !== confirmPassword) {
		return { status: 400, payload: { success: false, message: 'As palavras-passe não coincidem.' } }
	}

	try {
		const user = await Users.create({ email, password, name })
		const userResponse = user.toObject()
		delete userResponse.password
		delete userResponse.refreshTokens
		return { status: 201, payload: { success: true, data: userResponse } }
	} catch (error) {
		if (error.code === 11000) {
			return { status: 409, payload: { success: false, message: 'Esta conta já está registada' } }
		}
		throw error
	}
}

export async function iniciarSessao(body) {
	const { email, password } = body
	const user = await Users.findOne({ email }).select('+password +refreshTokens')

	if (!user) {
		return { status: 401, payload: { success: false, message: 'Credenciais Inválidas.' } }
	}

	const isMatch = await argon2.verify(user.password, password)

	if (!isMatch) {
		return { status: 401, payload: { success: false, message: 'Credenciais Inválidas.' } }
	}

	const tokens = generateTokens(user)
	user.refreshTokens.push(tokens.refresh)
	await user.save()

	return {
		status: 200,
		payload: { success: true, message: 'Sessão iniciada com sucesso.' },
		cookies: buildAuthCookies(tokens)
	}
}

export async function atualizarTokens(refreshToken) {
	if (!refreshToken) {
		return { status: 401, payload: { success: false, message: 'Nenhum token de atualização fornecido.' } }
	}

	try {
		const decoded = jwt.decode(refreshToken, { complete: true })
		const kid = decoded?.header?.kid
		const refreshSecret = process.env[`JWT_REFRESH_SECRET_${kid}`]

		if (!refreshSecret) {
			return { status: 401, payload: { success: false, message: 'Versão do token inválida.' } }
		}

		jwt.verify(refreshToken, refreshSecret, {
			algorithms: ['HS256'],
			issuer: 'greenherb-api',
			audience: 'greenherb-client'
		})

		const user = await Users.findOne({ refreshTokens: refreshToken }).select('+refreshTokens')

		if (!user) {
			return { status: 401, payload: { success: false, message: 'Token revogado ou inválido.' } }
		}

		const tokens = generateTokens(user)
		user.refreshTokens = user.refreshTokens.filter(t => t !== refreshToken)
		user.refreshTokens.push(tokens.refresh)
		await user.save()

		return {
			status: 200,
			payload: { success: true, message: 'Tokens atualizados com sucesso.' },
			cookies: buildAuthCookies(tokens)
		}
	} catch (error) {
		return { status: 401, payload: { success: false, message: 'Token de atualização inválido ou expirado.' } }
	}
}

export async function terminarSessao(refreshToken) {
	if (refreshToken) {
		const user = await Users.findOne({ refreshTokens: refreshToken }).select('+refreshTokens')
		if (user) {
			user.refreshTokens = user.refreshTokens.filter(t => t !== refreshToken)
			await user.save()
		}
	}

	return {
		status: 200,
		payload: { success: true, message: 'Sessão terminada com sucesso. Token revogado.' },
		clearCookies: [
			{ name: 'access', options: { path: '/' } },
			{ name: 'refresh', options: { path: '/api/auth' } }
		]
	}
}

export async function pedirResetPassword(email) {
	const user = await Users.findOne({ email })

	if (!user) {
		return { status: 200, payload: { success: true, message: 'E-mail não encontrado' } }
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

	return { status: 200, payload: { success: true, message: 'Link gerado com sucesso. Verifique a consola do servidor.' } }
}

export async function resetPassword(body) {
	const { email, token, newPassword } = body
	const user = await Users.findOne({ email, resetToken: token, resetTokenExpires: { $gt: Date.now() } }).select('+resetToken +resetTokenExpires')

	if (!user) {
		return { status: 400, payload: { success: false, message: 'O link de reposição é inválido ou expirou.' } }
	}

	user.password = newPassword
	user.resetToken = undefined
	user.resetTokenExpires = undefined
	await user.save()

	return { status: 200, payload: { success: true, message: 'Palavra-passe alterada com sucesso.' } }
}
