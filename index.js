import dotenv from 'dotenv'
import express from 'express'
import compression from 'compression'

dotenv.config({ override: true })

// Middleware
import securityHeaders from './src/middleware/securityHeaders.js'
import cors from './src/middleware/cors.js'
import rateLimiter from './src/middleware/rateLimiter.js'
import logger from './src/middleware/logger.js'
import sanitize from './src/middleware/sanitize.js'
import cookieParser from './src/middleware/cookieParser.js'
import errorHandler from './src/middleware/errorHandler.js'

// Config
import { validateEnv } from './src/config/env.js'
import { connectDB, disconnectDB } from './src/config/db.js'

// Routes
import apiRouter from './src/routes/api.js'
import uiRouter from './src/routes/ui.js'

import LoteCultivo from './src/models/loteCultivo.js'
import { gerarTarefasAutomaticas } from './src/services/lotesService.js'

validateEnv()

const app = express()
const PORT = Number.parseInt(process.env.PORT, 10) || 3000

// Middleware
app.disable('x-powered-by')
app.use(securityHeaders)
app.use(cors)
//app.use(rateLimiter)
app.use(compression())
app.use(logger)
app.use(express.json())
app.use(sanitize)
app.use(cookieParser)

// Routes
app.use('/api', apiRouter)
app.use('/', uiRouter)

// Middleware
app.use(errorHandler)

//async function gerarTarefasDiarias() {
//	const lotesAtivos = await LoteCultivo.find({ estado: 'ativo' }).select('_id planoId estado')
//	for (const lote of lotesAtivos) {
//		try {
//			await gerarTarefasAutomaticas(lote)
//		} catch (error) {
//			console.error('Falha ao gerar tarefas diarias:', error.message)
//		}
//	}
//}
//
//function agendarGeracaoDiaria() {
//	const agora = new Date()
//	const proximaMeiaNoite = new Date(agora)
//	proximaMeiaNoite.setHours(24, 0, 0, 0)
//	const msAteMeiaNoite = proximaMeiaNoite.getTime() - agora.getTime()
//
//	setTimeout(async () => {
//		await gerarTarefasDiarias()
//		setInterval(gerarTarefasDiarias, 24 * 60 * 60 * 1000)
//	}, msAteMeiaNoite)
//}

connectDB().then(() => {
	app.listen(PORT, () => {
		console.log(`Server is listening on port ${PORT}.`)
		console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
		//gerarTarefasDiarias().catch(error => console.error('Falha ao gerar tarefas diarias:', error.message))
		//agendarGeracaoDiaria()
	})
}).catch((error) => {
	console.error('Erro crítico ao iniciar a aplicação:', error)
	process.exit(1)
})

process.on('SIGINT', disconnectDB)
process.on('SIGTERM', disconnectDB)
