import { BENCH_COLLECTION, connectWithFallback } from './db.js'

const mongoose = await connectWithFallback()
const db = mongoose.connection.db
if (!db) throw new Error('mongoose connection has no db handle')

const collection = db.collection(BENCH_COLLECTION)
const count = await collection.countDocuments()
await collection.drop().catch((err: unknown) => {
  if ((err as { codeName?: string }).codeName === 'NamespaceNotFound') return
  throw err
})

console.log(`dropped '${mongoose.connection.name}.${BENCH_COLLECTION}' (${count} docs removed)`)
await mongoose.disconnect()
