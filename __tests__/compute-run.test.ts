import { describe, expect, it } from "vitest";
import { computeRun, FAIL_URL, type RunRecord } from "@/lib/server/store";
import { TIMELINE, type Stage } from "@/lib/types";

const START = 1_700_000_000_000;

function makeRecord(sourceUrl = "https://cdn.example.com/videos/clip.mp4"): RunRecord {
  return {
    id: "r_123",
    jobId: "j_456",
    sourceUrl,
    startedAt: START,
  };
}

describe("computeRun", () => {
  describe("stage boundaries", () => {
    it.each([
      { elapsed: 0, expectedStage: "QUEUED" as Stage },
      { elapsed: 1_999, expectedStage: "QUEUED" as Stage },
      { elapsed: TIMELINE.queuedEndsMs, expectedStage: "DOWNLOADING" as Stage },
      { elapsed: 5_999, expectedStage: "DOWNLOADING" as Stage },
      { elapsed: TIMELINE.downloadingEndsMs, expectedStage: "TRANSCODING" as Stage },
      { elapsed: 11_999, expectedStage: "TRANSCODING" as Stage },
      { elapsed: TIMELINE.transcodingEndsMs, expectedStage: "COMPLETED" as Stage },
      { elapsed: 15_000, expectedStage: "COMPLETED" as Stage },
    ])("transitions to $expectedStage at $elapsed ms", ({ elapsed, expectedStage }) => {
      const record = makeRecord();
      const run = computeRun(record, START + elapsed);

      expect(run.id).toBe(record.id);
      expect(run.jobId).toBe(record.jobId);
      expect(run.stage).toBe(expectedStage);

      if (expectedStage === "COMPLETED") {
        expect(run.progressPct).toBe(100);
        expect(run.result).toBeDefined();
        expect(run.result?.renditions.length).toBeGreaterThan(0);
        expect(run.error).toBeUndefined();
      } else {
        expect(run.result).toBeUndefined();
        expect(run.error).toBeUndefined();
      }
    });
  });

  describe("normal URL", () => {
    it("does not fail at or after 8000ms", () => {
      const record = makeRecord();
      const run = computeRun(record, START + TIMELINE.failAtMs);
      expect(run.stage).toBe("TRANSCODING");
      expect(run.error).toBeUndefined();
    });
  });

  describe("failing URL (FAIL_URL)", () => {
    it("behaves normally before 8000ms", () => {
      const record = makeRecord(FAIL_URL);
      const run = computeRun(record, START + 7_999);
      expect(run.stage).toBe("TRANSCODING");
      expect(run.error).toBeUndefined();
      expect(run.result).toBeUndefined();
    });

    it("fails at exactly 8000ms and remains failed well after 12000ms", () => {
      const record = makeRecord(FAIL_URL);

      const runAt8s = computeRun(record, START + TIMELINE.failAtMs);
      expect(runAt8s.stage).toBe("FAILED");
      expect(runAt8s.error).toBeDefined();
      expect(runAt8s.result).toBeUndefined();

      const runAt15s = computeRun(record, START + 15_000);
      expect(runAt15s.stage).toBe("FAILED");
      expect(runAt15s.error).toBeDefined();
      expect(runAt15s.result).toBeUndefined();
    });

    it("freezes progress at point of failure across 8000ms, 12000ms, and 20000ms", () => {
      const record = makeRecord(FAIL_URL);
      const run8s = computeRun(record, START + 8_000);
      const run12s = computeRun(record, START + 12_000);
      const run20s = computeRun(record, START + 20_000);

      expect(run8s.progressPct).toBeGreaterThanOrEqual(66);
      expect(run8s.progressPct).toBeLessThanOrEqual(68);
      expect(run12s.progressPct).toBe(run8s.progressPct);
      expect(run20s.progressPct).toBe(run8s.progressPct);
    });
  });

  describe("progress invariants", () => {
    it("is clamped between 0 and 100", () => {
      const record = makeRecord();
      const beforeStart = computeRun(record, START - 1_000);
      expect(beforeStart.progressPct).toBe(0);

      const afterEnd = computeRun(record, START + 25_000);
      expect(afterEnd.progressPct).toBe(100);
    });

    it("never goes backwards for normal URLs", () => {
      const record = makeRecord();
      let lastProgress = -1;
      for (let ms = 0; ms <= 15_000; ms += 500) {
        const run = computeRun(record, START + ms);
        expect(run.progressPct).toBeGreaterThanOrEqual(lastProgress);
        lastProgress = run.progressPct;
      }
    });

    it("never goes backwards for FAIL_URL", () => {
      const record = makeRecord(FAIL_URL);
      let lastProgress = -1;
      for (let ms = 0; ms <= 15_000; ms += 500) {
        const run = computeRun(record, START + ms);
        expect(run.progressPct).toBeGreaterThanOrEqual(lastProgress);
        lastProgress = run.progressPct;
      }
    });
  });
});
