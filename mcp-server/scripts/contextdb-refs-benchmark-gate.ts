#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

interface ScenarioMetrics {
  name: string;
  avgMs: number;
  p95Ms: number;
  hitRate: number;
}

interface BenchPayload {
  benchmark?: string;
  scenarios?: ScenarioMetrics[];
}

interface GateOptions {
  input: string;
  refsOnlyP95Max: number;
  refsAndQueryP95Max: number;
  refsOnlyAvgMax: number;
  refsAndQueryAvgMax: number;
  minHitRate: number;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function parseArgs(argv: string[]): GateOptions {
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

  const input = typeof options.input === 'string' ? path.resolve(options.input) : '';
  if (!input) {
    throw new Error('Missing required option --input <path>');
  }

  return {
    input,
    refsOnlyP95Max: parseNumber(typeof options['refs-only-p95-max'] === 'string' ? options['refs-only-p95-max'] : undefined, 600),
    refsAndQueryP95Max: parseNumber(typeof options['refs-query-p95-max'] === 'string' ? options['refs-query-p95-max'] : undefined, 700),
    refsOnlyAvgMax: parseNumber(typeof options['refs-only-avg-max'] === 'string' ? options['refs-only-avg-max'] : undefined, 300),
    refsAndQueryAvgMax: parseNumber(typeof options['refs-query-avg-max'] === 'string' ? options['refs-query-avg-max'] : undefined, 350),
    minHitRate: parseNumber(typeof options['min-hit-rate'] === 'string' ? options['min-hit-rate'] : undefined, 0.95),
  };
}

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid benchmark metric: ${name}`);
  }
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const raw = await fs.readFile(opts.input, 'utf8');
  const payload = JSON.parse(raw) as BenchPayload;

  if (!payload || payload.benchmark !== 'contextdb-refs-query') {
    throw new Error('Unexpected benchmark payload type');
  }
  if (!Array.isArray(payload.scenarios)) {
    throw new Error('Benchmark payload missing scenarios array');
  }

  const refsOnly = payload.scenarios.find((item) => item.name === 'refs-only');
  const refsAndQuery = payload.scenarios.find((item) => item.name === 'refs+query');
  if (!refsOnly || !refsAndQuery) {
    throw new Error('Benchmark payload missing required scenarios: refs-only / refs+query');
  }

  assertFinite('refs-only.avgMs', refsOnly.avgMs);
  assertFinite('refs-only.p95Ms', refsOnly.p95Ms);
  assertFinite('refs-only.hitRate', refsOnly.hitRate);
  assertFinite('refs+query.avgMs', refsAndQuery.avgMs);
  assertFinite('refs+query.p95Ms', refsAndQuery.p95Ms);
  assertFinite('refs+query.hitRate', refsAndQuery.hitRate);

  const failures: string[] = [];
  if (refsOnly.p95Ms > opts.refsOnlyP95Max) {
    failures.push(`refs-only p95 ${refsOnly.p95Ms}ms exceeds ${opts.refsOnlyP95Max}ms`);
  }
  if (refsAndQuery.p95Ms > opts.refsAndQueryP95Max) {
    failures.push(`refs+query p95 ${refsAndQuery.p95Ms}ms exceeds ${opts.refsAndQueryP95Max}ms`);
  }
  if (refsOnly.avgMs > opts.refsOnlyAvgMax) {
    failures.push(`refs-only avg ${refsOnly.avgMs}ms exceeds ${opts.refsOnlyAvgMax}ms`);
  }
  if (refsAndQuery.avgMs > opts.refsAndQueryAvgMax) {
    failures.push(`refs+query avg ${refsAndQuery.avgMs}ms exceeds ${opts.refsAndQueryAvgMax}ms`);
  }
  if (refsOnly.hitRate < opts.minHitRate) {
    failures.push(`refs-only hitRate ${refsOnly.hitRate} below ${opts.minHitRate}`);
  }
  if (refsAndQuery.hitRate < opts.minHitRate) {
    failures.push(`refs+query hitRate ${refsAndQuery.hitRate} below ${opts.minHitRate}`);
  }

  if (failures.length > 0) {
    throw new Error(`ContextDB refs benchmark gate failed:\n- ${failures.join('\n- ')}`);
  }

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        gate: 'contextdb-refs-query',
        thresholds: {
          refsOnlyP95Max: opts.refsOnlyP95Max,
          refsAndQueryP95Max: opts.refsAndQueryP95Max,
          refsOnlyAvgMax: opts.refsOnlyAvgMax,
          refsAndQueryAvgMax: opts.refsAndQueryAvgMax,
          minHitRate: opts.minHitRate,
        },
        measured: {
          refsOnly,
          refsAndQuery,
        },
      },
      null,
      2
    ) + '\n'
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
