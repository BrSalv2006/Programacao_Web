import express from 'express'
import auth from '../middleware/auth.js'
import asyncHandler from '../middleware/asyncHandler.js'
import {
	registarUser,
	iniciarSessao,
	atualizarTokens,
	terminarSessao,
	pedirResetPassword,
	resetPassword
} from '../services/authService.js'

const router = express.Router()

router.get('/me', auth, (req, res) => {
	res.status(200).json({ success: true, data: req.user })
})

function aplicarCookies(res, cookies) {
	if (!cookies) return
	for (const cookie of cookies) {
		res.cookie(cookie.name, cookie.value, cookie.options)
	}
}

function limparCookies(res, cookies) {
	if (!cookies) return
	for (const cookie of cookies) {
		res.clearCookie(cookie.name, cookie.options)
	}
}

router.post('/register', asyncHandler(async (req, res) => {
	const resultado = await registarUser(req.body)
	res.status(resultado.status).json(resultado.payload)
}))

router.post('/login', asyncHandler(async (req, res) => {
	const resultado = await iniciarSessao(req.body)
	aplicarCookies(res, resultado.cookies)
	res.status(resultado.status).json(resultado.payload)
}))

router.post('/refresh', asyncHandler(async (req, res) => {
	const resultado = await atualizarTokens(req.cookies?.refresh)
	aplicarCookies(res, resultado.cookies)
	res.status(resultado.status).json(resultado.payload)
}))

router.post('/logout', asyncHandler(async (req, res) => {
	const resultado = await terminarSessao(req.cookies?.refresh)
	limparCookies(res, resultado.clearCookies)
	res.status(resultado.status).json(resultado.payload)
}))

router.post('/password/request', asyncHandler(async (req, res) => {
	const resultado = await pedirResetPassword(req.body.email)
	res.status(resultado.status).json(resultado.payload)
}))

router.post('/password/reset', asyncHandler(async (req, res) => {
	const resultado = await resetPassword(req.body)
	res.status(resultado.status).json(resultado.payload)
}))

export default router
