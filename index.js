import express from 'express'

const app = express()
const PORT = Number.parseInt(process.env.PORT, 10) || 3000

app.use(express.json())
app.use(express.static('public'))

app.listen(PORT, () => {
	console.log(`Server is listening on port ${PORT}.`)
	console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
})
