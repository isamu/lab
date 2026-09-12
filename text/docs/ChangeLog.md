# chaff ChangeLog

Newest first.

## 0.2.0 — 2026-09-12

Calibration. 0.0.1 and 0.1.0 built the rules; this release measures whether they are right, against
real published documents. On a corpus of 8 real articles (1525 lines), findings went from **63 to
17**. Every one of the 46 that disappeared was a false positive.

📦 [`chaffjs@0.2.0`](https://www.npmjs.com/package/chaffjs/v/0.2.0) ·
[`@chaffjs/lang-ja@0.2.0`](https://www.npmjs.com/package/@chaffjs/lang-ja/v/0.2.0) ·
[`@chaffjs/lang-en@0.2.0`](https://www.npmjs.com/package/@chaffjs/lang-en/v/0.2.0)

### Bold in tables and headings is not emphasis (#38)

Found by running the published 0.1.0 on chaff's own specifications. A table whose first column is
bold labels was reported as "3 bold spans in this section (2 allowed)".

The rule's own rationale — bold stops the reader's eye, so using it everywhere stops nothing — does
not apply to a table cell label. Bold inside headings and code blocks is excluded for the same
reason. On the specs this alone cut findings from 14 to 1.

Still reported, and deliberately: a list whose items open with a bold lead-in. That one is a matter
of taste, and the answer to it is `relax`, not a change to the rule.

### `examples/` — real documents in the repository (#40)

Building rules against invented examples means the false positives are found by users. Eight
published documents now live in the repository: three Japanese technical articles and two English
ones from zenn.dev/singularity, three organisational documents from singularitysociety.org.

```bash
yarn example              # compact
yarn example:friendly     # the default output
```

CI runs them on every push. It never fails on the number of findings, because prose is a matter of
taste. It fails only when chaff does not finish, judged by whether the summary line appears.

`by_path` was implemented in the same PR because splitting the examples into three genres required
it. It had been in the spec since the beginning and was never built.

```yaml
by_path:
  - files: ["business/**/*.md"]
    genre: business/report
  - files: ["blog-en/**/*.md"]
    language: en
```

Later entries win. Globs are matched relative to the config file, so the result does not depend on
the directory the command is run from. The first bug in it: `**/` has to match **zero** directories,
or `docs/**/*.md` misses `docs/a.md`.

### `chaff eval` — thresholds measured against your own writing (#42)

Default thresholds are a general guess. Whether they fit a particular team's writing is a question
that has to be measured, and #40 supplied the corpus to measure against.

```
  太字の使いすぎ   (bold-density)

        17     2 文書 ( 66.7%)   指摘   2 件   1万字あたり 0.8
        20     1 文書 ( 33.3%)   指摘   1 件   1万字あたり 0.4  ← 現在
        25     0 文書 (  0.0%)   指摘   0 件   1万字あたり 0.0  ← 推奨
```

The standard applied is spec §21's own. The corpus is writing a human wrote and published, so a rule
that fires across it has a threshold that does not match reality. The target is a hit rate below 5%.

It **never rewrites the config**. A calibration is an answer about one corpus, not a truth — the
proposal is printed and the decision stays with the person.

It earned its place the day it landed by reporting that `bold-density` missed the target *at every
threshold*, and that the rule itself was likely wrong. Which it was:

### `bold-density` counts density, not occurrences (#44)

```
  1095 chars / 2 bold   →  "few" by count      actually 1 per 548 chars (sparse)
   557 chars / 9 bold   →  "many" by count     actually 1 per  62 chars (dense)
```

Counting per section means a long section is always guilty — the opposite of what the reader
perceives. The rule had been named `bold-density` from the start; the implementation was the thing
that was wrong.

It now measures spans per 1000 characters (`strict 10 / normal 20 / relaxed 40`). Sections under 200
characters are not measured at all, because 1 span in 43 characters computes to "23 per 1000" and the
density becomes noise. Findings on the corpus: 32 → 1.

### Sentence length measured as the reader reads it (#46)

`max-sentence-length` was 38 of 44 findings on the corpus. Reading them showed most were not long
sentences at all. Three separate causes:

**Masked whitespace was counted.** Non-prose is covered with spaces of the same length, so that
offsets stay aligned. Counting those spaces made a sentence holding one URL measure 245 characters.
The reader reads 104. The measurement lived in four call sites and is now in `measure.ts`.

**Fragments were merged across line breaks.** The merge exists to close mis-splits *within* a line
(`Dr. 田中`). Crossing a line break joined the English and the Japanese halves of a blockquote into
one 134-character "sentence".

**Blockquotes were counted as the writer's own prose.** They are masked now, alongside code and
tables. chaff can say "split this in two", and nobody can do that to a quotation. Pointing at text
the writer cannot change leaves them nowhere to go. The longest "sentences" in the corpus were
English quotations measured against the Japanese threshold.

Findings: 44 → 17, `max-sentence-length` 38 → 10. What remains is 104–128 characters and genuinely
long.

### `technical` — a specification is not a blog post (#47)

chaff's own specs were detected as `blog/tech`. The original nlh spec had a `technical` profile;
chaff had only business and blog.

A spec or a README is written to prevent misunderstanding, not to be read for pleasure. It needs no
hook, no closing and no rhythm: `padded-intro`, `closing-cliche`, `sentence-rhythm` and
`empty-conclusion` do not run. `max-sentence-length`, `heading-echo`, `bold-density`,
`empty-intensifier` and `repeated-sentence-head` do. Ambiguity is worse in a specification than
anywhere else.

<!-- stet: empty-intensifier — quoting the phrase the rule catches -->

And "extremely important" in a spec is emptier than it is in an article.

Detected from `README.md`, `*-spec.md`, `spec/` and `docs/`.

### Breaking

- `docs/` is detected as `technical/readme` instead of `blog/tech`. A team keeping user-facing
  articles in `docs/` will find the blog rules stop running there.
- `bold-density` thresholds changed meaning: occurrences per section → spans per 1000 characters.
  Any numeric value set by hand has to be re-read.

### Not in this release

Per-genre thresholds are still missing. Genre selects only *which* rules run, not their numbers,
where spec §9 gives a profile its own thresholds. Also absent: L3 part-of-speech rules, and the
conversion of `checks.yaml`'s natural-language `look_at` into a real candidate filter.

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
