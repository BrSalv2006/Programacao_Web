import express from 'express'

// Middleware
import auth from '../middleware/auth.js'
import requireRole from '../middleware/requireRole.js'

const router = express.Router()

router.get('/', (req, res) => {
	res.redirect('/login/')
})

// Public
router.use(express.static('static/shared'))
router.use(express.static('static/public'))

// Private
router.use(auth)
router.use('/dashboard', express.static('static/private/dashboard'))
router.use(requireRole('Técnico', 'Responsável', 'Administrador'), express.static('static/private'))

// Admin
router.use('/admin', requireRole('Administrador'), express.static('static/admin'))

export default router
