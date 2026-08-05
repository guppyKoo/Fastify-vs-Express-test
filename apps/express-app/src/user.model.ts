import mongoose from 'mongoose'

export const BENCH_COLLECTION = 'zz_fastify_bench_users'

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    age: { type: Number, required: true },
    passwordHash: { type: String, required: true },
    internalMemo: { type: String },
  },
  { timestamps: true, collection: BENCH_COLLECTION },
)

export const User = mongoose.model('User', userSchema)
