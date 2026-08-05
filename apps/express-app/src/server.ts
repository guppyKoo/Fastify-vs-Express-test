import 'dotenv/config'
import express from 'express'
import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'
import { connectDb } from './db.js'
import { usersRouter } from './routes/users.js'

const PORT = Number(process.env.PORT ?? 3001)
const FAKE_DB_DELAY_MS = 30

const app = express()
app.use(express.json())

app.get('/hello', (_req, res) => {
  res.json({ hello: 'world' })
})

app.get('/delayed', async (_req, res) => {
  await new Promise((resolve) => setTimeout(resolve, FAKE_DB_DELAY_MS))
  res.json({ hello: 'world' })
})

app.use(usersRouter)

const openapiSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'express-app', version: '1.0.0' },
  },
  apis: ['apps/express-app/src/routes/*.ts'],
})
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec))

app.use(
  (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ message: 'Internal Server Error', error: err.message })
  },
)

await connectDb()
app.listen(PORT, () => {
  console.log(`express-app listening on :${PORT}`)
})
