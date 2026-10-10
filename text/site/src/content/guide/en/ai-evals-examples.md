# Examples: AI evals

Four worked examples for [Using chaff for AI evals](./ai-evals), one per kind of check, each with the documents and chaff's real output.
The outputs of Examples 1 to 3 are the ones `prompt-a.jsonl`, `prompt-b.jsonl` and `variants.jsonl` hold on that page.

| Example | Command | What it checks |
| --- | --- | --- |
| [1: is a summary faithful?](#example-1-is-a-summary-faithful) | `chaff compare` | Facts dropped or added against the source |
| [2: are a RAG answer's quotations in the source?](#example-2-are-a-rag-answers-quotations-in-the-source) | `chaff cite` | Each quotation at its address |
| [3: comparing two prompts on style](#example-3-comparing-two-prompts-on-style) | `chaff`, `chaff fix-plan` | The signals of generated text, and a plan for a regeneration step |
| [4: an answer that contradicts itself](#example-4-an-answer-that-contradicts-itself) | `chaff` | A total that does not add up, a weekday that does not match its date |

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

  7:12    error   The total $1,500 is not the sum of its items ($1,600)
                  total-mismatch
  9:25    error   October 6, 2026 is a Tuesday, not a Monday
                  date-weekday-mismatch

{counts}
```

These findings are errors, so the run ends with exit code 1, and `chaff grade` fails the output.

## What to read next

- Grading a whole file of outputs, a rubric, two runs compared and variants side by side are in [Using chaff for AI evals](./ai-evals).
- Every option of `compare`, `cite` and `fix-plan` is in [Commands](./commands).
