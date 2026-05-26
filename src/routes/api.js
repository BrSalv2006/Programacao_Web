import express from 'express'
import fs from 'fs'
import YAML from 'yaml'
import swaggerUi from 'swagger-ui-express'


// Middleware
import auth from '../middleware/auth.js'
import requireRole from '../middleware/requireRole.js'

// Controllers
import healthRouter from '../controllers/health.js'
import authRouter from '../controllers/auth.js'
import ervasRouter from '../controllers/ervasAromaticas.js'
import planosRouter from '../controllers/planosCultivo.js'
import lotesRouter from '../controllers/lotesCultivo.js'
import tarefasRouter from '../controllers/tarefas.js'
import medicoesRouter from '../controllers/medicoes.js'
import adminRouter from '../controllers/admin.js'

const router = express.Router()
const file = fs.readFileSync('./openapi.yaml', 'utf8')
const swaggerDocument = YAML.parse(file)

// Public
router.use('/health', healthRouter)
router.use('/auth', authRouter)
router.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

// Private
router.use(auth)
router.use(requireRole('Técnico', 'Responsável', 'Administrador'))
router.use('/ervas', ervasRouter)
router.use('/planos', planosRouter)
router.use('/lotes', lotesRouter)
router.use('/tarefas', tarefasRouter)
router.use('/medicoes', medicoesRouter)

// Admin
router.use(requireRole('Administrador'))
router.use('/admin', adminRouter)

export default router
