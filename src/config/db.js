import mongoose from 'mongoose'

export async function connectDB() {
	try {
		await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.DB_NAME })
		console.log('Connected to MongoDB.')
	} catch (error) {
		console.error('Failed to connect to MongoDB:', error.message)
		process.exit(1)
	}
}

export async function disconnectDB() {
	console.log('Shutting down gracefully...')
	try {
		await mongoose.connection.close()
		console.log('MongoDB connection closed.')
		process.exit(0)
	} catch (error) {
		console.error('Error during shutdown:', error.message)
		process.exit(1)
	}
}
