#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  appendEvent,
  createSession,
  ensureContextDb,
  searchEvents,
} from '../src/contextdb/core.js';

interface BenchOptions {
  workspace?: string;
  events: number;
  refsPool: number;
  queries: number;
  limit: number;
  warmup: number;
  seed: number;
  keepWorkspace: boolean;
  jsonOut?: string;
}

interface BenchScenarioResult {
  name: string;
  queries: number;
  avgMs: number;
  minMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  qps: number;
  hitRate: number;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function parseArgs(argv: string[]): BenchOptions {
  const options: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    i += 1;
  }

  return {
    workspace: typeof options.workspace === 'string' ? path.resolve(options.workspace) : undefined,
    events: parseNumber(typeof options.events === 'string' ? options.events : undefined, 2000),
    refsPool: parseNumber(typeof options['refs-pool'] === 'string' ? options['refs-pool'] : undefined, 200),
    queries: parseNumber(typeof options.queries === 'string' ? options.queries : undefined, 300),
    limit: parseNumber(typeof options.limit === 'string' ? options.limit : undefined, 20),
    warmup: parseNumber(typeof options.warmup === 'string' ? options.warmup : undefined, 30),
    seed: parseNumber(typeof options.seed === 'string' ? options.seed : undefined, 17),
    keepWorkspace: options['keep-workspace'] === true,
    jsonOut: typeof options['json-out'] === 'string' ? path.resolve(options['json-out']) : undefined,
  };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[index];
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundMs(value: number): number {
  return Number(value.toFixed(3));
}

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function buildRefsPool(size: number): string[] {
  const refs: string[] = [];
  for (let i = 0; i < size; i += 1) {
    refs.push(`src/modules/ref-${String(i).padStart(4, '0')}.ts`);
  }
  return refs;
}

async function seedEvents(workspaceRoot: string, events: number, refsPool: string[]): Promise<string> {
  const session = await createSession({
    workspaceRoot,
    agent: 'bench-cli',
    project: 'contextdb-bench',
    goal: 'refs lookup benchmark',
  });

  for (let i = 0; i < events; i += 1) {
    const primaryRef = refsPool[i % refsPool.length];
    const secondaryRef = refsPool[(i * 7 + 3) % refsPool.length];
    const refs = i % 3 === 0 ? [primaryRef, secondaryRef] : [primaryRef];
    await appendEvent({
      workspaceRoot,
      sessionId: session.sessionId,
      role: 'assistant',
      kind: 'response',
      text: `benchmark event ${i} for ${primaryRef}`,
      refs,
    });
  }

  return session.sessionId;
}

async function runScenario(
  name: string,
  runQuery: (ref: string) => Promise<number>,
  refsPool: string[],
  queries: number,
  warmup: number,
  rng: () => number
): Promise<BenchScenarioResult> {
  for (let i = 0; i < warmup; i += 1) {
    const ref = refsPool[Math.floor(rng() * refsPool.length)];
    await runQuery(ref);
  }

  let hitQueries = 0;
  const startedAt = performance.now();
  for (let i = 0; i < queries; i += 1) {
    const ref = refsPool[Math.floor(rng() * refsPool.length)];
    const hitCount = await runQuery(ref);
    if (hitCount > 0) hitQueries += 1;
  }
  const elapsedMs = performance.now() - startedAt;

  return {
    name,
    queries,
    avgMs: 0,
    minMs: 0,
    p50Ms: 0,
    p95Ms: 0,
    p99Ms: 0,
    maxMs: 0,
    qps: roundMs((queries * 1000) / Math.max(1, elapsedMs)),
    hitRate: roundMs(hitQueries / Math.max(1, queries)),
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const createdWorkspace = !options.workspace;
  const workspaceRoot = options.workspace || await fs.mkdtemp(path.join(os.tmpdir(), 'ctxdb-refs-bench-'));

  await ensureContextDb(workspaceRoot);
  const refsPool = buildRefsPool(options.refsPool);
  const sessionId = await seedEvents(workspaceRoot, options.events, refsPool);
  const rng = createRng(options.seed);
  const latenciesRefsOnly: number[] = [];
  const latenciesRefsAndQuery: number[] = [];

  const refsOnly = await runScenario(
    'refs-only',
    async (ref) => {
      const started = performance.now();
      const result = await searchEvents({
        workspaceRoot,
        sessionId,
        refs: [ref],
        limit: options.limit,
      });
      latenciesRefsOnly.push(performance.now() - started);
      return result.results.length;
    },
    refsPool,
    options.queries,
    options.warmup,
    rng
  );

  const refsAndQuery = await runScenario(
    'refs+query',
    async (ref) => {
      const started = performance.now();
      const result = await searchEvents({
        workspaceRoot,
        sessionId,
        refs: [ref],
        query: 'benchmark event',
        limit: options.limit,
      });
      latenciesRefsAndQuery.push(performance.now() - started);
      return result.results.length;
    },
    refsPool,
    options.queries,
    options.warmup,
    rng
  );

  refsOnly.avgMs = roundMs(average(latenciesRefsOnly));
  refsOnly.minMs = roundMs(Math.min(...latenciesRefsOnly));
  refsOnly.p50Ms = roundMs(percentile(latenciesRefsOnly, 50));
  refsOnly.p95Ms = roundMs(percentile(latenciesRefsOnly, 95));
  refsOnly.p99Ms = roundMs(percentile(latenciesRefsOnly, 99));
  refsOnly.maxMs = roundMs(Math.max(...latenciesRefsOnly));

  refsAndQuery.avgMs = roundMs(average(latenciesRefsAndQuery));
  refsAndQuery.minMs = roundMs(Math.min(...latenciesRefsAndQuery));
  refsAndQuery.p50Ms = roundMs(percentile(latenciesRefsAndQuery, 50));
  refsAndQuery.p95Ms = roundMs(percentile(latenciesRefsAndQuery, 95));
  refsAndQuery.p99Ms = roundMs(percentile(latenciesRefsAndQuery, 99));
  refsAndQuery.maxMs = roundMs(Math.max(...latenciesRefsAndQuery));

  const payload = {
    ok: true,
    benchmark: 'contextdb-refs-query',
    workspaceRoot,
    sessionId,
    dataset: {
      events: options.events,
      refsPool: options.refsPool,
      limit: options.limit,
      warmup: options.warmup,
      queries: options.queries,
      seed: options.seed,
    },
    scenarios: [refsOnly, refsAndQuery],
    generatedAt: new Date().toISOString(),
  };

  if (options.jsonOut) {
    await fs.mkdir(path.dirname(options.jsonOut), { recursive: true });
    await fs.writeFile(options.jsonOut, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);

  if (createdWorkspace && !options.keepWorkspace) {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
