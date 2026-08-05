import 'dotenv/config'
import mongoose from 'mongoose'
import { BENCH_COLLECTION } from './user.model.js'

const MONGO_DB_HOST = process.env.MONGO_DB_HOST
const BENCH_DB_NAME = process.env.BENCH_DB_NAME ?? 'fastify_bench'
const MONGO_UNAUTHORIZED_CODE = 13
const SERVER_SELECTION_TIMEOUT_MS = 10_000

export async function connectDb(): Promise<void> {
  if (!MONGO_DB_HOST) {
    throw new Error('MONGO_DB_HOST is not set — copy .env.example to .env first')
  }

  await mongoose.connect(MONGO_DB_HOST, {
    dbName: BENCH_DB_NAME,
    serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
  })

  try {
    await mongoose.connection.db
      ?.collection(BENCH_COLLECTION)
      .findOne({}, { projection: { _id: 1 } })
  } catch (err) {
    if (!isUnauthorized(err)) throw err
    // dev cluster account may be scoped to the URI's default db — the bench collection is zz_-prefixed there
    await mongoose.disconnect()
    await mongoose.connect(MONGO_DB_HOST, {
      serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
    })
  }
}

function isUnauthorized(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === MONGO_UNAUTHORIZED_CODE
  )
}
