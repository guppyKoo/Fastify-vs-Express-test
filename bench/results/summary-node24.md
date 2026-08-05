| framework | stage | conn | req/s (median) | p50 ms | p97.5 ms | p99 ms | non-2xx |
|---|---|---|---|---|---|---|---|
| express | A-hello | 100 | 34555 | 2 | 5 | 6 | 0 |
| express | B-delayed | 100 | 3093 | 32 | 34 | 36 | 0 |
| express | C-users-db | 25 | 467 | 51 | 72 | 81 | 0 |
| fastify | A-hello | 100 | 53761 | 1 | 4 | 4 | 0 |
| fastify | B-delayed | 100 | 3150 | 31 | 33 | 34 | 0 |
| fastify | C-users-db | 25 | 477 | 50 | 72 | 82 | 0 |
| fastify | C2-users-noschema | 25 | 481 | 50 | 71 | 81 | 0 |
