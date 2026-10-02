# Using chaff for AI evals

chaff can grade a model's outputs next to your model-graded scores.
The same output always gets the same result, every point names a line and a rule, and nothing is sent anywhere.
It does not judge meaning. Whether an answer is right stays with a model judge or a person.
This page shows what works today, step by step and with real output, and what is planned.

## What chaff can check in an output

| Question | Command | Fails with exit code 1 when |
| --- | --- | --- |
| Did a summary or a rewrite drop a fact, or invent one? | `npx chaffjs compare <source> <output> --json` | a number, date, URL, name or quotation was dropped or added |
| Are a RAG answer's quotations really in the source? | `npx chaffjs cite <source> <quotes.json> --format json` | a quotation is not at its address |
| Does the output contradict itself? | `npx chaffjs <output> --experimental` | a total is not the sum of its items, a date has the wrong weekday |
| Does it read as generated, or hard to read? | `npx chaffjs <output> --experimental --sarif <path>` | only `error` findings fail; the rest are counted |
| What should a regeneration step fix? | `npx chaffjs fix-plan <output> --experimental --json` | never; it is a set of instructions |

The plain check has no `--json`. Read its findings from SARIF, as shown under "Findings as SARIF" below.

## Before you start

You need Node.js 24 or later. `npx chaffjs` downloads chaff the first time.
For an eval you run again and again, add `chaffjs` to the project's dev dependencies.
Then every run uses the same version, and the same output keeps the same result.
A `chaff.yaml` in the folder you run from applies to every check, as in the [configuration guide](./configuration).

## A first eval run, step by step

1. **Put the outputs in a JSONL file,** one per line. `id` and `output` are required.
   Add `reference` to check facts against a source, and `source` with `citations` to check quotations.

   ```json
   {
     "id": "refund",
     "output": "You can ask for a refund within 30 days of delivery (2.1), and shipping is refunded too (2.2).",
     "source": "# Refund policy\n\n## 2. Refunds\n\n2.1 A customer may ask …",
     "citations": [{ "address": "2.1", "quote": "within 30 days of delivery" }]
   }
   ```

2. **Save the script below as `eval-chaff.mjs`.** It runs the commands above on each line and adds up the results.
3. **Run it on one file, or on two to compare them.**
   `prompt-a.jsonl` and `prompt-b.jsonl` hold two prompts' outputs for the same three tasks, from Examples 1 to 3 below.

   ```
   $ node eval-chaff.mjs prompt-a.jsonl prompt-b.jsonl
   {"run":"prompt-a.jsonl","id":"deploy","pass":true,"words":61,"findings":0,"dropped":[],"added":[],"unsupported":0}
   {"run":"prompt-a.jsonl","id":"q3","pass":true,"words":39,"findings":0,"dropped":[],"added":[],"unsupported":0}
   {"run":"prompt-a.jsonl","id":"refund","pass":true,"words":17,"findings":0,"dropped":[],"added":[],"unsupported":0}
   {"run":"prompt-b.jsonl","id":"deploy","pass":true,"words":107,"findings":6,"dropped":[],"added":[],"unsupported":0}
   {"run":"prompt-b.jsonl","id":"q3","pass":false,"words":33,"findings":0,"dropped":["6","2.5","July 14, 2026"],"added":["July 1, 2026"],"unsupported":0}
   {"run":"prompt-b.jsonl","id":"refund","pass":false,"words":18,"findings":0,"dropped":[],"added":[],"unsupported":1}
   rule (per 1000 words)	prompt-a.jsonl	prompt-b.jsonl
   ai-generated-composite	0.0	6.3
   ai-tell	0.0	6.3
   closing-cliche	0.0	12.7
   contraction-consistency	0.0	6.3
   padded-intro	0.0	6.3
   passed	3/3	1/3
   ```

4. **Read the result.** Each JSON line is one output. `dropped` and `added` are facts from `compare`, and `unsupported` counts quotations `cite` could not find.
   The table gives each rule's findings per 1000 words over the whole run, so long and short outputs are measured alike.
