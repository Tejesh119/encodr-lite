import { randomUUID } from "node:crypto";
import { TIMELINE, type EncodeResult, type EncodeRun, type Job, type JobStatus } from "@/lib/types";

// Our "database" is two Maps held in memory. `next dev` is a single Node process, so this is fine
// for the exercise. Restarting the dev server wipes everything — that's expected, don't work around it.
//
// Everything in this file is provided EXCEPT computeRun(), which is Task 3.

const jobs = new Map<string, Job>();
const runs = new Map<string, RunRecord>();

export interface RunRecord {
  id: string;
  jobId: string;
  sourceUrl: string;
  /** epoch milliseconds — when Start encode was pressed. */
  startedAt: number;
}

/** The one "magic" source URL that always fails partway, so you can build the error path. */
export const FAIL_URL = "https://cdn.example.com/videos/corrupt.mp4";

export function computeRun(record: RunRecord, now: number = Date.now()): EncodeRun {
  const elapsed = Math.max(0, now - record.startedAt);

  if (record.sourceUrl === FAIL_URL && elapsed >= TIMELINE.failAtMs) {
    const frozenProgress = Math.round((TIMELINE.failAtMs / TIMELINE.transcodingEndsMs) * 100);
    return {
      id: record.id,
      jobId: record.jobId,
      stage: "FAILED",
      progressPct: frozenProgress,
      message: "Transcoding failed: source media is corrupt",
      error: "Corrupt video stream: unexpected EOF encountered during transcode",
    };
  }

  const progressPct = Math.min(100, Math.round((elapsed / TIMELINE.transcodingEndsMs) * 100));

  if (elapsed < TIMELINE.queuedEndsMs) {
    return {
      id: record.id,
      jobId: record.jobId,
      stage: "QUEUED",
      progressPct,
      message: "Job queued for encoding",
    };
  }

  if (elapsed < TIMELINE.downloadingEndsMs) {
    return {
      id: record.id,
      jobId: record.jobId,
      stage: "DOWNLOADING",
      progressPct,
      message: "Downloading source media",
    };
  }

  if (elapsed < TIMELINE.transcodingEndsMs) {
    return {
      id: record.id,
      jobId: record.jobId,
      stage: "TRANSCODING",
      progressPct,
      message: "Transcoding renditions (1080p, 720p, 480p)",
    };
  }

  return {
    id: record.id,
    jobId: record.jobId,
    stage: "COMPLETED",
    progressPct: 100,
    message: "Encoding completed successfully",
    result: makeResult(),
  };
}

// ---------------------------------------------------------------------------
// Everything below is provided.
// ---------------------------------------------------------------------------

/** Fake but plausible encode output. Call this when a run reaches COMPLETED. */
export function makeResult(): EncodeResult {
  return {
    durationSec: 184,
    renditions: [
      { label: "1080p", width: 1920, height: 1080, sizeMb: 142.6 },
      { label: "720p", width: 1280, height: 720, sizeMb: 68.3 },
      { label: "480p", width: 854, height: 480, sizeMb: 24.1 },
    ],
  };
}

export function listJobs(): Job[] {
  return [...jobs.values()]
    .map(withDerivedStatus)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getJob(id: string): Job | null {
  const job = jobs.get(id);
  return job ? withDerivedStatus(job) : null;
}

export function createJob(input: { sourceUrl: string; title?: string }): Job {
  const sourceUrl = input.sourceUrl.trim();
  const job: Job = {
    id: `j_${randomUUID().slice(0, 8)}`,
    title: input.title?.trim() || deriveTitle(sourceUrl),
    sourceUrl,
    status: "NEW",
    createdAt: new Date().toISOString(),
  };
  jobs.set(job.id, job);
  return job;
}

export function startRun(jobId: string): RunRecord | null {
  const job = jobs.get(jobId);
  if (!job) return null;
  const record: RunRecord = {
    id: `r_${randomUUID().slice(0, 8)}`,
    jobId,
    sourceUrl: job.sourceUrl,
    startedAt: Date.now(),
  };
  runs.set(record.id, record);
  job.latestRunId = record.id;
  return record;
}

export function getRun(id: string, now: number = Date.now()): EncodeRun | null {
  const record = runs.get(id);
  return record ? computeRun(record, now) : null;
}

/**
 * A job's status is derived from its latest run rather than stored, so it can never drift out of
 * sync. Once computeRun() works, job statuses in the list start updating for free.
 */
function withDerivedStatus(job: Job): Job {
  if (!job.latestRunId) return job;
  const record = runs.get(job.latestRunId);
  if (!record) return job;

  let status: JobStatus;
  try {
    const stage = computeRun(record).stage;
    status = stage === "COMPLETED" ? "COMPLETED" : stage === "FAILED" ? "FAILED" : "RUNNING";
  } catch {
    // computeRun isn't implemented yet — leave the stored status alone.
    return job;
  }
  return { ...job, status };
}

function deriveTitle(sourceUrl: string): string {
  try {
    const path = new URL(sourceUrl).pathname.replace(/\/+$/, "");
    const last = path.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : "Untitled encode";
  } catch {
    return "Untitled encode";
  }
}

/** Test helper — resets the store between tests. */
export function __resetStore() {
  jobs.clear();
  runs.clear();
}

export { TIMELINE };
