import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { EvalRunReport } from "./types";

export type BaselineDiff = {
  newRegressions: Array<{ name: string; wasPassing: boolean; nowPassing: boolean }>;
  newPassing: Array<{ name: string }>;
  scoreDelta: number; // new aggregate - old aggregate
  hasBaseline: boolean;
};

/**
 * Load the most recent baseline, if any. Returns null if none saved yet.
 */
export function loadBaseline(path: string): EvalRunReport | null {
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw) as EvalRunReport;
  } catch {
    return null;
  }
}

export function saveBaseline(path: string, report: EvalRunReport): void {
  writeFileSync(path, JSON.stringify(report, null, 2), "utf8");
}

/**
 * Compute what changed between the previous baseline and a new run. A
 * fixture-level regression is "was fully passing, now not fully passing."
 * A new-passing is the inverse.
 */
export function diffAgainstBaseline(
  baseline: EvalRunReport | null,
  current: EvalRunReport,
): BaselineDiff {
  if (!baseline) {
    return {
      newRegressions: [],
      newPassing: [],
      scoreDelta: 0,
      hasBaseline: false,
    };
  }

  const byName = new Map<string, { wasPassing: boolean }>();
  for (const f of baseline.fixtures) {
    byName.set(f.name, { wasPassing: f.passed });
  }

  const regressions: BaselineDiff["newRegressions"] = [];
  const improvements: BaselineDiff["newPassing"] = [];
  for (const f of current.fixtures) {
    const prior = byName.get(f.name);
    if (!prior) continue;
    if (prior.wasPassing && !f.passed) {
      regressions.push({ name: f.name, wasPassing: true, nowPassing: false });
    } else if (!prior.wasPassing && f.passed) {
      improvements.push({ name: f.name });
    }
  }

  return {
    newRegressions: regressions,
    newPassing: improvements,
    scoreDelta: current.aggregateScore - baseline.aggregateScore,
    hasBaseline: true,
  };
}
