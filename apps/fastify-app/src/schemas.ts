import { type Static, Type } from '@sinclair/typebox'

// 단일 소스: 이 스키마 하나가 요청 검증(ajv), 응답 직렬화(fast-json-stringify),
// OpenAPI 문서(@fastify/swagger), TS 타입(Static<>)을 전부 만들어낸다.

export const PublicUser = Type.Object({
  id: Type.String(),
  name: Type.String(),
  email: Type.String(),
  age: Type.Number(),
  createdAt: Type.String({ format: 'date-time' }),
})
export type PublicUserType = Static<typeof PublicUser>

export const ErrorMessage = Type.Object({
  message: Type.String(),
})

export const CreateUserBody = Type.Object(
  {
    name: Type.String({ minLength: 1 }),
    email: Type.String(),
    age: Type.Number({ minimum: 0 }),
  },
  { additionalProperties: false },
)
export type CreateUserBodyType = Static<typeof CreateUserBody>
