import { BENCH_COLLECTION, connectWithFallback } from './db.js'

const USER_COUNT = 100
const SEED_EMAIL_PREFIX = 'bench-user-'
const AGE_BASE = 20
const AGE_SPREAD = 40

const mongoose = await connectWithFallback()
const db = mongoose.connection.db
if (!db) throw new Error('mongoose connection has no db handle')

const now = new Date()
const docs = Array.from({ length: USER_COUNT }, (_, i) => ({
  name: `Bench User ${i}`,
  email: `${SEED_EMAIL_PREFIX}${i}@example.com`,
  age: AGE_BASE + (i % AGE_SPREAD),
  passwordHash: `synthetic-bcrypt-hash-${i}-never-a-real-secret`,
  internalMemo: `synthetic internal memo ${i} — must never leave the server`,
  createdAt: now,
  updatedAt: now,
  __v: 0,
}))

const collection = db.collection(BENCH_COLLECTION)
await collection.deleteMany({ email: { $regex: `^${SEED_EMAIL_PREFIX}` } })
await collection.insertMany(docs)

const total = await collection.countDocuments()
console.log(`seeded ${docs.length} users — '${mongoose.connection.name}.${BENCH_COLLECTION}' now holds ${total} docs`)
await mongoose.disconnect()
