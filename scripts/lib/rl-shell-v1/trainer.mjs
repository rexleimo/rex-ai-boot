import { createStudentPolicy } from './student-policy.mjs';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureWeightVector(policy, featureKey) {
  if (!policy.weights) {
    policy.weights = {};
  }
  if (!Array.isArray(policy.weights[featureKey])) {
    policy.weights[featureKey] = new Array(policy.vocabulary.length).fill(0);
  }
  if (!policy.vocabularyIndex) {
    policy.vocabularyIndex = Object.fromEntries(policy.vocabulary.map((token, index) => [token, index]));
  }
  return policy.weights[featureKey];
}

function averageAbsoluteDifference(left, right) {
  const size = Math.max(left.length, right.length);
  if (size === 0) return 0;
  let total = 0;
  for (let index = 0; index < size; index += 1) {
    total += Math.abs(Number(left[index] || 0) - Number(right[index] || 0));
  }
  return total / size;
}

export function createTrainerConfig(overrides = {}) {
  return {
    ppo_clip_epsilon: 0.2,
    distill_loss_weight: 0.2,
    kl_loss_weight: 0.01,
    gamma: 1.0,
    lambda: 1.0,
    learning_rate: 0.05,
    reference_refresh_interval: 100,
    ...overrides,
  };
}

export function computeLosses({ rlLoss, distillLoss, klLoss, distillationStatus, config = createTrainerConfig() }) {
  const distillLossWeight = distillationStatus === 'applied' ? config.distill_loss_weight : 0;
  return {
    distillLossWeight,
    totalLoss: rlLoss + distillLossWeight * distillLoss + config.kl_loss_weight * klLoss,
  };
}

export function computeAdvantages({ rewards, config = createTrainerConfig() }) {
  const sequence = Array.isArray(rewards) ? rewards.map((value) => Number(value || 0)) : [];
  const returns = new Array(sequence.length).fill(0);
  let running = 0;
  for (let index = sequence.length - 1; index >= 0; index -= 1) {
    running = sequence[index] + config.gamma * running;
    returns[index] = running;
  }
  return {
    advantages: [...returns],
    returns,
  };
}

export function applyPpoUpdate({ policy, referencePolicy, trajectory, config = createTrainerConfig() }) {
  const featureKey = trajectory.featureKey || 'default';
  const policyVector = ensureWeightVector(policy, featureKey);
  const referenceVector = ensureWeightVector(referencePolicy, featureKey);
  const tokenIds = Array.isArray(trajectory.tokenIds) ? trajectory.tokenIds : [];
  const teacherTokenIds = Array.isArray(trajectory.teacherTokenIds) ? trajectory.teacherTokenIds : [];
  const reward = Number(trajectory.fusedReward ?? trajectory.reward ?? 0);
  const { advantages } = computeAdvantages({ rewards: [reward], config });
  const advantage = Number(trajectory.advantage ?? advantages[0] ?? reward);

  for (const tokenId of tokenIds) {
    if (Number.isInteger(tokenId) && tokenId >= 0 && tokenId < policyVector.length) {
      policyVector[tokenId] += config.learning_rate * advantage;
    }
  }

  if (trajectory.distillationStatus === 'applied') {
    for (const tokenId of teacherTokenIds) {
      if (Number.isInteger(tokenId) && tokenId >= 0 && tokenId < policyVector.length) {
        policyVector[tokenId] += config.learning_rate * config.distill_loss_weight;
      }
    }
  }

  const mismatchCount = teacherTokenIds.length === 0
    ? 0
    : teacherTokenIds.reduce((count, tokenId, index) => count + (tokenIds[index] === tokenId ? 0 : 1), 0);

  const rlLoss = Math.max(0, -advantage);
  const distillLoss = teacherTokenIds.length === 0 ? 0 : mismatchCount / teacherTokenIds.length;
  const klLoss = averageAbsoluteDifference(policyVector, referenceVector);
  const losses = computeLosses({
    rlLoss,
    distillLoss,
    klLoss,
    distillationStatus: trajectory.distillationStatus || 'skipped',
    config,
  });

  policy.updateCount = Number(policy.updateCount || 0) + 1;

  return {
    policy,
    metrics: {
      policy_loss: rlLoss,
      distill_loss: distillLoss,
      kl_loss: klLoss,
      total_loss: losses.totalLoss,
      distill_loss_weight: losses.distillLossWeight,
      advantage,
      return: advantage,
    },
  };
}

export function maybeRefreshReferencePolicy({ policy, referencePolicy, updateCount, config = createTrainerConfig() }) {
  if (updateCount > 0 && updateCount % config.reference_refresh_interval === 0) {
    return clone(policy);
  }
  return referencePolicy;
}

export function createReferencePolicyFrom(policy) {
  return createStudentPolicy({
    seed: policy.seed,
    vocabulary: policy.vocabulary,
    weights: clone(policy.weights),
  });
}
