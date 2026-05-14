import express from 'express'
import mongoose from 'mongoose'

const router = express.Router()

router.get('/', (req, res) => {
	res.status(200).json({
		status: 'OK',
		uptime: process.uptime(),
		db: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
	})
})

export default router
