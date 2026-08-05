import { Router } from 'express'
import { z } from 'zod'
import { User } from '../user.model.js'

// 이 파일은 실무에서 흔한 Express 코드 패턴을 그대로 재현한다 (실험 3의 비교 대상).
// 검증(zod)은 갖췄지만, 응답 직렬화와 저장 경계는 개발자의 습관에 맡겨져 있다.

export const usersRouter = Router()

const MAX_LIST_SIZE = 100
const SERVER_GENERATED_HASH = 'server-generated-hash'

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string(),
  age: z.number().min(0),
})

/**
 * @openapi
 * /users:
 *   get:
 *     summary: List users
 *     responses:
 *       200:
 *         description: Up to 100 users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   name: { type: string }
 *                   email: { type: string }
 *                   age: { type: number }
 *                   createdAt: { type: string, format: date-time }
 */
usersRouter.get('/users', async (_req, res) => {
  const users = await User.find().limit(MAX_LIST_SIZE)
  res.json(users)
})

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Get a user by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: A user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 name: { type: string }
 *                 email: { type: string }
 *                 age: { type: number }
 *                 createdAt: { type: string, format: date-time }
 *       404:
 *         description: Not found
 */
usersRouter.get('/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id)
  if (!user) {
    res.status(404).json({ message: 'User not found' })
    return
  }
  res.json(user)
})

/**
 * @openapi
 * /users:
 *   post:
 *     summary: Create a user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, age]
 *             properties:
 *               name: { type: string, minLength: 1 }
 *               email: { type: string }
 *               age: { type: number, minimum: 0 }
 *     responses:
 *       201:
 *         description: Created user
 *       400:
 *         description: Invalid body
 */
usersRouter.post('/users', async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid body', issues: parsed.error.issues })
    return
  }
  const user = await User.create({ ...req.body, passwordHash: SERVER_GENERATED_HASH })
  res.status(201).json(user)
})
