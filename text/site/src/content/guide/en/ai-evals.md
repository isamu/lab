# Using chaff for AI evals

chaff can grade a model's outputs next to your model-graded scores.
The same output always gets the same result, every point names a line and a rule, and nothing is sent anywhere.
It does not judge meaning. Whether an answer is right stays with a model judge or a person.
This page shows how, step by step and with real output.
It covers grading a file of outputs, a rubric, comparing two runs, a library call and the eval frameworks it plugs into.

## What chaff can check in an output

| Question | Command | Fails with exit code 1 when |
| --- | --- | --- |
| Did a summary or a rewrite drop a fact, or invent one? | `npx chaffjs compare <source> <output> --json` | a number, date, URL, name or quotation was dropped or added |
| Are a RAG answer's quotations really in the source? | `npx chaffjs cite <source> <quotes.json> --format json` | a quotation is not at its address |
| Does the output contradict itself? | `npx chaffjs <output>` | a total is not the sum of its items, a date has the wrong weekday |
| Does it read as generated, or hard to read? | `npx chaffjs <output> --sarif <path>` | only `error` findings fail; the rest are counted |
| All of the above, for a file of outputs | `npx chaffjs grade <items.jsonl> --out <results.jsonl>` | an output failed (2 when the input cannot be read) |
| What should a regeneration step fix? | `npx chaffjs fix-plan <output> --json` | never; it is a set of instructions |

For many outputs, use `chaff grade`, below. The plain check has no `--json`; read its findings from SARIF, as shown under "Findings as SARIF".

## Before you start

You need Node.js 24 or later. `npx chaffjs` downloads chaff the first time.
For an eval you run again and again, add `chaffjs` to the project's dev dependencies.
Then every run uses the same version, and the same output keeps the same result.
A `chaff.yaml` in the folder you run from applies to every check, as in the [configuration guide](./configuration).

## A first eval run with `chaff grade`

