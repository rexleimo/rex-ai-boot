function countDegradationStreak(results) {
  let streak = 0;
  for (const result of results) {
    if (result.comparison_status !== 'completed') {
      continue;
    }
    if (result.relative_outcome === 'better') {
      streak = 0;
      continue;
    }
    if (result.relative_outcome === 'worse') {
      streak += 1;
    }
  }
  return streak;
}

export function seedEpoch(overrides = {}) {
  return {
    update_epoch_id: 'epoch-001',
    phase: 'monitoring',
    active_checkpoint_id: 'ckpt-a',
    pre_update_ref_checkpoint_id: 'ckpt-prev',
    admitted_trajectory_ids: [],
    comparison_results: [],
    completed_comparison_count: 0,
    comparison_failed_count: 0,
    degradation_streak: 0,
    close_reason: null,
    promotion_eligible: false,
    ...overrides,
  };
}

export function recordComparisonResults(epoch, results) {
  const comparison_failed_count = results.filter((result) => result.comparison_status === 'comparison_failed').length;
  const completed_comparison_count = results.length - comparison_failed_count;
  const close_reason = comparison_failed_count > 0 ? 'replay_only' : 'promotion_eligible';
  return {
    ...epoch,
    comparison_results: results,
    completed_comparison_count,
    comparison_failed_count,
    close_reason,
    promotion_eligible: close_reason === 'promotion_eligible',
    degradation_streak: countDegradationStreak(results),
  };
}

export function reopenEpoch(epoch, reason) {
  if (reason === 'update_failed') {
    return seedEpoch({
      ...epoch,
      phase: 'collection',
      comparison_results: [],
      completed_comparison_count: 0,
      comparison_failed_count: 0,
      degradation_streak: 0,
      close_reason: null,
      promotion_eligible: false,
    });
  }
  if (reason === 'replay_only') {
    return seedEpoch({
      ...epoch,
      phase: 'monitoring',
      comparison_results: [],
      completed_comparison_count: 0,
      comparison_failed_count: 0,
      close_reason: null,
      promotion_eligible: false,
    });
  }
  throw new Error(`unsupported reopen reason: ${reason}`);
}
