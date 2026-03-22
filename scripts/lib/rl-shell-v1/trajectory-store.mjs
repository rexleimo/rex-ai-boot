import { appendFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { validateEpisodeRecord } from './schema.mjs';

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function buildArtifactNames(episodeId) {
  return {
    stdout: `${episodeId}-stdout.log`,
    stderr: `${episodeId}-stderr.log`,
    finalDiff: `${episodeId}-final.patch`,
    observationTrace: `${episodeId}-trace.json`,
  };
}

export async function createRunLayout({ rootDir, runId }) {
  const runPath = path.join(rootDir, 'runs', runId);
  const episodesDir = path.join(runPath, 'episodes');
  const checkpointsDir = path.join(runPath, 'checkpoints');
  const evalsDir = path.join(runPath, 'evals');
  const artifactsDir = path.join(runPath, 'artifacts');

  await mkdir(episodesDir, { recursive: true });
  await mkdir(checkpointsDir, { recursive: true });
  await mkdir(evalsDir, { recursive: true });
  await mkdir(artifactsDir, { recursive: true });

  return {
    runId,
    runPath,
    episodesDir,
    checkpointsDir,
    evalsDir,
    artifactsDir,
  };
}

export async function persistEpisode({ runDir, episode }) {
  const names = buildArtifactNames(episode.episode_id);
  const stdoutArtifactPath = path.join(runDir.artifactsDir, names.stdout);
  const stderrArtifactPath = path.join(runDir.artifactsDir, names.stderr);
  const finalDiffArtifactPath = path.join(runDir.artifactsDir, names.finalDiff);
  const observationTraceArtifactPath = path.join(runDir.artifactsDir, names.observationTrace);

  const episodeRecord = validateEpisodeRecord({
    ...episode,
    stdout_artifact_path: path.relative(runDir.runPath, stdoutArtifactPath),
    stderr_artifact_path: path.relative(runDir.runPath, stderrArtifactPath),
    final_diff_artifact_path: path.relative(runDir.runPath, finalDiffArtifactPath),
    observation_trace_artifact_path: path.relative(runDir.runPath, observationTraceArtifactPath),
  });

  await writeFile(stdoutArtifactPath, `${episodeRecord.stdout_summary}\n`, 'utf8');
  await writeFile(stderrArtifactPath, `${episodeRecord.stderr_summary}\n`, 'utf8');
  await writeFile(finalDiffArtifactPath, episodeRecord.final_diff, 'utf8');
  await writeJson(
    observationTraceArtifactPath,
    episodeRecord.student_steps
  );

  const episodePath = path.join(runDir.episodesDir, `${episodeRecord.episode_id}.json`);
  await writeJson(episodePath, episodeRecord);

  return {
    episodePath,
    stdoutArtifactPath,
    stderrArtifactPath,
    finalDiffArtifactPath,
    observationTraceArtifactPath,
  };
}

export async function appendMetrics({ runDir, metric }) {
  const metricsPath = path.join(runDir.runPath, 'metrics.jsonl');
  await appendFile(metricsPath, `${JSON.stringify(metric)}\n`, 'utf8');
  return metricsPath;
}

export async function writeCheckpointMetadata({ runDir, kind, metadata }) {
  const targetDir = path.join(runDir.checkpointsDir, kind);
  await mkdir(targetDir, { recursive: true });
  const metadataPath = path.join(targetDir, 'metadata.json');
  await writeJson(metadataPath, metadata);
  return metadataPath;
}

async function readEpisodeRecords(runDir) {
  const entries = await readdir(runDir.episodesDir);
  const records = [];
  for (const entry of entries.filter((name) => name.endsWith('.json')).sort()) {
    records.push(JSON.parse(await readFile(path.join(runDir.episodesDir, entry), 'utf8')));
  }
  return records;
}

export async function listReplayEligible({ runDir }) {
  const records = await readEpisodeRecords(runDir);
  return records.filter((episode) => episode.replay_eligible && episode.replay_route !== 'diagnostic_only');
}

export async function listDiagnosticEpisodes({ runDir }) {
  const records = await readEpisodeRecords(runDir);
  return records.filter((episode) => episode.replay_route === 'diagnostic_only');
}