1. **Put the outputs in a JSONL file,** one per line. `id` and `output` are required.
   Add `reference` to check facts against the text the output was made from.
   To check quotations, add `sources` (each source's name and text) and `citations`.
   A citation without `source` quotes the only source.

   ```json
   {
     "id": "refund",
     "output": "You can ask for a refund within 30 days of delivery (2.1), and shipping is refunded too (2.2).",
     "sources": { "policy": "# Refund policy\n\n## 1. Scope\n…" },
     "citations": [
       { "address": "2.1", "quote": "within 30 days of delivery" },
       { "address": "2.2", "quote": "Shipping fees are refunded in full." }
     ]
   }
   ```

   chaff does not guess which sentences of an output are quotations. Ask the model to return them next to its answer.
   `language` and `genre` may be set per output; otherwise they are found as for any file.

2. **Grade the file.** `prompt-a.jsonl` and `prompt-b.jsonl` hold two prompts' outputs for the same three tasks, from Examples 1 to 3 below.
   `--out` writes one result per output; the screen shows the summary.

   ```
   $ npx chaffjs grade prompt-b.jsonl --out b.results.jsonl
   Wrote one result per output: b.results.jsonl (3 lines)
   prompt-b.jsonl: 3 outputs, 1 passed, 2 failed

   Failed outputs
     ✗ q3: facts.dropped 3 > 0, facts.added 1 > 0
     ✗ refund: citations.failed 1 > 0

   Rule rates (per 1,000 words, outputs with a finding)
     ai-generated-composite   6.7   1 output
     ai-tell                  6.7   1 output
     closing-cliche           13.3  1 output
     contraction-consistency  6.7   1 output
     padded-intro             6.7   1 output

   Facts: 3 dropped (date 1, number 2), 1 added (date 1)
   Quotations: 2 checked, 1 failed

   …
     {not-run: cite}
   …
     {not-run: compare}
   …
   ```

3. **Read the result.** An output fails on an `error` finding, a fact dropped or added against `reference`, or a quotation not found.
   Style findings never fail an output. They are a rate per 1,000 words (characters for Japanese), to compare prompts or models.
   "Not run" says what was not checked and why, so that 0 findings is never read as "checked and fine".
   `--compact` gives one line per output, for a CI log, and `--json` gives the summary as JSON.

   ```
   $ npx chaffjs grade prompt-b.jsonl --compact
   q3	fail	facts.dropped 3 > 0, facts.added 1 > 0
   refund	fail	citations.failed 1 > 0
   deploy	pass
   prompt-b.jsonl: 3 outputs, 1 passed, 2 failed
   ```

4. **Use the exit code.** 0 when every output passed, 1 when one failed.
   2 when the input or `chaff.yaml` cannot be read: a line that is not JSON, a missing or repeated `id`, an unknown language.
   A gate that sees 2 knows the grader did not run, not that the outputs are bad.

Each line of `b.results.jsonl` holds one output's findings, rates, rules not run, facts and quotations.
It also holds pass or fail with the reasons, and the stamp. This is the start of the first line:

```json
{"id":"q3","language":"en","genre":"blog/tech","size":{"unit":"word","value":30},"findings":[],"rates":{},"notRun":[…],
 "facts":{"dropped":[{"kind":"number","key":"6 hours","text":"6","line":4,"allowed":false},…],"added":[…],"reformed":1},
 "citations":null,"pass":false,"failedBecause":["facts.dropped 3 > 0","facts.added 1 > 0"],"stamp":{…}}
```

The stamp holds the chaff version, a hash of the rules and a hash of the settings. Two runs are comparable when the two hashes match.

## A rubric in chaff.yaml

With a `grade:` section in `chaff.yaml`, only what it names decides pass or fail, and each output gets penalty points.

```yaml
grade:
  rules:
    total-mismatch: { max: 0 } # one finding fails the output
    closing-cliche: { max: 0, weight: 3 } # fails, and costs 3 points each
    ai-tell: { max_rate: 5, weight: 2 } # fails above 5 per 1,000 words (characters for Japanese)
  facts: { dropped: 0, added: 0, allow_dropped: [heading] }
  citations: { failed: 0, required: true } # required: an output with sources but no citations fails
  penalty: 10 # fails when the points add up to more than this
```

<!-- chaff-screen: rubric -->
```
$ npx chaffjs grade prompt-b.jsonl --compact
q3	fail	penalty 0	facts.dropped 3 > 0, facts.added 1 > 0
refund	fail	penalty 0	citations.failed 1 > 0
deploy	fail	penalty 8	rules.closing-cliche 2 > 0, rules.ai-tell.rate 9.804 > 5
prompt-b.jsonl: 3 outputs, 0 passed, 3 failed
```

The score is a sum of penalty points, never a mark out of a maximum. Each point names its finding (`deploy`'s result line):

```json
"score": { "penalty": 8, "items": [
  { "points": 2, "rule": "ai-tell", "line": 3 },
  { "points": 3, "rule": "closing-cliche", "line": 12 },
  { "points": 3, "rule": "closing-cliche", "line": 12 } ] }
```

Without `grade:` there is no score. A value chaff cannot read in `grade:` stops the run with exit 2 and names its place.
A rule chaff does not know is reported, and listed as not run.

## Comparing two runs: `--baseline`

Grade the earlier prompt with `--out`, then grade the new one against it. Outputs are paired by `id`.

```
$ npx chaffjs grade prompt-a.jsonl --out a.results.jsonl
$ npx chaffjs grade prompt-b.jsonl --baseline a.results.jsonl
…the summary, as above…

Compared with a.results.jsonl: 3 paired outputs

Rule rates (per 1,000 words, before → after)
  ai-generated-composite   0.0 → 6.7  (+6.7)  more in deploy
  ai-tell                  0.0 → 6.7  (+6.7)  more in deploy
  closing-cliche           0.0 → 13.3  (+13.3)  more in deploy
  contraction-consistency  0.0 → 6.7  (+6.7)  more in deploy
  padded-intro             0.0 → 6.7  (+6.7)  more in deploy

Newly failed: q3, refund
Newly passed: none

New dropped or added facts, and new failed quotations
  q3: dropped number 6, number 2.5, date July 14, 2026; added date July 1, 2026
  refund: dropped none; added none; failed quotations policy 2.2

2 regressions
  ✗ q3: passed, now fails
  ✗ refund: passed, now fails
```

A regression is any of these:
- an output that passed and now fails;
- a rule under `grade.rules` with more findings in some output;
- a higher penalty total.

With `--baseline`, the exit code is 1 on a regression and 0 without one, so CI can stop a prompt or model change.
Rules outside the rubric are shown but never count as a regression.

The two runs must have the same rules and settings. Otherwise chaff refuses, so that a change of settings is not read as a change of model:

```
$ npx chaffjs grade prompt-b.jsonl --baseline a.results.jsonl
Not compared with a.results.jsonl: the settings differ. A change of rules or settings would read as a change of prompt or model (--allow-stamp-mismatch compares anyway)
```

The run ends with exit code 2. Here `rules:` in `chaff.yaml` was changed after the earlier run.

## Comparing prompts or models side by side: variants

`--baseline` compares one run with an earlier one. To compare several prompts or models in one run, put all their outputs in one file and label each line with its variant.
Give the lines of the same task the same `id`.

```json
{"id": "q3", "variant": "prompt-a", "output": "# In short\n\nThe team answered 4,812 tickets, and the median first reply fell from 6 hours to 2.5 hours.\n…", "reference": "# Support report, third quarter\n…"}
{"id": "q3", "variant": "prompt-b", "output": "# In short\n\nThe team answered 4,812 tickets, and first replies got much faster.\n…", "reference": "# Support report, third quarter\n…"}
```

`variants.jsonl` holds the two prompts' outputs for the three tasks of Examples 1 to 3.
In `prompt-a`'s refund answer, the second quotation is the clause as written, "Shipping fees are not refunded."
chaff prints the usual summary, then the variants side by side:

```
$ npx chaffjs grade variants.jsonl --experimental
variants.jsonl: 6 outputs, 4 passed, 2 failed

Failed outputs
  ✗ q3 (prompt-b): facts.dropped 3 > 0, facts.added 1 > 0
  ✗ refund (prompt-b): citations.failed 1 > 0
…

2 variants side by side: 3 outputs with an id every variant has
                     prompt-a    prompt-b
  Passed             3/3 (100%)  1/3 (33.3%)
  Facts dropped      0           3
  Facts added        0           1
  Quotations failed  0/2         1/2

Rule rates (per 1,000 words)
                           prompt-a  prompt-b
  ai-generated-composite   0.0       6.7
  ai-tell                  0.0       6.7
  closing-cliche           0.0       13.3
  contraction-consistency  0.0       6.7
  padded-intro             0.0       6.7

2 outputs where pass or fail differs
  ✗ q3: passed in prompt-a; failed in prompt-b (facts.dropped 3 > 0, facts.added 1 > 0)
  ✗ refund: passed in prompt-a; failed in prompt-b (citations.failed 1 > 0)
```

How to read it:
- Every column counts the same tasks: only an `id` that every variant answered, in the same language and genre. Any other id is listed under "Ids not compared", with the variants it is missing from.
- "Quotations failed" is failed out of checked. Facts are counted as in the summary, leaving out the kinds the rubric allows.
- When outputs carry `contexts`, an "Unsupported facts" row gives the facts found in no retrieved passage out of those checked.
- With a `grade:` rubric, a "Penalty points" row adds up each variant's points.
- The pass rate is a share of outputs, not a score. chaff still gives no mark out of a maximum.

When the label is in another field, name it: `--variant-key model` or `--variant-key prompt`. Then every line must have that field.
A line without a label in a labelled file, or an `id` twice in one variant, ends the run with exit code 2.
The exit code is otherwise the same as without variants, and `--baseline` pairs each output with the same `id` and variant of the earlier run.

For a CI log, `--compact` adds one line per disagreement:

```
$ npx chaffjs grade variants.jsonl --experimental --compact
…
disagree	q3	pass prompt-a	fail prompt-b
disagree	refund	pass prompt-a	fail prompt-b
2 outputs where pass or fail differs
```

For a pull request comment, `--format markdown` writes the same tables in Markdown. `--format json` adds a `variants` field to the summary.

```
$ npx chaffjs grade variants.jsonl --experimental --format markdown
## chaff grade: variants.jsonl

6 outputs, 4 passed, 2 failed
…
### 2 variants side by side: 3 outputs with an id every variant has

|  | prompt-a | prompt-b |
| --- | --- | --- |
| Passed | 3/3 (100%) | 1/3 (33.3%) |
| Facts dropped | 0 | 3 |
| Facts added | 0 | 1 |
| Quotations failed | 0/2 | 1/2 |
…
```

In a harness, pass `variant` to `grade()` and hand the results to `compareVariants()`, which returns what `--format json` puts under `variants`:

```js
import { compareVariants, grade } from "chaffjs/grade";

const results = [
  await grade(answerA, { id: "q3", variant: "prompt-a", reference }),
  await grade(answerB, { id: "q3", variant: "prompt-b", reference }),
];
const { columns, disagreements } = compareVariants(results);
console.log(columns.map((column) => `${column.variant} ${column.passed}/${column.outputs}`)); // [ 'prompt-a 1/1', 'prompt-b 0/1' ]
```

`compareVariants({ "prompt-a": resultsA, "prompt-b": resultsB })` takes the results grouped by variant instead.

## Example 1: is a summary faithful?

The source, `source.md`, is a short support report. Two models summarized it.

```markdown file=source.md
# Support report, third quarter

The support team answered 4,812 tickets this quarter.
The median first reply fell from 6 hours to 2.5 hours.
The new help center opened on July 14, 2026.
Two people joined in August, and the team now has 11 members.
```

Model A (`model-a.md`) kept every figure. Model B (`model-b.md`) dropped the reply times and wrote the wrong date.

```markdown file=model-b.md
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

```markdown file=policy.md
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

```json file=quotes.json
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

## Is a RAG answer supported by its retrieved passages? `contexts`

`citations` checks the quotations an answer claims. Often the answer claims none, and what you have is the passages the retriever handed the model.
Put them in `contexts`, and chaff looks for each checkable fact of the answer in them: numbers, dates, times, URLs, code, names and quotations.
It reads the facts as `compare` does, so `$12` in the answer and `$12` in a passage are the same fact however they are written.
A quotation counts as supported only when some passage has it word for word.

`rag.jsonl` holds three answers about one product, with the same two passages for the first two and none found for the third:

```json
{"id": "pricing", "output": "The Team plan costs $12 per user per month and includes 100 GB of storage per user. Support answers within 4 business hours.", "contexts": ["# Plans\n\nThe Team plan costs $12 per user per month, billed yearly.\nIt includes 100 GB of storage per user.", "# Support\n\nSupport answers within 4 business hours on the Team plan.\nThe help center moved to help.example.com on March 3, 2026."]}
{"id": "pricing-wrong", "output": "The Team plan costs $15 per user per month and includes 100 GB of storage. The docs say \"support answers within one hour\". The help center moved on March 3, 2026. It is a good choice for most teams.", "contexts": ["…the same two passages…"]}
{"id": "nothing-found", "output": "The Enterprise plan costs $40 per user per month.", "contexts": []}
```

```
$ npx chaffjs grade rag.jsonl --out rag.results.jsonl
Wrote one result per output: rag.results.jsonl (3 lines)
rag.jsonl: 3 outputs, 1 passed, 2 failed

Failed outputs
  ✗ pricing-wrong: contexts.unsupported 2 > 0
  ✗ nothing-found: contexts.unsupported 2 > 0

Facts: 0 dropped, 0 added
Quotations: 0 checked, 0 failed
Contexts: 13 facts checked in 3 outputs, 4 in no passage (name 1, number 2, quote 1)
…
```

The result line of `pricing-wrong` says which facts were found, in which passage (counted from 0), and which were not:

```json
"contexts": {"passages":2,"checked":6,
 "supported":[{"kind":"date","text":"March 3, 2026","line":1,"passage":1},{"kind":"number","text":"100","line":1,"passage":0},…],
 "unsupported":[{"kind":"number","key":"15 $","text":"15","line":1,"allowed":false},
                {"kind":"quote","key":"support answers within one hour","text":"\"support answers within one hour\"","line":1,"allowed":false}],
 "uncheckedSentences":1}
```

- `$15` is in no passage, and the quotation is not in any passage word for word. Without a `grade:` rubric, either one fails the output.
- An empty `contexts` means retrieval found nothing, so every checked fact of `nothing-found` is unsupported. Leaving `contexts` out is different: the check does not run, and "not run" says so.
- "It is a good choice for most teams." states no fact chaff can check. `uncheckedSentences` counts it, and "not run" lists it under `contexts`: whether a passage supports it needs reading.
- A matching number is not a correct claim. An answer that puts a passage's number on the wrong thing still passes this check. Keep a model judge or a person for meaning.

In a rubric, `contexts` sets the limit:

```yaml
grade:
  contexts:
    unsupported: 0 # facts allowed in no passage
    allow_unsupported: [name] # kinds not counted
    required: true # an output without contexts fails
```

`grade()` takes the passages as `contexts` too: `await grade(answer, { contexts: passages })`.

## Example 3: comparing two prompts on style

Two prompts answered the same task: explain why Tuesday's deploy failed. Prompt A gave this answer (`prompt-a.md`).

```markdown file=prompt-a.md
# Why the deploy failed

The deploy on Tuesday stopped at the database step.
A migration added a column with a default value, and on our largest table that locked writes for four minutes.
The health check gave up after two minutes and rolled the release back.
We will add the column without a default first, then fill it in batches.
```

Prompt B gave this one (`prompt-b.md`).

```markdown file=prompt-b.md
# Why the deploy failed

In today's fast-paced world of software delivery, every deploy plays a crucial role.
Let's delve into what happened on Tuesday.

**It wasn't a code problem. It was a database problem.**
A migration added a column with a default value — and on our largest table, that locked writes for four minutes.
The health check gave up after two minutes — and rolled the release back.

The fix is a testament to careful engineering: we will meticulously add the column without a default, then fill it in batches.

In conclusion, robust migrations are the key to a seamless pipeline. I hope this helps!
```

Run both. The rules for the signals of generated text run with no settings.

```
$ npx chaffjs prompt-a.md --compact

prompt-a.md   blog/tech · English   genre from the default


{counts}
```

```
$ npx chaffjs prompt-b.md --compact

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

{counts}
```

Across many tasks, compare the rates rather than single outputs. `chaff grade` gives each rule's rate, and `--baseline` puts two runs side by side.
The rules not run are the Japanese-only rules and the rules the blog/tech genre does not check.
One more needs headings below the title, and one reads meaning. Without `--compact`, each is listed with its reason.

To feed the findings back into a regeneration step, have `fix-plan` turn them into instructions.
This is an excerpt; the plan goes on with a direction, an example and the spots for each rule.

````
$ npx chaffjs fix-plan prompt-b.md
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
npx chaffjs prompt-b.rewritten.md
npx chaffjs compare prompt-b.md prompt-b.rewritten.md --distinct --allow-dropped heading --allow-added heading
npx chaffjs outline prompt-b.md prompt-b.rewritten.md
```
…
````

`--json` gives the same plan as JSON, to put into the next prompt. The last check, `compare`, confirms the regenerated text kept the facts.
How to rewrite from a plan is in [Making AI-sounding text sound human](./ai-sounding).

## Example 4: an answer that contradicts itself

A model wrote this quote (`answer.md`). Its total does not add up, and the weekday does not match the date.

```markdown file=answer.md
# Your quote

| Item | Price |
| --- | --- |
| Design | $400 |
| Build | $1,200 |
| Total | $1,500 |

We can start on Monday, October 6, 2026.
```

```
$ npx chaffjs answer.md --compact

answer.md   blog/tech · English   genre from the default

  7:12    error   The total $1,500 is not the sum of the amounts above it ($1,600)
                  total-mismatch
  9:25    error   2026-10-06 is a Tuesday, not a Monday
                  date-weekday-mismatch

{counts}
```

These findings are errors, so the run ends with exit code 1, and `chaff grade` fails the output.

## Findings as SARIF

`--sarif` writes the findings of every file checked to one SARIF file. The screen output does not change.

```
$ npx chaffjs prompt-b.md --compact --sarif out/prompt-b.sarif
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

## In your harness: `grade()` and the scorer shape

`chaffjs/grade` grades one output in process and returns the same result as one line of `--out`.
It reads `chaff.yaml` only when `config` names it, and never writes a file.

```js
import { grade, toScorer } from "chaffjs/grade";

const result = await grade(output, { id: "q3", reference, config: "chaff.yaml" });
console.log(result.pass, result.failedBecause); // false [ 'facts.dropped 2 > 0' ]

const scored = toScorer(result);
console.log(scored.score, scored.reason); // 0 failed: facts.dropped 2 > 0 — no findings
```

`toScorer()` gives the shape most eval frameworks take:
- `name`;
- `score`: 1 for pass, 0 for fail;
- `pass`;
- `reason`: the failed conditions, then the findings by rule, then the penalty;
- `metadata`: the whole result.

chaff has no full marks, so it never maps penalty points onto 0–1. A harness that wants a graded number reads `metadata.score.penalty`.
Input `chaff grade` would refuse with exit 2 throws `GradeInputError`.

## Integrations

Each example calls `grade()` or `chaff grade` and keeps no framework code inside chaff.
They are in [`examples/evals`](https://github.com/isamu/lab/tree/main/text/examples/evals).
Install each framework in your own project; none is a dependency of chaff.

| Framework | Example | How it connects |
| --- | --- | --- |
| promptfoo | `promptfoo/chaff-assertion.cjs` | a `javascript` assertion returning `pass`, `score` and `reason` |
| autoevals, Braintrust | `autoevals/chaff-scorer.mjs` | a scorer `({ output, expected }) => { name, score, metadata }` |
| evalite | `evalite/chaff.eval.ts` | a `createScorer` scorer |
| Langfuse | `langfuse/push-score.mjs` | `langfuse.score.create()` on a trace |
| DeepEval | `deepeval/chaff_metric.py` | a `BaseMetric` that runs the CLI |
| Ragas | `ragas/chaff_with_faithfulness.py` | chaff's fact checks next to `Faithfulness` |
| Inspect AI | `inspect/chaff_scorer.py` | a `@scorer` that runs the CLI |
| OpenAI Evals | `openai-evals/` | `samples.jsonl` (`input`, `ideal`) and the completions turned into `chaff grade` items |
| GitHub Actions | `README.md` | `chaff grade --baseline` in a workflow step |

The promptfoo assertion, the autoevals scorer and the OpenAI Evals converter are tested in this repository.
Those tests need no network and no API key.

```yaml
# promptfooconfig.yaml
tests:
  - vars:
      reference: "The team answered 4,812 tickets this quarter."
    assert:
      - type: javascript
        value: file://chaff-assertion.cjs
```

## Where chaff fits in an eval

Model-graded metrics read meaning: whether an answer is correct, relevant or faithful.
They can give the same output different scores on different runs, and a reason in prose.
chaff gives the same output the same result every time, and every failure names a line and a rule.
It answers only what a machine can decide:
- facts kept against a reference;
- quotations really in their sources;
- totals and weekdays that agree;
- house rules, and the rate of style findings.

Run it next to a model judge or a person, not instead of them.

## What chaff will not do here

- **Grade with a model.** Grading stays deterministic. `chaff test`, which asks a model, stays a separate command and is never called by grading.
- **Rewrite the output.** `fix-plan` gives instructions; your regeneration step does the rewriting.
- **Say an output was written by AI.** `ai-generated-composite` is a signal to count, not a verdict.
- **Ship weights or a full score.** Your team decides the cost of each finding, and writes it in `chaff.yaml`.
