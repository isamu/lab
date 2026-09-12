# chaff ChangeLog

Newest first.

## 0.3.0 — 2026-09-13

The largest release so far. **25 rules become 39.** Part-of-speech analysis arrives with nothing to
install, thresholds follow the genre, and the LLM judge takes a second provider.

📦 [`chaffjs@0.3.0`](https://www.npmjs.com/package/chaffjs/v/0.3.0) ·
[`@chaffjs/lang-ja@0.3.0`](https://www.npmjs.com/package/@chaffjs/lang-ja/v/0.3.0) ·
[`@chaffjs/lang-en@0.3.0`](https://www.npmjs.com/package/@chaffjs/lang-en/v/0.3.0)

### Part-of-speech, with nothing to install (#52)

The spec had put the Japanese dictionary behind an opt-in (`chaff setup`). It weighs 18 MB and the
budget said 15. The budget was removed, so the machinery that existed to satisfy it went too.

Four analysers were run on Node 24 before choosing. `lindera-js` is the smallest at 9.1 MB and still
had to go. It is a wasm-pack **bundler** target with no `main` or `exports`, so Node cannot resolve
it. `wink-pos-tagger` reports 0.14 MB on npm and pulls 13 MB through `wink-lexicon`. The package
figure alone would have picked the wrong one.

What survives the removal is the **time** budget, which is why capability and payment are separate:

```
capabilities.pos = true     what the adapter can do if asked
adapter.prepare()           what it costs. 2.2s, and only when a rule needs it
```

A lint with no such rule takes 0.22s; with them, 0.50s. A rule that cannot run says why rather than
reporting zero findings.

`agentless-passive` has **one rule definition for both languages**. Japanese れる/られる and English
be + past participle look nothing alike, but they hide the same thing: who acted. The adapter folds
that judgement into a UD feature (`Voice=Pass`), so the detector never learns a language.

The rule was wrong twice before it was right. It first flagged 14 spots in real documents, 10 of them
noise. A passive that modifies a noun ("開催される BootCamp") names a thing rather than hides an actor.
The fix went into the core detector, and **English broke**. "No noun follows" is a fact about Japanese
word order; English runs the other way. Moving the judgement into the adapter made both correct.

### Fourteen L1/L2 rules, and three that were measured and dropped (#72, #73, #74)

| layer | rules |
| --- | --- |
| L1 structure | `max-paragraph-length` `paragraph-length-variance` `section-length-uniformity` `rule-of-three` `preamble-length` |
| L1 signals | `ngram-repetition` `emoji-density` `undefined-acronym` `concrete-evidence-density` |
| L2 lexicon | `excessive-hedging` `cushion-phrase-density` `unqualified-superlative` `repeated-conjunction` `ai-tell` |

`list-length-variance` was measured across 27 real bullet lists: coefficient of variation median 21%,
range 11–56. The first threshold flagged **more than half of what humans wrote**. Bullet lists are
supposed to be uniform — that is what a list is for. Lowering the threshold until it went quiet would
have silenced the rule without teaching it to tell good writing from bad. Dropped, with the numbers.

`contraction-consistency` needs to know "don't" and "do not" are one word in two registers. `Lexicon`
holds `{pattern, weight}` and cannot express a pair; widening the contract can wait for a second rule
that needs it.

`ai-tell` is the first rule to use `weight`. Each phrase is ordinary alone, so only the sum is
reported. Both the message and the rationale say it is never a verdict on its own.

### Japanese and English L3 (#57, #58, #59)

Nine Japanese rules and five English ones. The first three Japanese rules were reported as unshippable
and then shipped, because two of the three diagnoses were wrong.

"Nested の cannot be told from parallel の without dependency parsing" was false: **punctuation
separates them**. The first implementation collected particles and ignored the commas between them.

```
3  弊社の新製品の販売の計画                            fires
1  サービスの運営や、ドキュメントの作成、イベントの運営   does not
```

"Where 体言止め is acceptable is a matter of taste" was also too strong. The false positives were
dependent nouns (名詞,非自立) — 「回るのか。」 is a question, not a noun-ending sentence — and that is
decided mechanically.

What remained was not about the rules at all. Things that parse as paragraphs are not always
sentences: a bare name under a heading, a citation line, a title. `no-mixed-desumasu` reported exactly
three false positives in one document, and that document held exactly three fragments. "Is this a
sentence" now lives in one file, because writing it per rule means one definition of "not prose" per
rule.

English rules avoid taking sides where style guides disagree: `title-case-consistency` and
`oxford-comma-consistency` only ask whether one document is consistent with itself.

### Thresholds follow the genre (#60)

```
business/email   warning この文は 76 文字あります（70 文字まで）
blog/tech        0 findings
blog/essay       0 findings
```

The same sentence. The spec put these numbers in profile files. They went next to the rule instead,
because a threshold separated from its rationale is a number that drifts.

`explain` and `rules --json` both say when a value came from the genre. Showing the default would make
a correct setting look broken, and `rules --json` is what an AI reads to write the config.

### `ai_backend` — Anthropic or OpenAI (#64)

```yaml
ai_backend: openai
ai_model: gpt-5
```

What differs between providers is the envelope. The JSON schema producing `{violated, confidence,
reason}` is shared, because a verdict that changes shape when you change vendor is a verdict that
changes meaning. Both shapes were read out of the installed SDK types rather than recalled.

**A Claude subscription does not work here.** The SDK resolves an API key, an auth token, a Console
OAuth profile, or OIDC federation. Claude Code's credentials (`~/.claude`) are none of those.
Driving the `claude` CLI as the judge was measured, not assumed. **46,906 tokens for one verdict**,
because Claude Code carries its own system prompt and tool definitions into every call. Roughly a
hundred times the API path.

### `.env`, and telling apart three ways of failing (#67, #68)

Keys can live in `.env`, read through Node's own loader with no dependency. **The shell still wins**,
so a different key can be tried without editing anything.

Both fixes in this area came from running against a live API, and neither was reachable from a stub.

A key that is present but rejected used to report "no credentials found", sending the reader back to
set a key they had already set. A 429 used to arrive as a Node stack trace. Only 401 was caught, so
"you have no credits remaining" came out as a core dump. Failures are sorted into auth / quota /
other, each saying what to do next. The provider's own text is passed through, because translating it
would drop the billing URL.

`.env` was also not in `.gitignore`, and neither was `.env~`, which held a real key.

### `--dry-run` and `look_at` (#61, #62)

```
doc.md   全 6 文のうち 5 箇所を送ります（API は呼んでいません）

      1 箇所  リスクが書かれていない  （機械で絞り込み済み）
      2 箇所  依頼には期限と担当がある  （「お願いします」 「ご確認ください」 を含む文）
      1 箇所  議事録に決定事項がある  （絞り込めず全文）
```

Never sending the whole document has been a principle since 0.1.0. This is the first release where it
can be verified, and **without an API key**.

Until now `look_at` was prose that nothing could act on, so every user-written check sent the whole
document. Writers quote the words they mean, so the quotes are the filter — no model, no dialogue,
nothing inferred. What cannot be narrowed still goes whole, and the output says so with the fix on the
next line.

### Fixed

`**` was never masked. The analyser read `**。` as one noun, the sentence lost its terminator and
swallowed the next one. Emphasis markers are covered now; the emphasised words stay.
Findings on the example corpus fell from 19 to 18.

`bold-density` rose instead. 18 bold spans had been adding 72 characters of markup to their own
denominator.

`isClosed` had no ASCII period, so **no English sentence was ever "finished"**. Written for the
Japanese rules and never exercised in English, it surfaced when an English rule shipped and fired
nothing.

`repeated-sentence-head` compared six characters in every language, so English output quoted
`"Wecont"`. It compares three words where the unit is words, which also removed a false positive on a
URL.

A malformed rule file crashed without naming the file. `:::` directives (Zenn, Docusaurus, VitePress)
counted as prose.

### Breaking

- Runtime dependencies grow by about 40 MB. The spec's size budget is gone; the time budget stays,
  which is why the dictionary loads only when a rule needs it.
- `repeated-sentence-head` reports differently in English.
- `bold-density` counts more on heavily emphasised text.
- `docs/` was already `technical/readme` as of 0.2.0; no genre changes in this release.

### Not in this release

`chaff test` has still never completed a round trip against a live API. Authentication, 401 and 429
are confirmed against the real service, but the account had no credits. Tracked separately.
`internal-jargon`, `proper-noun-density` and `required-sections` each need machinery that does not
exist yet.

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
