# chaff in eval frameworks

Small examples that put chaff's deterministic grader next to model-graded metrics. Each only calls `grade()` from
`chaffjs/grade`, or `chaff grade` on the command line; chaff keeps no framework code. None of them adds a package to
this repository: install what each names in your own project.

chaff checks what a machine can decide the same way every time: facts kept against a reference, quotations really in
their sources, error findings (a total that does not add up, a wrong weekday), and the rate of style findings. It does not
judge whether an answer is right or helpful. Keep a model judge or a person for that.

| Framework | File | How it connects |
| --- | --- | --- |
| promptfoo | `promptfoo/chaff-assertion.cjs`, `promptfoo/promptfooconfig.yaml` | a `javascript` assertion returning `pass`, `score` and `reason` |
| autoevals / Braintrust | `autoevals/chaff-scorer.mjs` | a scorer `({ output, expected }) => { name, score, metadata }` |
| evalite | `evalite/chaff.eval.ts` | a `createScorer` scorer in an `.eval.ts` |
| Langfuse | `langfuse/push-score.mjs` | `langfuse.score.create()` on a trace (code only) |
| DeepEval | `deepeval/chaff_metric.py` | a `BaseMetric` calling the CLI |
| Ragas | `ragas/chaff_with_faithfulness.py` | chaff's checks next to `Faithfulness` (code only) |
| Inspect AI | `inspect/chaff_scorer.py` | a `@scorer` calling the CLI |
| OpenAI Evals | `openai-evals/` | `samples.jsonl` (`input`, `ideal`) and the completions turned into a `chaff grade` items file |

The Python examples share `python/chaff_cli.py`, which runs `npx chaffjs grade` and reads the result line.

## The scorer shape

`toScorer(result)` from `chaffjs/grade` gives the shape most frameworks take:

- `score`: 1 when the output passed, 0 when it failed. chaff has no full marks, so it never maps its penalty points onto
  0–1; a harness that wants a graded number can read `metadata.score.penalty` and map it itself.
- `pass`: the same as `score === 1`.
- `reason`: the failed conditions, then the findings by rule, then the penalty when chaff.yaml has a `grade:` rubric.
- `metadata`: the whole result: findings, rates, rules not run, facts, citations, penalty items and the stamp.

## Answers against retrieved passages

For a RAG pipeline, put the passages the retriever returned in the item's `contexts` (an array of strings; `contexts`
in `grade()`). chaff looks for each number, date, time, URL, code span, name and quotation of the answer in them, as
`compare` reads facts, and lists those found in no passage under `contexts.unsupported`; a quotation must be in a passage
word for word. This is the deterministic part of Ragas' faithfulness: it never judges meaning, and it counts the
sentences that state no checkable fact as not checked. `grade.contexts` in chaff.yaml sets the limit
(`unsupported: 0`).

## In CI

```yaml
# .github/workflows/eval.yml, one step: fail the job when outputs regress against the stored baseline
- run: npx chaffjs grade outputs.jsonl --baseline eval/baseline.results.jsonl
```

lm-evaluation-harness and Arize Phoenix need nothing chaff-specific: score an output with `grade()` or `chaff grade`
and attach the result as you would any other metric.
