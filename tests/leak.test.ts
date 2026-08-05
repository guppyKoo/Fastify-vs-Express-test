import { spawn, type ChildProcess } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BENCH_COLLECTION, connectWithFallback } from '../bench/db.js'
import type mongoose from 'mongoose'

// 동일한 계약을 두 프레임워크에 그대로 돌린다.
// Express 쪽 실패는 버그가 아니라 이 실험의 결과물이다 (README 참고).

const READY_TIMEOUT_MS = 60_000
const READY_POLL_INTERVAL_MS = 500
const HOOK_TIMEOUT_MS = 120_000
const TEST_EMAIL_PREFIX = 'contract-test-'

const SERVERS = [
  { framework: 'express', entry: 'apps/express-app/src/server.ts', port: 3101 },
  { framework: 'fastify', entry: 'apps/fastify-app/src/server.ts', port: 3102 },
] as const

const procs: ChildProcess[] = []
let db: typeof mongoose | undefined

async function waitForReady(port: number): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/hello`)
      if (res.ok) return
    } catch {
      // server not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, READY_POLL_INTERVAL_MS))
  }
  throw new Error(`server on :${port} did not become ready`)
}

beforeAll(async () => {
  for (const server of SERVERS) {
    procs.push(
      spawn('node_modules/.bin/tsx', [server.entry], {
        env: { ...process.env, PORT: String(server.port), NODE_ENV: 'test' },
        stdio: 'ignore',
      }),
    )
  }
  await Promise.all(SERVERS.map((server) => waitForReady(server.port)))
  db = await connectWithFallback()
}, HOOK_TIMEOUT_MS)

afterAll(async () => {
  await db?.connection.db
    ?.collection(BENCH_COLLECTION)
    .deleteMany({ email: { $regex: `^${TEST_EMAIL_PREFIX}` } })
  await db?.disconnect()
  for (const proc of procs) proc.kill('SIGTERM')
}, HOOK_TIMEOUT_MS)

describe.each(SERVERS)('$framework — 응답/저장 계약', ({ framework, port }) => {
  const base = `http://127.0.0.1:${port}`

  it('GET /users/:id 응답에 passwordHash · internalMemo · __v 가 없어야 한다', async () => {
    const listRes = await fetch(`${base}/users`)
    expect(listRes.status).toBe(200)
    const list = (await listRes.json()) as Array<Record<string, unknown>>
    expect(list.length).toBeGreaterThan(0)

    const id = (list[0]?.id ?? list[0]?._id) as string
    const user = (await (await fetch(`${base}/users/${id}`)).json()) as Record<string, unknown>

    expect(user).not.toHaveProperty('passwordHash')
    expect(user).not.toHaveProperty('internalMemo')
    expect(user).not.toHaveProperty('__v')
  })

  it('POST /users 응답에 passwordHash 가 없어야 한다', async () => {
    const email = `${TEST_EMAIL_PREFIX}${framework}-resp@example.com`
    const res = await fetch(`${base}/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Contract Tester', email, age: 30 }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as Record<string, unknown>
    expect(body).not.toHaveProperty('passwordHash')
  })

  it('클라이언트가 보낸 internalMemo(mass assignment)가 저장되면 안 된다', async () => {
    const email = `${TEST_EMAIL_PREFIX}${framework}-inject@example.com`
    const res = await fetch(`${base}/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Injector',
        email,
        age: 30,
        internalMemo: 'INJECTED BY CLIENT',
      }),
    })

    const stored = await db?.connection.db?.collection(BENCH_COLLECTION).findOne({ email })
    if (res.status === 201) {
      expect(stored?.internalMemo).toBeUndefined()
    } else {
      expect(res.status).toBe(400)
      expect(stored).toBeNull()
    }
  })

  it('age 에 문자열("스물셋")을 보내면 400 이어야 한다', async () => {
    const email = `${TEST_EMAIL_PREFIX}${framework}-badtype@example.com`
    const res = await fetch(`${base}/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Bad Type', email, age: '스물셋' }),
    })
    expect(res.status).toBe(400)
  })
})
