# Agent Team MCP Startup Fix

## Problem

Recent auto-route changes send more complex `ctx-agent` requests straight into `team/live` and `subagent/live`. In Codex child workers, that amplifies MCP cold-start latency and handshake failures, which shows up as `agent team` getting stuck during MCP loading. Lazy interactive startup also spawns detached async bootstrap work on every launch, which can compete with the same workspace's `context:pack` work.

## Root Cause

1. `subagent-runtime` launches `codex exec` workers that inherit the full user MCP config, so each worker pays MCP startup cost even when the orchestration only needs JSON handoffs.
2. Lazy `ctx-agent` startup always schedules async bootstrap, even when facade state is already fresh, and repeated launches can race on ContextDB work.

## Fix Plan

1. Add regression tests for Codex worker argument overrides and async bootstrap dedupe.
2. Update `subagent-runtime` so Codex child workers disable MCP startup by default, with an explicit env opt-out.
3. Harden async bootstrap so fresh facade state skips background refresh and concurrent refresh attempts dedupe with a workspace lock.
4. Run focused tests first, then broader script verification.
