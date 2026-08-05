# Express vs Fastify — 도입 설득용 실험 세트

> 목적: "Fastify가 빠르다"를 증명하는 게 아니라, **어떤 조건에서 무엇이 좋아지는지 정직하게 측정**한다.
> 성능 논거는 데이터로 스스로 기각하고, 안전성·유지보수성 논거를 세운다.

## 구조

```
apps/express-app/   # Express 5 + zod + swagger-jsdoc + mongoose  (:3001)
apps/fastify-app/   # Fastify 5 + TypeBox + @fastify/swagger + mongoose  (:3002)
bench/              # autocannon 러너, 시드/정리 스크립트, 결과(JSON/MD)
tests/leak.test.ts  # 두 서버에 동일하게 돌리는 계약 테스트 (실험 3의 증거물)
demo/leak-demo.md   # 라이브 데모 대본
```

두 앱은 **동일한 라우트·동일한 mongoose 모델·동일한 쿼리**를 사용한다. 다른 것은 프레임워크뿐이다.

## 실행법

```bash
cp .env.example .env   # dev Atlas 커넥션 입력 (팀 공유 채널에서)
pnpm install
pnpm seed              # 합성 유저 100건 시드 (zz_fastify_bench_users 컬렉션만 사용)
pnpm dev:express       # :3001
pnpm dev:fastify       # :3002
pnpm test              # 계약 테스트 (Express 실패가 정상 — 아래 참고)
pnpm bench             # 전체 벤치 (~7분, 순차 실행)
pnpm cleanup           # 실험 종료 후 벤치 컬렉션 drop
```

⚠️ 로컬 `localhost:27017`은 실서비스 DB 터널이므로 **어떤 실험에도 사용하지 않는다**. dev Atlas는 공유 자원이라 DB 스테이지 동시성을 25로 제한했다.

---

## 실험 1 — 성능: 차이가 사라지는 지점

autocannon, 워밍업 5초 후 15초 × 3회 **중앙값**, 서버·스테이지별 순차 실행, `NODE_ENV=production`, 로거 off. (M3 Pro / Node v20.19.4, 원자료: `bench/results/summary.json`)

| stage | 조건 | Express | Fastify | 차이 |
|---|---|---|---|---|
| **A** hello world | 순수 프레임워크 오버헤드 | 15,406 req/s | 56,879 req/s | **3.7배** |
| **B** + 30ms 지연 | DB 지연 시뮬레이션 | 2,983 req/s | 3,150 req/s | **+5.6%** |
| **C** + 실제 Atlas 조회 | 100건 목록, 실워크로드 | 387 req/s | 436 req/s | **+12.7%** |

- 인터넷 벤치마크가 재는 것은 **A**다. 우리 서비스는 **C**다.
- 30ms 지연 하나만 넣어도 3.7배가 5.6%로 붕괴한다. 실DB에서 처리량 차이는 한 자릿수~10%대.
- 꼬리 지연은 C에서 p97.5 기준 Express 128ms vs Fastify 96ms (−25%). 단 p99는 Atlas 네트워크 노이즈 범위에서 교차한다 — 과장하지 않는다.

**결론: 우리 워크로드에서 성능은 도입 근거가 아니다.** (그리고 그걸 우리 손으로 측정했다.)

## 실험 2 — 직렬화: 스키마의 성능 이득도 정직하게

| 라우트 | req/s | 응답 크기 |
|---|---|---|
| Fastify `/users` (응답 스키마 有) | 436 | **14.1 KB** |
| Fastify `/users-noschema` (스키마 無) | 442 | 32.7 KB |

fast-json-stringify의 직렬화 이득조차 실DB 지연 앞에서는 **노이즈 수준(±1%)**이다.
남는 실질 이득은 성능이 아니라 **응답 크기 절반**(불필요·민감 필드 제거)과 그로 인한 대역폭이다.
→ 스키마를 선언하는 이유는 성능이 아니라 다음 실험이다.

## 실험 3 — 필드 유출: 이 실험의 하이라이트

동일한 코드(`findById` 후 그대로 리턴)를 양쪽에 두고 같은 유저를 조회하면:

```jsonc
// Express — 흔한 코드가 그대로 사고가 된다
{"_id":"...","name":"Bench User 8", ..., "passwordHash":"synthetic-bcrypt-hash-8-...",
 "internalMemo":"synthetic internal memo 8 — must never leave the server","__v":0}

// Fastify — 같은 실수, 응답 스키마가 경계에서 화이트리스트 적용
{"id":"...","name":"Bench User 8","email":"...","age":28,"createdAt":"..."}
```

같은 계약 테스트(`pnpm test`)를 두 서버에 돌린 결과:

| 계약 | Express | Fastify |
|---|---|---|
| GET 응답에 passwordHash/internalMemo/__v 없음 | ❌ 유출 | ✅ |
| POST 응답에 passwordHash 없음 | ❌ 유출 | ✅ |
| 클라이언트 주입 internalMemo 저장 안 됨 (mass assignment) | ❌ 저장됨 | ✅ |
| age에 문자열 → 400 | ✅ (zod) | ✅ |

정직한 포인트: Express도 zod로 **요청 검증은 된다** (4번째 줄). 차이는 ①응답 방향을 지키는 층이 없다는 것, ②검증이 "라우트마다 기억해서 붙이는 것"이라는 것. **개발자가 실수해도 구조가 막아주는가**가 갈린다. 데모 대본: [demo/leak-demo.md](demo/leak-demo.md)

## 실험 4 — DX: 같은 정보를 몇 곳에 쓰는가

동일 CRUD 3개(목록/단건/생성) 기준:

| 항목 | Express | Fastify |
|---|---|---|
| 라우트+스키마 코드 | **110줄** (routes) | **72줄** (routes 45 + schemas 27) |
| "email은 이메일 형식" 선언 위치 | **2곳** (zod + swagger-jsdoc 주석) | **1곳** (TypeBox) |
| 검증·문서·타입·직렬화의 소스 | 각각 별도 (어긋날 수 있음) | 스키마 하나 |

실제로 "email 형식 검증 추가"를 양쪽에 커밋했다 — `git log`에서 diff로 확인:

```
feat: Express — email 형식 검증 추가   → 1 file, +2/−2 (zod와 swagger 주석 각각)
feat: Fastify — email 형식 검증 추가   → 1 file, +1/−1 (format: 'email' 한 곳)
```

Express에서 둘 중 하나를 잊으면? 검증과 문서가 조용히 어긋난다. 그걸 알려주는 건 아무것도 없다.

---

## 발표 구성 제안

1. **실험 1** — 성능 논거를 우리 손으로 기각: "차이는 실재하지만(A: 3.7배) 우리 워크로드에선 소멸합니다(C: +12.7%)"
2. **실험 3** — 라이브 데모: 같은 코드, 다른 결과. 계약 테스트 화면.
3. **실험 4** — 유지보수 비용: 선언 2곳 vs 1곳, diff 나란히.
4. **실험 2** — "성능은 덤도 안 됩니다. 응답 크기 절반이 남습니다." (정직함으로 마무리)

성능으로 시작해서 성능을 죽이고, 안전성으로 이긴다.
