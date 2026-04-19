# Coaching Evals

A fixture-based eval harness for the LeadAcademy coach. Lets you change a
prompt, run `pnpm eval`, and know within minutes whether quality moved up,
down, or sideways against a stored baseline.

## Running

```bash
pnpm eval                      # run all fixtures, compare against baseline
pnpm eval -- --verbose         # print all criteria (pass + fail)
pnpm eval -- --filter grounds  # run only fixtures whose name matches
pnpm eval -- --update          # save the current run as the new baseline
```

Exit code is `1` if any fixture errored or regressed against the baseline.

## What's in a fixture

One YAML file per fixture in `evals/fixtures/`. Each file describes:

- **A scenario** — mode (general/goal/reflection/assessment), optional goal
  context, a partial `LearnerContext` that seeds what the coach "knows"
- **A transcript** — the conversation leading up to the moment under test.
  The last message must be `role: user` — the coach's response to that
  message is what gets evaluated.
- **A rubric** — list of natural-language criteria, each with an `expect:
  true | false`. Each one is a separate pass/fail check.

### Example

```yaml
name: grounds in specific named goal when learner references it vaguely
category: context_grounding
mode: general

context:
  identity:
    name: Alex
  goals:
    - id: 11111111-1111-1111-1111-111111111111
      title: Delegate the Q2 launch retro to Maria
      primaryLens: others
      status: in_progress
      actionCount: 3
      daysSinceLastAction: 5
      targetDate: null
      activeFocusUntil: null
      smartCriteria: null

transcript:
  - role: user
    text: "I'm hitting a wall with the Maria thing again."

rubric:
  - expect: true
    criterion: "The coach's response references the delegation goal by name OR references Maria specifically."
  - expect: false
    criterion: "The coach asks a clarifying question about who Maria is."
```

## How it works

1. **Runner** (`runner.ts`) reconstructs the same system prompt the
   production chat route builds — PERSONA + mode prompt + formatted
   `LearnerContext` — with the fixture's context substituted for the real
   DB-loaded one. It registers all 9 tools with eval-safe mock handlers
   that record rather than write. Calls Sonnet 4.6 via `generateText`.

2. **Judge** (`judge.ts`) sends the transcript, the coach's response, the
   tool calls made, and the rubric to Opus 4.6 via `generateObject`. Opus
   returns a structured verdict per criterion: `{observed: boolean,
   reasoning: string}`. A criterion passes when `observed === expect`.

3. **Baseline** (`baseline.ts`) persists the last accepted run to
   `evals/baseline.json`. Subsequent runs diff against it and highlight
   regressions (fixtures that used to pass and now don't) and
   improvements (the inverse).

## Authoring fixtures

- Pull real moments from conversations you've had with the coach — either
  live with a learner, or from `ai_messages` in prod.
- Write the rubric tight. "The coach is helpful" is unjudgeable; "The
  coach uses the phrase 'safety net' at least once" is judgeable.
- For tool-related criteria: be specific about expected inputs. "Calls
  log_action" is weaker than "Calls log_action with goal_id=...".
- Mix `expect: true` and `expect: false`. Both matter.
- Keep each fixture focused. A single fixture is one scenario with 1-4
  closely-related criteria. Don't try to test everything at once.

## Categories used today

- `context_grounding` — does the coach use the context it's given
- `tool_triggering` — does the right tool fire when it should
- `tool_restraint` — does the wrong tool NOT fire when it shouldn't
- `tone_language` — tendency language for PI, no therapy-speak, etc.
- `mode_boundaries` — goal mode pushes three lenses, reflection mode
  doesn't race to solutions
- `anti_patterns` — no AI identity leak, no phantom memories, no prompt
  leak
