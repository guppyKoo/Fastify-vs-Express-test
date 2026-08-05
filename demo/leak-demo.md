# 실험 3 — 필드 유출 라이브 데모 대본

> 사전 준비: `pnpm seed` 후 두 서버 기동
> `pnpm dev:express` (:3001) / `pnpm dev:fastify` (:3002)

## 1. 목록에서 아무 유저 id 하나 집기

```bash
curl -s http://127.0.0.1:3002/users | head -c 200
```

## 2. 같은 유저를 양쪽에서 조회 — 핵심 장면

```bash
ID=<위에서 복사한 id>
curl -s http://127.0.0.1:3001/users/$ID   # Express
curl -s http://127.0.0.1:3002/users/$ID   # Fastify
```

실측 결과 (동일한 라우트 코드 — `findById` 후 그대로 리턴):

```jsonc
// Express — passwordHash, internalMemo, __v 전부 노출
{"_id":"...","name":"Bench User 8","email":"bench-user-8@example.com","age":28,
 "passwordHash":"synthetic-bcrypt-hash-8-never-a-real-secret",
 "internalMemo":"synthetic internal memo 8 — must never leave the server",
 "createdAt":"...","updatedAt":"...","__v":0,"id":"..."}

// Fastify — 응답 스키마에 선언된 5개 필드만
{"id":"...","name":"Bench User 8","email":"bench-user-8@example.com","age":28,"createdAt":"..."}
```

**멘트**: "코드는 같은 실수를 하고 있습니다. 차이는 실수를 막는 층이 라우트 정의에 내장돼 있느냐입니다."

## 3. 보너스 A — mass assignment

```bash
curl -s -X POST http://127.0.0.1:3001/users -H 'content-type: application/json' \
  -d '{"name":"Demo","email":"inject@example.com","age":30,"internalMemo":"INJECTED BY CLIENT"}'
```

- Express: 201 — `internalMemo`가 **DB에 저장되고 응답으로 그대로 돌아온다** (zod 검증이 있어도, 검증 후 원본 body를 저장하는 흔한 실수)
- Fastify: 같은 요청에서 `additionalProperties: false` 스키마가 경계에서 필드를 제거/거부

## 4. 보너스 B — 타입 검증

```bash
curl -s -X POST http://127.0.0.1:3002/users -H 'content-type: application/json' \
  -d '{"name":"Demo","email":"demo@example.com","age":"스물셋"}'
```

- 양쪽 모두 400 (Express는 zod를 **붙였기 때문에**). 정직한 포인트: Express도 검증은 가능하다.
  차이는 "라우트마다 미들웨어를 기억해서 붙이는 구조" vs "라우트 정의가 스키마를 요구하는 구조".

## 5. 같은 계약 테스트를 양쪽에 돌리면

```bash
pnpm test
```

실측: Fastify 4/4 통과, Express 3개 실패 (GET/POST 응답 유출 + mass assignment 저장).
**실패한 테스트가 이 실험의 결과물이다.**