5. **Decide pass or fail.** In this script an output fails on an `error` finding, a dropped or added fact, or an unsupported quotation.
   Style findings do not fail an output. They are a rate to compare between prompts or models.
   The script ends with exit code 1 when any output failed, so CI can stop on it. Change the `pass` line to fit your eval.

```js
// node eval-chaff.mjs run-a.jsonl [run-b.jsonl ...]
// Each line: {"id", "output", "reference"?, "source"?, "citations"?}
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "chaff-eval-"));
const chaff = (...args) => spawnSync("npx", ["chaffjs", ...args], { encoding: "utf8" });
const save = (name, text) => {
  writeFileSync(join(dir, name), text);
  return join(dir, name);
};
const words = (text) => text.split(/\s+/).filter(Boolean).length;

const lint = (id, file) => {
  const sarif = join(dir, `${id}.sarif`);
  chaff(file, "--experimental", "--sarif", sarif);
  const results = JSON.parse(readFileSync(sarif, "utf8")).runs[0].results;
  return results.map((result) => ({ rule: result.ruleId.replace("chaff/", ""), level: result.level }));
};

const compare = (id, reference, file) => {
  const facts = JSON.parse(chaff("compare", save(`${id}.ref.md`, reference), file, "--json").stdout);
  return { dropped: facts.dropped.map((fact) => fact.text), added: facts.added.map((fact) => fact.text) };
};

const cite = (id, source, citations) => {
  const args = ["cite", save(`${id}.src.md`, source), save(`${id}.quotes.json`, JSON.stringify(citations))];
  return JSON.parse(chaff(...args, "--format", "json").stdout).filter((check) => check.status !== "ok").length;
};

const grade = (item) => {
  const file = save(`${item.id}.md`, item.output);
  const findings = lint(item.id, file);
  const facts = item.reference ? compare(item.id, item.reference, file) : { dropped: [], added: [] };
  const unsupported = item.source ? cite(item.id, item.source, item.citations) : 0;
  const errors = findings.filter((finding) => finding.level === "error").length;
  const pass = errors === 0 && facts.dropped.length + facts.added.length + unsupported === 0;
  return { id: item.id, pass, words: words(item.output), findings, ...facts, unsupported };
};

const rates = (rows) => {
  const total = rows.reduce((sum, row) => sum + row.words, 0);
  const counts = rows.flatMap((row) => row.findings).reduce((acc, { rule }) => ({ ...acc, [rule]: (acc[rule] ?? 0) + 1 }), {});
  return Object.fromEntries(Object.entries(counts).map(([rule, count]) => [rule, (count * 1000) / total]));
};

const runs = process.argv.slice(2).map((path) => {
  const rows = readFileSync(path, "utf8").split("\n").filter(Boolean).map((line) => grade(JSON.parse(line)));
  rows.forEach((row) => console.log(JSON.stringify({ run: path, ...row, findings: row.findings.length })));
  return { path, passed: rows.filter((row) => row.pass).length, total: rows.length, rates: rates(rows) };
});

const rules = [...new Set(runs.flatMap((run) => Object.keys(run.rates)))].sort();
console.log(["rule (per 1000 words)", ...runs.map((run) => run.path)].join("\t"));
rules.forEach((rule) => console.log([rule, ...runs.map((run) => (run.rates[rule] ?? 0).toFixed(1))].join("\t")));
console.log(["passed", ...runs.map((run) => `${run.passed}/${run.total}`)].join("\t"));
process.exitCode = runs.every((run) => run.passed === run.total) ? 0 : 1;
```

The script reads the output files that chaff writes, so the same rules run as on the command line.
It counts words by spaces, which suits English; for Japanese, count characters instead.

## Example 1: is a summary faithful?

The source, `source.md`, is a short support report. Two models summarized it.

```markdown
# Support report, third quarter

The support team answered 4,812 tickets this quarter.
The median first reply fell from 6 hours to 2.5 hours.
The new help center opened on July 14, 2026.
Two people joined in August, and the team now has 11 members.
```

