function assertPointerState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new Error('checkpoint state must be an object');
  }
  for (const field of ['active_checkpoint_id', 'last_stable_checkpoint_id']) {
    if (typeof state[field] !== 'string' || state[field].trim().length === 0) {
      throw new Error(`checkpoint state.${field} must be a non-empty string`);
    }
  }
  if (
    state.pre_update_ref_checkpoint_id !== null &&
    state.pre_update_ref_checkpoint_id !== undefined &&
    (typeof state.pre_update_ref_checkpoint_id !== 'string' || state.pre_update_ref_checkpoint_id.trim().length === 0)
  ) {
    throw new Error('checkpoint state.pre_update_ref_checkpoint_id must be a non-empty string or null');
  }
}

function assertString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

export function applyPointerTransition(currentState, event) {
  assertPointerState(currentState);
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw new Error('event must be an object');
  }

  switch (event.type) {
    case 'update.completed': {
      assertString(event.new_active_checkpoint_id, 'event.new_active_checkpoint_id');
      assertString(event.previous_active_checkpoint_id, 'event.previous_active_checkpoint_id');
      if (event.previous_active_checkpoint_id !== currentState.active_checkpoint_id) {
        throw new Error('event.previous_active_checkpoint_id must match current active_checkpoint_id');
      }
      return {
        active_checkpoint_id: event.new_active_checkpoint_id,
        pre_update_ref_checkpoint_id: event.previous_active_checkpoint_id,
        last_stable_checkpoint_id: currentState.last_stable_checkpoint_id,
      };
    }
    case 'epoch.closed': {
      if (event.promotion_eligible === true) {
        return {
          active_checkpoint_id: currentState.active_checkpoint_id,
          pre_update_ref_checkpoint_id: null,
          last_stable_checkpoint_id: currentState.active_checkpoint_id,
        };
      }
      return {
        ...currentState,
      };
    }
    case 'update.failed': {
      return {
        active_checkpoint_id: currentState.active_checkpoint_id,
        pre_update_ref_checkpoint_id: null,
        last_stable_checkpoint_id: currentState.last_stable_checkpoint_id,
      };
    }
    case 'rollback.completed': {
      assertString(event.restored_checkpoint_id, 'event.restored_checkpoint_id');
      return {
        active_checkpoint_id: event.restored_checkpoint_id,
        pre_update_ref_checkpoint_id: null,
        last_stable_checkpoint_id: event.restored_checkpoint_id,
      };
    }
    default:
      throw new Error(`unsupported checkpoint transition type: ${event.type}`);
  }
}
