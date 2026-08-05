import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import { CreateUserBody, ErrorMessage, PublicUser, type PublicUserType } from '../schemas.js'
import { User } from '../user.model.js'

// Express 쪽과 같은 "raw mongoose doc을 그대로 리턴하는" 코드지만,
// 라우트에 선언된 응답 스키마가 경계에서 필드를 화이트리스트로 거른다 (실험 3).

const MAX_LIST_SIZE = 100
const SERVER_GENERATED_HASH = 'server-generated-hash'

export const usersRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.get('/users', { schema: { response: { 200: Type.Array(PublicUser) } } }, async () => {
    const users = await User.find().limit(MAX_LIST_SIZE)
    // 런타임 필드 화이트리스트는 응답 스키마(fast-json-stringify)가 수행한다
    return users as unknown as PublicUserType[]
  })

  // 실험 2 대조군: 동일 쿼리를 응답 스키마 없이 리턴 (fast-json-stringify 미발동)
  app.get('/users-noschema', async () => User.find().limit(MAX_LIST_SIZE))

  app.get(
    '/users/:id',
    {
      schema: {
        params: Type.Object({ id: Type.String() }),
        response: { 200: PublicUser, 404: ErrorMessage },
      },
    },
    async (req, reply) => {
      const user = await User.findById(req.params.id)
      if (!user) return reply.code(404).send({ message: 'User not found' })
      return user as unknown as PublicUserType
    },
  )

  app.post(
    '/users',
    { schema: { body: CreateUserBody, response: { 201: PublicUser } } },
    async (req, reply) => {
      const user = await User.create({ ...req.body, passwordHash: SERVER_GENERATED_HASH })
      return reply.code(201).send(user as unknown as PublicUserType)
    },
  )
}