Model A (`model-a.md`) kept every figure. Model B (`model-b.md`) dropped the reply times and wrote the wrong date.

```markdown
# In short

The team answered 4,812 tickets, and first replies got much faster.
A help center opened on July 1, 2026, and after two hires in August the team has 11 members.
```

`compare` reads the facts out of both texts the same way, and lists what is missing or new.

```
$ npx chaffjs compare source.md model-a.md
source.md → model-a.md

i 1 fact written another way
  heading: Support report, third quarter → In short  (line 1 → line 1)

Facts checked: 7 → 7: numbers 4→4, dates 1→1, times 0→0, URLs 0→0, code 0→0, names 1→1, quotations 0→0, headings 1→1, references 0→0, footnotes 0→0
No fact dropped or added
```

```
$ npx chaffjs compare source.md model-b.md
source.md → model-b.md

✗ 3 facts dropped (in source.md, not in model-b.md)
  number: 6  (source.md:4)
  number: 2.5  (source.md:4)
  date: July 14, 2026  (source.md:5)

✗ 1 fact added (only in model-b.md)
  date: July 1, 2026  (model-b.md:4)

i 1 fact written another way
  heading: Support report, third quarter → In short  (line 1 → line 1)

Facts checked: 7 → 5: numbers 4→2, dates 1→1, times 0→0, URLs 0→0, code 0→0, names 1→1, quotations 0→0, headings 1→1, references 0→0, footnotes 0→0
3 facts dropped, 1 fact added
```

The first run ends with exit code 0, the second with 1. With `--json`, each fact comes with its kind, its text and its line.
A summary may leave out a kind of fact on purpose; `--allow-dropped name,url` stops those kinds from failing it.
The full description is in the [command list](./commands) under `compare`.

## Example 2: are a RAG answer's quotations in the source?

The source, `policy.md`, is a refund policy with numbered clauses.

```markdown
# Refund policy

## 1. Scope

This policy covers orders placed on the web store.

## 2. Refunds

2.1 A customer may ask for a refund within 30 days of delivery.

2.2 Shipping fees are not refunded.

2.3 A refund is paid to the original card within 10 business days.
```

The answer quoted two clauses. Ask the model to return its quotations as JSON next to the answer (`quotes.json`).
chaff does not guess which sentences of an answer are quotations.

```json
[
  { "address": "2.1", "quote": "within 30 days of delivery" },
  { "address": "2.2", "quote": "Shipping fees are refunded in full." }
]
```

```
$ npx chaffjs cite policy.md quotes.json
✓ 2.1 "within 30 days of delivery": matches
✗ 2.2 "Shipping fees are refunded in full.": the quotation is nowhere in the source
```

The run ends with exit code 1. `--format json` gives each quotation a `status` (`ok`, or why it failed) and the line where it was found.
Spaces and full-width characters do not matter, but a changed word does. How addresses are read is in [Structure and quotations](./structure).

## Example 3: comparing two prompts on style

Two prompts answered the same task: explain why Tuesday's deploy failed. Prompt A gave this answer (`prompt-a.md`).

```markdown
# Why the deploy failed

The deploy on Tuesday stopped at the database step.
A migration added a column with a default value, and on our largest table that locked writes for four minutes.
The health check gave up after two minutes and rolled the release back.
We will add the column without a default first, then fill it in batches.
```

Prompt B gave this one (`prompt-b.md`).

```markdown
# Why the deploy failed

In today's fast-paced world of software delivery, every deploy plays a crucial role.
Let's delve into what happened on Tuesday.

**It wasn't a code problem. It was a database problem.**
A migration added a column with a default value — and on our largest table, that locked writes for four minutes.
The health check gave up after two minutes — and rolled the release back.

The fix is a testament to careful engineering: we will meticulously add the column without a default, then fill it in batches.

In conclusion, robust migrations are the key to a seamless pipeline. I hope this helps!
```

Run both with the experimental rules, which include the signals of generated text.

```
$ npx chaffjs prompt-a.md --experimental --compact

prompt-a.md   blog/tech · English   genre from the default


0 findings, 17 rules not run
```

