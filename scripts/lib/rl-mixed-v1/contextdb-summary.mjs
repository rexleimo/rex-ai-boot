import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function buildMixedSummaryPayload({ runId, mode, result }) {
  return {
    run_id: runId,
    mode,
    status: result.status,
    active_environments: result.summary.active_environments,
    environment_counts: result.summary.environment_counts,
    mixed_batch_count: result.summary.mixed_batch_count,
    batch_combinations: result.summary.batch_combinations,
    updates_completed: result.summary.updates_completed,
    rollbacks_completed: result.summary.rollbacks_completed,
    replay_only_epochs: result.summary.replay_only_epochs,
    active_checkpoint_id: result.summary.active_checkpoint_id,
    pre_update_ref_checkpoint_id: result.summary.pre_update_ref_checkpoint_id,
    last_stable_checkpoint_id: result.summary.last_stable_checkpoint_id,
    holdout_validation: result.summary.holdout_validation,
    drills: result.summary.drills,
    duplicateEventApplications: result.summary.duplicateEventApplications,
  };
}

export async function writeMixedSummary({ rootDir, runId, mode, result }) {
  const payload = buildMixedSummaryPayload({ runId, mode, result });
  const summaryPath = path.join(rootDir, 'experiments', 'rl-mixed-v1', 'runs', runId, 'run-summary.json');
  await mkdir(path.dirname(summaryPath), { recursive: true });
  await writeFile(summaryPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return {
    summaryPath,
    payload,
  };
}

