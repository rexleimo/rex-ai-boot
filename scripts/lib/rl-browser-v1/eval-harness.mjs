import { validateHoldoutValidationResult } from '../rl-core/schema.mjs';
import { compareBrowserAgainstReference, runBrowserEpisode } from './adapter.mjs';
import { createFixtureBrowserDriver } from './browser-runner.mjs';
import { validateBrowserHoldoutResult, validateBrowserTask } from './schema.mjs';
import { loadBrowserTasks } from './task-registry.mjs';

export async function runBrowserHoldout({
  tasks = loadBrowserTasks({ count: 20 }),
  checkpointId,
  baselineCheckpointId = 'browser-baseline',
  browserDriver = createFixtureBrowserDriver(),
}) {
  let successCount = 0;
  let comparisonFailedCount = 0;
  let schemaValidationFailures = 0;
  const validTasks = loadBrowserTasks({ tasks });

  for (const task of validTasks) {
    try {
      validateBrowserTask(task);
      const episode = await runBrowserEpisode({
        task,
        checkpointId,
        browserDriver,
      });
      if (episode.terminal_reward > 0) {
        successCount += 1;
      }
      const comparison = await compareBrowserAgainstReference({
        task,
        activeCheckpointId: checkpointId,
        preUpdateRefCheckpointId: baselineCheckpointId,
        browserDriver,
      });
      if (comparison.comparison_status === 'comparison_failed') {
        comparisonFailedCount += 1;
      }
    } catch {
      schemaValidationFailures += 1;
    }
  }

  const result = validateBrowserHoldoutResult({
    episode_count: validTasks.length,
    success_rate: validTasks.length === 0 ? 0 : successCount / validTasks.length,
    comparison_failed_rate: validTasks.length === 0 ? 0 : comparisonFailedCount / validTasks.length,
    schema_validation_failures: schemaValidationFailures,
  });

  const corePayload = validateHoldoutValidationResult({
    environment: 'browser',
    status: result.comparison_failed_rate <= 0.2 && result.schema_validation_failures === 0 ? 'passed' : 'failed',
    episode_count: result.episode_count,
    metrics: {
      success_rate: result.success_rate,
      comparison_failed_rate: result.comparison_failed_rate,
      schema_validation_failures: result.schema_validation_failures,
    },
  });

  return {
    ...result,
    ...corePayload,
  };
}