```
$ npx chaffjs prompt-b.md --experimental --compact

prompt-b.md   blog/tech · English   genre from the default

  3:1     info    "delve into, in today's fast-paced world, plays a crucial role, a testament to, meticulously" appear together (score 39, limit 18)
                  ai-tell
  3:1     warning "in today's fast-paced world" is an opening that fits any article
                  padded-intro
  3:1     warning "ai-tell, padded-intro, closing-cliche" occur together in this document (3 signals, 3 needed)
                  ai-generated-composite
  6:3     info    "wasn't" is written differently from the rest of the document
                  contraction-consistency
  12:1    warning Closes with "in conclusion"
                  closing-cliche
  12:70   warning Closes with "hope this helps"
                  closing-cliche

6 findings, 17 rules not run
```

Across many tasks, compare the rates rather than single outputs. The table from the script in step 3 puts them side by side.
The rules not run are the Japanese-only rules and one rule that reads meaning. Without `--compact`, each is listed with its reason.

To feed the findings back into a regeneration step, have `fix-plan` turn them into instructions.
This is an excerpt; the plan goes on with a direction, an example and the spots for each rule.

````
$ npx chaffjs fix-plan prompt-b.md --experimental
# Fix plan: prompt-b.md

language en, genre blog/tech

What chaff found by machine, and how to rewrite each kind of spot. chaff does not rewrite; whoever reads this plan does, a person or an AI. When done, run the checks at the end.

## Constraints

1. Keep every fact, number, date, condition and name.
2. Add no fact, person, number, cause or example the original does not have.
3. Where a fix needs a specific the text does not give (who, when, how much), do not invent it: leave [ ] and ask the writer.
4. At most two passes. Do not rewrite again just to silence a finding.

## Recommended way: Full rewrite

ai-generated-composite fires. Fixing the wording would leave the skeleton of generated text.
…
## Check after rewriting

Save the rewrite as prompt-b.rewritten.md and run:

```bash
npx chaffjs prompt-b.rewritten.md --experimental
npx chaffjs compare prompt-b.md prompt-b.rewritten.md --distinct --allow-dropped heading --allow-added heading
npx chaffjs outline prompt-b.md prompt-b.rewritten.md
```
…
````

`--json` gives the same plan as JSON, to put into the next prompt. The last check, `compare`, confirms the regenerated text kept the facts.
How to rewrite from a plan is in [Making AI-sounding text sound human](./ai-sounding).

## Example 4: an answer that contradicts itself

A model wrote this quote (`answer.md`). Its total does not add up, and the weekday does not match the date.

```markdown
# Your quote

| Item | Price |
| --- | --- |
| Design | $400 |
| Build | $1,200 |
| Total | $1,500 |

We can start on Monday, October 6, 2026.
```

```
$ npx chaffjs answer.md --experimental --compact

answer.md   blog/tech · English   genre from the default

  7:12    error   The total $1,500 is not the sum of the amounts above it ($1,600)
                  total-mismatch
  9:25    error   2026-10-06 is a Tuesday, not a Monday
                  date-weekday-mismatch

2 findings, 17 rules not run
```

These findings are errors, so the run ends with exit code 1 and the script fails the output.
The rules are experimental. Without `--experimental` they do not run, and the last line says so (`0 findings, 69 rules not run`).

## Findings as SARIF

`--sarif` writes the findings of every file checked to one SARIF file. The screen output does not change.

```
$ npx chaffjs prompt-b.md --experimental --compact --sarif out/prompt-b.sarif
  Wrote SARIF: out/prompt-b.sarif (6 findings)

prompt-b.md   blog/tech · English   genre from the default

  3:1     info    "delve into, in today's fast-paced world, plays a crucial role, a testament to, meticulously" appear together (score 39, limit 18)
                  ai-tell
…
```

Each finding is one entry in `runs[0].results`, with the rule, the level and the place. This is the first one.

