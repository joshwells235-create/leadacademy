import { execSync } from "node:child_process";
import { parseArgs } from "node:util";
import { config } from "dotenv";
import { diffAgainstBaseline, loadBaseline, saveBaseline } from "./baseline";
import { judgeFixture } from "./judge";
import { loadFixtures } from "./load";
import { runFixture } from "./runner";
import type { EvalRunReport, FixtureResult } from "./types";

config({ path: ".env.local" });

const FIXTURES_DIR = "evals/fixtures";
const BASELINE_PATH = "evals/baseline.json";

async function main() {
  const rawArgs = process.argv.slice(2).filter((a) => a !== "--");
  const { values } = parseArgs({
    args: rawArgs,
    options: {
      update: { type: "boolean", short: "u", default: false },
      filter: { type: "string", short: "f" },
      verbose: { type: "boolean", short: "v", default: false },
    },
    allowPositionals: false,
  });

  const updateBaseline = values.update === true;
  const filter = values.filter;
  const verbose = values.verbose === true;

  console.log("Loading fixtures…");
  const all = loadFixtures(FIXTURES_DIR);
  const fixtures = filter
    ? all.filter((f) => f.name.toLowerCase().includes(filter.toLowerCase()))
    : all;

  if (fixtures.length === 0) {
    console.error(
      filter ? `No fixtures matched filter "${filter}"` : `No fixtures found in ${FIXTURES_DIR}`,
    );
    process.exit(1);
  }

  console.log(`Running ${fixtures.length} fixture${fixtures.length === 1 ? "" : "s"}…\n`);

  const results: FixtureResult[] = [];
  for (const fx of fixtures) {
    const start = Date.now();
    try {
      const output = await runFixture(fx);
      const judged = await judgeFixture(fx, output);
      const passedCount = judged.filter((c) => c.passed).length;
      const score = judged.length === 0 ? 0 : passedCount / judged.length;
      const result: FixtureResult = {
        name: fx.name,
        category: fx.category,
        mode: fx.mode,
        score,
        passed: score === 1,
        criteria: judged,
        output,
        durationMs: Date.now() - start,
      };
      results.push(result);
      printFixtureLine(result, verbose);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        name: fx.name,
        category: fx.category,
        mode: fx.mode,
        score: 0,
        passed: false,
        criteria: [],
        output: {
          assistantText: "",
          toolCalls: [],
          systemPrompt: "",
          finishReason: undefined,
          model: "",
        },
        durationMs: Date.now() - start,
        error: message,
      });
      console.log(`  ✗ ${fx.name} — ERROR: ${message}`);
    }
  }

  const fixturesPassed = results.filter((r) => r.passed).length;
  const totalCriteria = results.reduce((acc, r) => acc + r.criteria.length, 0);
  const passedCriteria = results.reduce(
    (acc, r) => acc + r.criteria.filter((c) => c.passed).length,
    0,
  );
  const aggregateScore = totalCriteria === 0 ? 0 : passedCriteria / totalCriteria;

  const report: EvalRunReport = {
    runAt: new Date().toISOString(),
    gitSha: tryGitSha(),
    aggregateScore,
    fixtureCount: results.length,
    fixturesPassed,
    fixtures: results,
  };

  const baseline = loadBaseline(BASELINE_PATH);
  const diff = diffAgainstBaseline(baseline, report);

  printSummary(report, diff);

  if (updateBaseline) {
    saveBaseline(BASELINE_PATH, report);
    console.log(`\nBaseline updated: ${BASELINE_PATH}`);
  } else if (!baseline) {
    console.log(`\nNo baseline yet. Run with --update to save this result as the new baseline.`);
  }

  const hasErrors = results.some((r) => r.error);
  const hasRegressions = diff.newRegressions.length > 0;
  process.exit(hasErrors || hasRegressions ? 1 : 0);
}

function printFixtureLine(result: FixtureResult, verbose: boolean): void {
  const mark = result.passed ? "✓" : "✗";
  const pct = Math.round(result.score * 100);
  const passedCount = result.criteria.filter((c) => c.passed).length;
  const line = `  ${mark} [${result.category}] ${result.name}  ${passedCount}/${result.criteria.length} (${pct}%)  ${result.durationMs}ms`;
  console.log(line);
  if (!result.passed || verbose) {
    for (const c of result.criteria) {
      if (c.passed && !verbose) continue;
      const cmark = c.passed ? "·" : "✗";
      const expect = c.expect ? "expected TRUE" : "expected FALSE";
      console.log(`      ${cmark} ${expect}, observed ${c.observed ? "TRUE" : "FALSE"}`);
      console.log(`        ${c.criterion}`);
      console.log(`        → ${c.reasoning}`);
    }
  }
}

function printSummary(report: EvalRunReport, diff: ReturnType<typeof diffAgainstBaseline>): void {
  console.log(`\n${"─".repeat(72)}`);
  console.log(`Aggregate: ${report.fixturesPassed}/${report.fixtureCount} fixtures fully passed`);
  console.log(`Score: ${(report.aggregateScore * 100).toFixed(1)}% of criteria passed`);

  if (diff.hasBaseline) {
    const delta = diff.scoreDelta * 100;
    const arrow = delta > 0.1 ? "↑" : delta < -0.1 ? "↓" : "·";
    console.log(
      `vs baseline: ${arrow} ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%   ` +
        `regressions: ${diff.newRegressions.length}   new passing: ${diff.newPassing.length}`,
    );
    if (diff.newRegressions.length > 0) {
      console.log("\nRegressions:");
      for (const r of diff.newRegressions) {
        console.log(`  ✗ ${r.name}`);
      }
    }
    if (diff.newPassing.length > 0) {
      console.log("\nNow passing:");
      for (const p of diff.newPassing) {
        console.log(`  ✓ ${p.name}`);
      }
    }
  }
}

function tryGitSha(): string | null {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
