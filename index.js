import dotenv from 'dotenv'
import express from 'express'
import compression from 'compression'
import mongoose from 'mongoose'
import fs from 'fs'
import YAML from 'yaml'
import swaggerUi from 'swagger-ui-express'

dotenv.config({ override: true })

import securityHeaders from './middleware/securityHeaders.js'
import cors from './middleware/cors.js'
import rateLimiter from './middleware/rateLimiter.js'
import logger from './middleware/logger.js'
import sanitize from './middleware/sanitize.js'
import cookieParser from './middleware/cookieParser.js'
import auth from './middleware/auth.js'
import errorHandler from './middleware/errorHandler.js'

import healthRouter from './controllers/health.js'
import authRouter from './controllers/auth.js'
import ervasRouter from './controllers/ervasAromaticas.js'
import planosRouter from './controllers/planosCultivo.js'
import lotesRouter from './controllers/lotesCultivo.js'
import tarefasRouter from './controllers/tarefas.js'
import medicoesRouter from './controllers/medicoes.js'
import adminRouter from './controllers/admin.js'
import requireRole from './middleware/requireRole.js'

const requiredEnv = ['HOSTNAME', 'MONGODB_URI', 'DB_NAME', 'JWT_ACCESS_SECRET_v1', 'JWT_REFRESH_SECRET_v1', 'ACTIVE_KEY_ID']
requiredEnv.forEach(key => {
	if (!process.env[key]) {
		console.error(`FATAL ERROR: Environment variable ${key} is missing.`)
		process.exit(1)
	}
})

const app = express()
const PORT = Number.parseInt(process.env.PORT, 10) || 3000
const file = fs.readFileSync('./openapi.yaml', 'utf8')
const swaggerDocument = YAML.parse(file)

app.disable('x-powered-by')
app.use(securityHeaders)
app.use(cors)
//app.use(rateLimiter)
app.use(compression())
app.use(logger)
app.use(express.json())
app.use(sanitize)
app.use(cookieParser)

app.use('/health', healthRouter)
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))
app.use('/api/auth', authRouter)
app.use(express.static('public'))

app.get('/', (req, res) => {
	res.redirect('/login/')
})

app.use(auth)

app.use('/dashboard', express.static('private/dashboard'))
app.use(requireRole('Técnico', 'Responsável', 'Administrador'))
app.use('/admin', requireRole('Administrador'))
app.use(express.static('private'))

app.use('/api/ervas', ervasRouter)
app.use('/api/planos', planosRouter)
app.use('/api/lotes', lotesRouter)
app.use('/api/tarefas', tarefasRouter)
app.use('/api/medicoes', medicoesRouter)
app.use('/api/admin', requireRole('Administrador'), adminRouter)

app.use(errorHandler)

mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.DB_NAME }).then(() => {
	console.log('Connected to MongoDB.')

	app.listen(PORT, () => {
		console.log(`Server is listening on port ${PORT}.`)
		console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
	})
}).catch((error) => {
	console.error('Failed to connect to MongoDB:', error.message)
})

const gracefulShutdown = async () => {
	console.log('\nShutting down gracefully...')
	try {
		await mongoose.connection.close()
		console.log('MongoDB connection closed.')
		process.exit(0)
	} catch (error) {
		console.error('Error during shutdown:', error.message)
		process.exit(1)
	}
}

process.on('SIGINT', gracefulShutdown)
process.on('SIGTERM', gracefulShutdown)