```json
{
  "ruleId": "chaff/ai-tell",
  "level": "note",
  "message": {
    "text": "\"delve into, in today's fast-paced world, plays a crucial role, a testament to, meticulously\" appear together (score 39, limit 18)"
  },
  "locations": [
    {
      "physicalLocation": {
        "artifactLocation": {
          "uri": "prompt-b.md"
        },
        "region": {
          "startLine": 3,
          "startColumn": 1
        }
      }
    }
  ]
}
```

The levels are `error`, `warning` and `note` (chaff's `info`). The same file shows findings on a pull request, as in [CI](./ci).

## Planned: `chaff grade` and the rest (#488)

Nothing in this section works yet. It shows how the planned commands will be used, so that a harness written today can move to them.
The design is in the specification, section 29, and the work is tracked in [#488](https://github.com/isamu/lab/issues/488).

**`chaff grade`** will do what the script above does, in one command. Its input is the same kind of JSONL.
`sources` will name several sources, and each citation will say which source it quotes.

```bash
npx chaffjs grade items.jsonl                       # pass or fail, and the rates, on screen
npx chaffjs grade items.jsonl --out results.jsonl   # one result per output, as JSONL
```

Each result line will hold the findings, each rule's rate, the rules not run with the reason, and the dropped and added facts.
It will also hold the failed quotations, pass or fail with the reasons, and a stamp.
The exit code will be 0 when every output passes, 1 when one fails, and 2 when the input cannot be read.

**A rubric in `chaff.yaml`** will say what fails an output and what each finding costs.
The score will be a sum of penalty points, and each point will name the finding it came from.
With no `grade:` section, there will be no score, only pass or fail and the rates.

```yaml
grade:
  rules:
    total-mismatch: { max: 0 } # one finding fails the output
    closing-cliche: { max: 0, weight: 3 } # fails, and costs 3 points each
    ai-tell: { max_rate: 5, weight: 2 } # fails above 5 per 1000 words
    max-sentence-length: { weight: 1 } # never fails, costs 1 point each
  required_sections: [Summary, Evidence]
  facts: { dropped: 0, added: 0, allow_dropped: [heading] }
  citations: { failed: 0, required: true }
  penalty: 10 # fails when the points add up to more than this
```

**A/B and regressions.** `--baseline` will compare a run with an earlier run's results, output by output (matched by `id`).
A regression will be an output that passed and now fails, a rubric rule with more findings, or a higher penalty total.
The exit code will be 1 on a regression, so CI can stop a prompt or model change.
When the rules or the settings differ between the two runs, it will refuse to compare, since the difference would not come from the model.

```bash
npx chaffjs grade prompt-a.jsonl --out a.results.jsonl
npx chaffjs grade prompt-b.jsonl --baseline a.results.jsonl
```

**The stamp** on every result will hold the chaff version, a hash of the rule set and a hash of the settings.
Only results with the same rule set and settings will be compared.

**A library function** will let an in-process harness skip the shell. Where it is exported from is still open.

```js
import { grade } from "chaffjs/api";

const result = await grade(output, { reference: source, language: "en" });
if (!result.pass) console.log(result.failedBecause);
```

**Integrations** will call `grade()` or `chaff grade` and keep no framework code inside chaff.

| Framework | How it will connect |
| --- | --- |
| promptfoo | A `javascript` assertion that calls `grade()` and returns `pass`, a score of 1 or 0, and the reasons |
| Inspect AI | A scorer that runs `chaff grade` and turns a result line into a `Score` and its explanation |
| OpenAI Evals, LangSmith | The JSONL above as the contract, and a result line as feedback |
| GitHub Action | `chaff grade --baseline` in a workflow, failing the job on a regression |

## What chaff will not do here

- **Grade with a model.** Grading stays deterministic. `chaff test`, which asks a model, stays a separate command and is never called by grading.
- **Rewrite the output.** `fix-plan` gives instructions; your regeneration step does the rewriting.
- **Say an output was written by AI.** `ai-generated-composite` is a signal to count, not a verdict.
- **Ship weights or a full score.** Your team decides the cost of each finding, and writes it in `chaff.yaml`.
