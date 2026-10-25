"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { jobKeys, useJob, useStartRun } from "@/lib/client/hooks";
import { useRunPolling } from "@/lib/client/use-run-polling";
import { ProgressBar } from "@/components/progress-bar";
import { StatusBadge } from "@/components/status-badge";

type PanelState = "idle" | "running" | "failed" | "completed";

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const jobQuery = useJob(id);

  const [runId, setRunId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const onFinished = () => {
    queryClient.invalidateQueries({ queryKey: jobKeys.detail(id) });
    queryClient.invalidateQueries({ queryKey: jobKeys.all });
  };

  const { run, fetchError, log } = useRunPolling(runId, onFinished);

  const startRunMutation = useStartRun(id);

  const handleStartRun = () => {
    setStartError(null);
    startRunMutation.mutate(undefined, {
      onSuccess: (data) => {
        setRunId(data.runId);
      },
      onError: (err) => {
        setStartError(err instanceof Error ? err.message : "Failed to start encode");
      },
    });
  };

  if (jobQuery.isLoading) {
    return <p className="text-sm text-neutral-500">Loading job…</p>;
  }

  if (jobQuery.isError || !jobQuery.data) {
    return (
      <div className="text-sm text-red-600">
        Job not found.{" "}
        <Link href="/jobs" className="underline">
          Back to jobs
        </Link>
      </div>
    );
  }

  const job = jobQuery.data;

  const panelState: PanelState = (() => {
    if (!runId || !run) return "idle";
    if (run.stage === "FAILED") return "failed";
    if (run.stage === "COMPLETED") return "completed";
    return "running";
  })();

  return (
    <div className="space-y-6">
      <Link href="/jobs" className="text-sm text-neutral-500 hover:underline">
        ← All jobs
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{job.title}</h1>
          <p className="truncate text-sm text-neutral-500">{job.sourceUrl}</p>
        </div>
        <StatusBadge value={job.status} />
      </div>

      <div className="space-y-6 rounded-lg border border-neutral-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Encode run</h2>
            <p className="text-xs text-neutral-500">
              {panelState === "idle" && "Press Start encode to begin transcoding."}
              {panelState === "running" && "Transcoding in progress…"}
              {panelState === "failed" && "Encoding failed partway through."}
              {panelState === "completed" && "Encoding completed successfully."}
            </p>
          </div>

          {panelState === "idle" && (
            <button
              onClick={handleStartRun}
              disabled={startRunMutation.isPending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {startRunMutation.isPending ? "Starting…" : "Start encode"}
            </button>
          )}

          {panelState === "failed" && (
            <button
              onClick={handleStartRun}
              disabled={startRunMutation.isPending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {startRunMutation.isPending ? "Starting…" : "Retry encode"}
            </button>
          )}
        </div>

        {startError && (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {startError}
          </p>
        )}

        {fetchError && (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            {fetchError}
          </p>
        )}

        {panelState !== "idle" && run && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-500">Stage</span>
              <StatusBadge value={run.stage} />
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs text-neutral-500">
                <span>Progress</span>
                <span>{run.progressPct}%</span>
              </div>
              <ProgressBar value={run.progressPct} failed={panelState === "failed"} />
            </div>

            {panelState === "failed" && run.error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-4 text-xs text-red-800">
                <p className="font-semibold">Failure details</p>
                <p className="mt-1">{run.error}</p>
              </div>
            )}

            {panelState === "completed" && run.result && (
              <div className="space-y-3 rounded-md border border-neutral-200 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">Output renditions</span>
                  <span className="text-xs text-neutral-500">
                    Duration: {run.result.durationSec}s
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-neutral-200 text-neutral-500">
                        <th className="pb-2 font-medium">Rendition</th>
                        <th className="pb-2 font-medium">Resolution</th>
                        <th className="pb-2 font-medium">File size</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {run.result.renditions.map((rendition) => (
                        <tr key={rendition.label}>
                          <td className="py-2 font-medium">{rendition.label}</td>
                          <td className="py-2 text-neutral-600">
                            {rendition.width} × {rendition.height}
                          </td>
                          <td className="py-2 text-neutral-600">{rendition.sizeMb} MB</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {log.length > 0 && (
              <div className="rounded-md bg-neutral-900 p-4 font-mono text-xs text-neutral-200">
                <p className="mb-2 font-semibold text-neutral-400">Activity log</p>
                <ul className="space-y-1">
                  {log.map((entry, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span className="text-neutral-500 select-none">[{idx + 1}]</span>
                      <span>{entry}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

