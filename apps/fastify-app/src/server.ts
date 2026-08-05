import 'dotenv/config'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import Fastify from 'fastify'
import { connectDb } from './db.js'
import { usersRoutes } from './routes/users.js'

const PORT = Number(process.env.PORT ?? 3002)
const FAKE_DB_DELAY_MS = 30

const app = Fastify({ logger: false }).withTypeProvider<TypeBoxTypeProvider>()

await app.register(swagger, {
  openapi: { info: { title: 'fastify-app', version: '1.0.0' } },
})
await app.register(swaggerUi, { routePrefix: '/docs' })

app.get('/hello', async () => ({ hello: 'world' }))

app.get('/delayed', async () => {
  await new Promise((resolve) => setTimeout(resolve, FAKE_DB_DELAY_MS))
  return { hello: 'world' }
})

await app.register(usersRoutes)

await connectDb()
await app.listen({ port: PORT })
console.log(`fastify-app listening on :${PORT}`)
