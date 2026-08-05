import { spawn, type ChildProcess } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import autocannon from 'autocannon'

const WARMUP_SECONDS = 5
const DURATION_SECONDS = 15
const REPETITIONS = 3
const READY_TIMEOUT_MS = 60_000
const READY_POLL_INTERVAL_MS = 500
const KILL_GRACE_MS = 5_000
const RESULTS_DIR = 'bench/results'

// 공유 dev Atlas 클러스터 보호: DB를 타는 스테이지는 동시성을 낮게 유지한다
const LOCAL_CONNECTIONS = 100
const DB_CONNECTIONS = 25

interface Stage {
  key: string
  path: string
  connections: number
}

interface RunStats {
  reqPerSec: number
  latencyP50: number
  latencyP97_5: number
  latencyP99: number
  non2xx: number
}

interface StageResult {
  framework: string
  stage: string
  path: string
  connections: number
  runs: RunStats[]
  median: RunStats
}

const BASE_STAGES: Stage[] = [
  { key: 'A-hello', path: '/hello', connections: LOCAL_CONNECTIONS },
  { key: 'B-delayed', path: '/delayed', connections: LOCAL_CONNECTIONS },
  { key: 'C-users-db', path: '/users', connections: DB_CONNECTIONS },
]

const SERVERS = [
  {
    framework: 'express',
    entry: 'apps/express-app/src/server.ts',
    port: 3001,
    extraStages: [] as Stage[],
  },
  {
    framework: 'fastify',
    entry: 'apps/fastify-app/src/server.ts',
    port: 3002,
    // 실험 2 대조군: 응답 스키마 없는 동일 쿼리 라우트
    extraStages: [
      { key: 'C2-users-noschema', path: '/users-noschema', connections: DB_CONNECTIONS },
    ],
  },
]

function startServer(entry: string, port: number): ChildProcess {
  return spawn('node_modules/.bin/tsx', [entry], {
    env: { ...process.env, PORT: String(port), NODE_ENV: 'production' },
    stdio: 'ignore',
  })
}

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
  throw new Error(`server on :${port} did not become ready within ${READY_TIMEOUT_MS}ms`)
}

async function stopServer(proc: ChildProcess): Promise<void> {
  if (proc.exitCode !== null) return
  proc.kill('SIGTERM')
  await new Promise<void>((resolve) => {
    const killTimer = setTimeout(() => {
      proc.kill('SIGKILL')
      resolve()
    }, KILL_GRACE_MS)
    proc.once('exit', () => {
      clearTimeout(killTimer)
      resolve()
    })
  })
}

function toRunStats(result: autocannon.Result): RunStats {
  return {
    reqPerSec: result.requests.average,
    latencyP50: result.latency.p50,
    latencyP97_5: result.latency.p97_5,
    latencyP99: result.latency.p99,
    non2xx: result.non2xx,
  }
}

function medianRun(runs: RunStats[]): RunStats {
  const sorted = [...runs].sort((a, b) => a.reqPerSec - b.reqPerSec)
  const median = sorted[Math.floor(sorted.length / 2)]
  if (!median) throw new Error('no runs recorded')
  return median
}

function toMarkdown(results: StageResult[]): string {
  const header =
    '| framework | stage | conn | req/s (median) | p50 ms | p97.5 ms | p99 ms | non-2xx |\n' +
    '|---|---|---|---|---|---|---|---|\n'
  const rows = results
    .map(
      (r) =>
        `| ${r.framework} | ${r.stage} | ${r.connections} | ${r.median.reqPerSec.toFixed(0)} | ` +
        `${r.median.latencyP50} | ${r.median.latencyP97_5} | ${r.median.latencyP99} | ${r.median.non2xx} |`,
    )
    .join('\n')
  return header + rows + '\n'
}

const allResults: StageResult[] = []

for (const server of SERVERS) {
  console.log(`\n=== ${server.framework} (:${server.port}) ===`)
  const proc = startServer(server.entry, server.port)
  try {
    await waitForReady(server.port)
    for (const stage of [...BASE_STAGES, ...server.extraStages]) {
      const url = `http://127.0.0.1:${server.port}${stage.path}`
      console.log(`[${server.framework}] ${stage.key} — warmup ${WARMUP_SECONDS}s`)
      await autocannon({ url, connections: stage.connections, duration: WARMUP_SECONDS })

      const runs: RunStats[] = []
      for (let rep = 1; rep <= REPETITIONS; rep += 1) {
        const result = await autocannon({
          url,
          connections: stage.connections,
          duration: DURATION_SECONDS,
        })
        const stats = toRunStats(result)
        runs.push(stats)
        console.log(
          `[${server.framework}] ${stage.key} run ${rep}/${REPETITIONS}: ` +
            `${stats.reqPerSec.toFixed(0)} req/s, p50 ${stats.latencyP50}ms, p99 ${stats.latencyP99}ms, non2xx ${stats.non2xx}`,
        )
      }

      allResults.push({
        framework: server.framework,
        stage: stage.key,
        path: stage.path,
        connections: stage.connections,
        runs,
        median: medianRun(runs),
      })
    }
  } finally {
    await stopServer(proc)
  }
}

await mkdir(RESULTS_DIR, { recursive: true })
const summary = {
  generatedAt: new Date().toISOString(),
  config: {
    warmupSeconds: WARMUP_SECONDS,
    durationSeconds: DURATION_SECONDS,
    repetitions: REPETITIONS,
    node: process.version,
  },
  results: allResults,
}
await writeFile(path.join(RESULTS_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
await writeFile(path.join(RESULTS_DIR, 'summary.md'), toMarkdown(allResults))

console.log(`\n${toMarkdown(allResults)}`)
console.log(`results written to ${RESULTS_DIR}/summary.{json,md}`)
