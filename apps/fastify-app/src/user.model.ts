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
  // toJSON virtuals: 직렬화 시 `id`(문자열 버추얼) 포함 — fast-json-stringify는 toJSON() 결과를 사용
  { timestamps: true, collection: BENCH_COLLECTION, toJSON: { virtuals: true } },
)

export const User = mongoose.model('User', userSchema)
