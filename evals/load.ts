import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import type { Fixture } from "./types";

/**
 * Load all fixtures from evals/fixtures/*.yaml. Each file defines exactly
 * one fixture. Throws with a clear message if any fixture fails basic
 * shape checks.
 */
export function loadFixtures(dir: string): Fixture[] {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort();

  return files.map((file) => {
    const path = join(dir, file);
    const raw = readFileSync(path, "utf8");
    let parsed: unknown;
    try {
      parsed = parse(raw);
    } catch (e) {
      throw new Error(`${file}: invalid YAML — ${(e as Error).message}`);
    }
    return validate(parsed, file);
  });
}

function validate(v: unknown, file: string): Fixture {
  if (!v || typeof v !== "object") {
    throw new Error(`${file}: root must be a mapping`);
  }
  const o = v as Record<string, unknown>;

  const name = requireString(o.name, `${file}: name`);
  const category = requireString(o.category, `${file}: category`);
  const mode = requireString(o.mode, `${file}: mode`);
  if (!["general", "goal", "reflection", "assessment"].includes(mode)) {
    throw new Error(`${file}: mode must be general|goal|reflection|assessment`);
  }

  const transcript = Array.isArray(o.transcript) ? o.transcript : [];
  if (transcript.length === 0) {
    throw new Error(`${file}: transcript must have at least one message`);
  }
  const msgs = transcript.map((m, i) => {
    if (!m || typeof m !== "object") {
      throw new Error(`${file}: transcript[${i}] must be a mapping`);
    }
    const mm = m as Record<string, unknown>;
    const role = mm.role;
    const text = mm.text;
    if (role !== "user" && role !== "assistant") {
      throw new Error(`${file}: transcript[${i}].role must be user|assistant`);
    }
    if (typeof text !== "string" || text.trim().length === 0) {
      throw new Error(`${file}: transcript[${i}].text must be a non-empty string`);
    }
    return { role: role as "user" | "assistant", text };
  });
  if (msgs[msgs.length - 1].role !== "user") {
    throw new Error(`${file}: final transcript message must be role=user`);
  }

  const rubric = Array.isArray(o.rubric) ? o.rubric : [];
  if (rubric.length === 0) {
    throw new Error(`${file}: rubric must have at least one criterion`);
  }
  const crits = rubric.map((c, i) => {
    if (!c || typeof c !== "object") {
      throw new Error(`${file}: rubric[${i}] must be a mapping`);
    }
    const cc = c as Record<string, unknown>;
    if (typeof cc.criterion !== "string" || cc.criterion.trim().length === 0) {
      throw new Error(`${file}: rubric[${i}].criterion must be a non-empty string`);
    }
    if (typeof cc.expect !== "boolean") {
      throw new Error(`${file}: rubric[${i}].expect must be a boolean`);
    }
    return { criterion: cc.criterion, expect: cc.expect };
  });

  const context =
    o.context && typeof o.context === "object" && !Array.isArray(o.context)
      ? (o.context as Record<string, unknown>)
      : {};

  const goalContext =
    o.goalContext && typeof o.goalContext === "object" && !Array.isArray(o.goalContext)
      ? (o.goalContext as Record<string, unknown>)
      : undefined;

  return {
    name,
    category,
    mode: mode as Fixture["mode"],
    goalContext: goalContext
      ? {
          primaryLens: goalContext.primaryLens as "self" | "others" | "org" | undefined,
          goalId: goalContext.goalId as string | undefined,
        }
      : undefined,
    context: context as Fixture["context"],
    transcript: msgs,
    rubric: crits,
  };
}

function requireString(v: unknown, label: string): string {
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(`${label} is required`);
  }
  return v;
}
