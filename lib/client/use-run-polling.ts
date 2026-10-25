"use client";

import { useEffect, useRef, useState } from "react";
import { fetchRun } from "@/lib/client/hooks";
import { isTerminalStage, type EncodeRun } from "@/lib/types";

export interface RunPollingState {
  /** The latest run state we've received, or null before the first response. */
  run: EncodeRun | null;
  /** True while we're still asking the server for updates. */
  polling: boolean;
  /** A request failed (network, 404, …). Not the same thing as the RUN failing. */
  fetchError: string | null;
  /** Every message we've seen, oldest first — the log the UI renders. */
  log: string[];
}

const initialState: RunPollingState = {
  run: null,
  polling: false,
  fetchError: null,
  log: [],
};

export function useRunPolling(runId: string | null, onFinished?: () => void): RunPollingState {
  const [state, setState] = useState<RunPollingState>(initialState);
  const onFinishedRef = useRef(onFinished);

  useEffect(() => {
    onFinishedRef.current = onFinished;
  });

  useEffect(() => {
    if (!runId) {
      setState(initialState);
      return;
    }

    const activeRunId = runId;

    setState({
      run: null,
      polling: true,
      fetchError: null,
      log: [],
    });

    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    async function poll() {
      if (cancelled) return;

      controller = new AbortController();

      try {
        const data = await fetchRun(activeRunId, controller.signal);
        if (cancelled) return;

        const terminal = isTerminalStage(data.stage);

        setState((prev) => {
          const lastMsg = prev.log[prev.log.length - 1];
          const nextLog =
            data.message && data.message !== lastMsg ? [...prev.log, data.message] : prev.log;

          return {
            ...prev,
            run: data,
            polling: !terminal,
            fetchError: null,
            log: nextLog,
          };
        });

        if (terminal) {
          onFinishedRef.current?.();
        } else if (!cancelled) {
          timerId = setTimeout(poll, 1000);
        }
      } catch (err) {
        if (cancelled) return;

        setState((prev) => ({
          ...prev,
          polling: false,
          fetchError: err instanceof Error ? err.message : "Failed to fetch run status",
        }));
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timerId !== undefined) {
        clearTimeout(timerId);
      }
      controller?.abort();
    };
  }, [runId]);

  return state;
}
