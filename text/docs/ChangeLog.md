# chaff ChangeLog

Newest first.

## 0.1.0 — 2026-09-12

`chaff test` — the half of the tool that reads meaning. 0.0.1 could only measure what a machine can
count; this release adds checks that require reading the text, judged by Claude.

📦 [`chaffjs@0.1.0`](https://www.npmjs.com/package/chaffjs/v/0.1.0) ·
[`@chaffjs/lang-ja@0.1.0`](https://www.npmjs.com/package/@chaffjs/lang-ja/v/0.1.0) ·
[`@chaffjs/lang-en@0.1.0`](https://www.npmjs.com/package/@chaffjs/lang-en/v/0.1.0)

### The semantic layer (#34)

Three built-in rules, plus `checks.yaml` for checks written in plain language.

| rule | what it checks |
| --- | --- |
| `risk-disclosure` | a proposal states its risks |
| `empty-conclusion` | the closing adds something beyond a summary of the body |
| `unsourced-number` | a number claiming an effect carries its basis |

Output separates the two kinds of judgement under their own headings, because a reader who does not
know a finding can move between runs will be whipsawed by a false positive. Only AI findings carry a
confidence figure, and each one names two ways out: silence this spot, or relax the rule.

### The whole document is never sent

Two stages. A deterministic filter narrows the text first; only what survives is read. **An L4 rule
without a filter cannot be registered** — without that constraint every article would cost a
full-document read.

`risk-disclosure` is skipped entirely when a heading already names risk. `empty-conclusion` only
fires when the last section contains no number, code or link. `unsourced-number` only fires when a
number and an effect verb share a sentence carrying no basis.

The first test to fail while building that filter is the reason the design exists:

```
Headcount fell 40% after adoption (Apr–Jun 2026, year over year).
```

The sentence carries its basis and was still being queued for the model — "year over year" was not
recognised as evidence. Catching that is exactly what stage one is for.

Identical questions hit `.chaff-cache/` on the second run, so repeated CI runs cost nothing.

### Credentials are checked before the call, not after

With no credentials the SDK throws a plain `Error` — not `AuthenticationError`, not `APIError` — so
the failure cannot be identified by type afterwards. chaff now checks the documented resolution order
first (`ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, identity tokens, the `ant auth login` profile).
Looking only at `ANTHROPIC_API_KEY` would tell someone who authenticated with `ant auth login` that
they have no key.

### The verdict shape is fixed

`output_config.format` constrains the response to `{violated, confidence, reason}`; free text is
never parsed after the fact. Findings below the confidence threshold (0.7 by default) drop to `info`.
The system prompt says: when in doubt, do not flag — a false positive costs more than a miss.

### Fixed

`chaff lint` claimed "no detector" for semantic rules. It now says they run under `chaff test`.

Two regexes were rewritten: `\d+\s*(?:%|倍|…)` backtracks on `\s*`, and the evidence-marker
alternation exceeded the complexity limit — it is a word list now.

### Note

Runtime dependencies grew from 2.6 MB to 11.8 MB (the Anthropic SDK), still inside the 15 MB budget
the spec sets for `npx`.

### Not in this release

L3 (part-of-speech rules), `eval` (threshold calibration against a corpus), and the conversion of
`checks.yaml`'s natural-language `look_at` into an actual filter — user checks currently pass the
whole document.

## 0.0.1 — 2026-09-12

First release. `npx chaffjs article.md` finds what is hard to read, with no install, no API key and
no language flag — and never rewrites the text.

📦 [`chaffjs@0.0.1`](https://www.npmjs.com/package/chaffjs/v/0.0.1) ·
[`@chaffjs/lang-ja@0.0.1`](https://www.npmjs.com/package/@chaffjs/lang-ja/v/0.0.1) ·
[`@chaffjs/lang-en@0.0.1`](https://www.npmjs.com/package/@chaffjs/lang-en/v/0.0.1)

### The monorepo and the language adapters (#8)

`text/` became a yarn workspaces root alongside `coding/`, which holds scoria. CI is scoped by
`paths:` and `working-directory:`, so a change to one project does not run the other's gates.

The first real code was the sentence splitting, because `sentence-rhythm` and `max-sentence-length`
take sentence length as input and a bad split moves the metric directly. English needs no help from
`sentence-splitter`: `Dr.`, `e.g.`, `U.S.` and `$3.50` are all handled. Japanese is broken by the
same library — it treats `.` as a terminator and splits `、Dr. 田中は` in two, and the `AbbrMarker`
option does not fix it because the cause is not abbreviation protection. Japanese sentences end in
`。！？`, so the adapter joins any fragment that does not.

Cross-package imports are types only. Adapters do not depend on chaff's values and run on their own.

### The MVP: lint that works with no configuration (#16)

Five L1 rules, the four-word model, the non-engineer output format, `--compact`, `chaff rules --json`
for handing the current state to an AI, and comment-preserving write-back of `chaff.yaml`.

Non-prose is not cut out of the document — it is **covered with spaces of the same length**. Offsets
stay aligned with the original text, so line numbers and quoted excerpts remain exact.

Three things were found by building it:

- Splitting sentences across the whole document let a line without a full stop swallow a masked
  table and code block up to the next one. The specs produced a 954-character "sentence". Sentences
  are now split per paragraph, a boundary a sentence cannot cross.
- `heading-echo` cannot be measured with a Jaccard coefficient. A sentence that contains the whole
  heading and then continues scores 44% simply because it is longer, which misses the most typical
  repetition. Containment scores it 100%. The spec was corrected to match (#22).
- Genre detection fired on documents that merely *mention* 決定事項. It now looks at headings and
  line starts only.

### Directories, `init` and `explain` (#18)

One file at a time is not enough for a real repository. `chaff .`, `chaff docs/ README.md`, globs.
`node_modules`, `dist`, `build` and `coverage` are skipped. **Zero matched files is a failure** — a
run that silently checks nothing keeps CI green while verifying nothing.

`explain` exists because the default output says "relax this rule" while offering no way to read what
the rule is for.

### Locale-independent ordering (#20)

`localeCompare` without an explicit locale follows the machine's default, so Windows CI ordered
`one.md` before `README.md` and the suite failed. Finding order reaches CI logs and the baseline
file; it must not move between machines. The locale is now pinned, the assertion compares sets, and
a separate test asserts that output order does not depend on input order.

### Answering a finding: `stet`, `baseline`, `suppressions` (#21)

Of the three ways to answer a finding, the second was missing. Without it, a finding that is right in
general but deliberate in one spot leaves only "switch the rule off", and that accumulates until the
whole tool is ignored.

```markdown
<!-- stet: bold-density — a glossary, so the bold is deliberate -->
<!-- stet-section: bold-density — the list below -->
<!-- stet-file: ai-tell, rule-of-three — heavy quoting -->
```

Suppression applies forward only; reaching backwards would silently widen what it covers.

`baseline` shelves what already exists so a repository with hundreds of articles can adopt the tool
without fixing everything first. Findings are identified by content hash rather than line number, so
adding a paragraph does not unshelve them.

`suppressions` is the bridge from the second answer to the third: silencing the same rule five times
means the standard, not the text, is what does not fit.

### L2: the lexicon layer (#23)

`empty-intensifier`, `padded-intro` and `closing-cliche`. The detector is shared; only the lexicon is
per-language.

This validated the four-layer model. The spec had set it as a checkpoint: if adding a second adapter
requires changing the genre packs, the split is wrong. The same three rules ran in English with no
change to the rule definitions or the detector — only the lexicon was swapped.

`where` narrows the scope, because the same phrase means different things in different places: a
closing cliche in the middle of a piece is just an ordinary connective.

### `--watch` (#24)

Reprinting every finding on each save makes it impossible to see what changed. Only the difference is
printed. When one rule loses a finding and another gains one the total is unchanged, and marking that
as an improvement would be a lie, so the check mark appears only when the count falls.

### Publishing (#25, #26, #29)

`@chaff` has belonged to another user since 2019, and npm rejects the unscoped name `chaff` as too
close to `chai`, `chalk` and `charm`. The package is `chaffjs`; the binary is still `chaff`, since
the two names are independent.

Official adapters live under `@chaffjs/`, third-party ones under `chaff-lang-*` — the same split as
`@typescript-eslint/*` and `eslint-plugin-*`. The scope protects the name; the unscoped prefix keeps
the ecosystem open, which is the whole reason adapters are separate packages.

The adapters are dependencies of `chaffjs` rather than being fetched at runtime. The spec describes
lazy resolution, but until that exists an adapter missing from the dependency tree makes the
published CLI fail on startup.

### Not in this release

L3 (part-of-speech rules), L4 (meaning-based checks via an LLM and `checks.yaml`), `eval`, and corpus
calibration. `sentence-rhythm` ships as experimental and off by default: "AI-written articles have
uniform sentence length" is still an untested hypothesis.
