| framework | stage | conn | req/s (median) | p50 ms | p97.5 ms | p99 ms | non-2xx |
|---|---|---|---|---|---|---|---|
| express | A-hello | 100 | 15406 | 5 | 13 | 15 | 0 |
| express | B-delayed | 100 | 2983 | 33 | 38 | 41 | 0 |
| express | C-users-db | 25 | 387 | 56 | 128 | 156 | 0 |
| fastify | A-hello | 100 | 56879 | 1 | 4 | 4 | 0 |
| fastify | B-delayed | 100 | 3150 | 31 | 34 | 36 | 0 |
| fastify | C-users-db | 25 | 436 | 51 | 96 | 169 | 0 |
| fastify | C2-users-noschema | 25 | 442 | 54 | 85 | 101 | 0 |
