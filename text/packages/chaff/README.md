# chaff

*日本語: [README.ja.md](README.ja.md)*

chaff brings two habits from programming to ordinary writing. A linter checks that code follows
rules; a unit test checks that a change did not break what must hold. chaff lints contracts, blog
posts and technical documents for readability, consistency and contradictions, and its `compare`,
`cite` and `test` commands check that a rewrite kept the facts, the quotations and the team's
requirements.

It reads Japanese and English, gives the same result for the same text every time, and **never
rewrites your text**. Every command returns an exit code, so it runs in CI on every change.

**Try it in your browser:** [the playground](https://isamu.github.io/lab/en/playground/). Paste
a draft and see what comes back, with nothing to install.

**Inside a coding agent:** `/plugin marketplace add isamu/lab`, then `/plugin install chaff@lab`.
The bundled skill picks the genre, runs chaff, and reads each finding back to you. It changes no text
on its own.

## First run

With Node.js 24 or later, nothing to install, no config file, no API key, no language to declare:

```bash
npx chaffjs article.md     # one file
npx chaffjs .              # every Markdown file here
npx chaffjs --help         # every command
```

Here is a real run against a draft written to sound like generated text:

```text
$ npx chaffjs --compact draft.md

draft.md   blog/tech · English   genre from the default

  14:1    info    "paradigm shift" is a cliché
                  cliche
  14:1    warning "it is important to note that" emphasises without saying anything
                  empty-intensifier
  27:1    warning Closes with "in conclusion"
                  closing-cliche
   6:38   info    Section "The Benefits of Parallel Execution" has no number, code or link
                  concrete-evidence-density
```

Without `--compact`, each finding carries why it matters, what to write instead, and the command
that relaxes the rule if you disagree:

```text
─── line 14 ──────────────────────────────────────────────────

    It is important to note that these benefits are not merely incremental…

  ⚠  Empty intensifier

     "it is important to note that" emphasises without saying anything
     "Extremely important" does not say what matters or why. It only feels emphatic.

     → Say what matters and why. If you cannot, the sentence can go.

     Relax this rule:  npx chaffjs relax empty-intensifier
```

The marks are the weight of a finding: `✖` an error, `⚠` a warning, `·` for information.

## It does not rewrite, and that is the point

Two kinds of tool already exist for this. A classifier tells you a text looks generated, which
you cannot act on. A rewriter fixes the text for you, which removes the author from their own
document.

chaff does neither. It reports, and the person who wrote the text decides what to change, or
the AI they asked, working from a plan they can read. The report ends with a line saying so.

## Genres

A contract is not written like a blog post, so the rules are not the same:

```bash
npx chaffjs --genre legal/contract nda.md
npx chaffjs genres                        # what is available
```

| Group | Genres |
| --- | --- |
| Technical | `technical/spec` `technical/readme` |
| Blog | `blog/tech` (the default) `blog/essay` `blog/owned-media` |
| Business | `business/proposal` `business/report` `business/email` `business/press-release` `business/meeting-notes` |
| Legal | `legal/contract` `legal/statute` `legal/judgment` `legal/patent` |
| Docs | `docs/manual` `docs/faq` `docs/glossary` |
| Academic | `academic/paper` |
| Literature | `literature/fiction` `literature/essay` `literature/poetry` `literature/play` |
| Speech | `speech/address` `speech/transcript` |

With a genre set, the report opens with that genre's guide: what a good document of the kind
does, written as questions to check the draft against, and the rules that matter most.
`--no-guide` leaves it out for one run; `guide:` in `chaff.yaml` replaces, adds to or turns off
a team's guide.

## Rules

Most rules run with no settings, at the level the genre sets.

```bash
npx chaffjs rules                # which rule runs at what level now
npx chaffjs --experimental x.md  # the experimental rules too
npx chaffjs enable <rule>        # one of them, permanently
npx chaffjs relax <rule>         # or strict / off
```

Rules about a team's own words need their lists in `chaff.yaml`. The checks that read meaning
rather than form run with `npx chaffjs test`.

## Your own preset

A `chaff.yaml` at the top of the repository sets:

- `genre:` and `style:`
- which rules run, and at what level
- your preferred spellings
- the genre's guide
- `custom_rules:` your own rules, written as `words`, a `pattern`, `tokens` for a
  part-of-speech pattern, or a `module` for a Node function

```bash
npx chaffjs init --plugin <name>   # start a YAML-only rule pack, chaff-plugin-<name>/
npx chaffjs plugin-test            # check each of its rules on the rule's own example
```

## Fix plans

```bash
npx chaffjs fix-plan article.md
npx chaffjs fix-plan --depth light|structure|register article.md
```

A plan for whoever rewrites the file, a person or an AI: the findings by rule, how to rewrite
each one, and the checks to run afterwards. `--depth` sets how far the rewrite may go.

## AI score

```bash
npx chaffjs ai-score article.md
```

A quick AI-likeness reading: low, medium or high. It counts the signs of generated text that
human documents of the same genre rarely show. It is not a verdict on whether AI wrote it, and
it is not meant to be one.

## Grading a model's output

```bash
npx chaffjs grade outputs.jsonl --out results.jsonl
```

Grades a JSONL file of a model's outputs, with `id` and `output` on each line, against the rules,
`compare` and `cite`, and fails when an output fails. Useful as a deterministic layer in an
eval suite, where the usual alternative is another model's opinion.
[Using chaff for AI evals](https://isamu.github.io/lab/en/guide/ai-evals/).

## In a browser

`chaffjs/browser` exports `setupBrowser({ files, kuromojiDictionaryUrl })` and
`check(text, options)`. It needs a bundler that reads package.json's `browser` field and
`import.meta.glob` (Vite); with `vite dev`, put `chaffjs` in `optimizeDeps.exclude`. The
Japanese dictionary is fetched on the first Japanese check.
[Checking in a browser](https://isamu.github.io/lab/en/guide/browser/).

## In CI

Every command returns an exit code, so a document is checked the way code is:

```yaml
- run: npx chaffjs .
```

Findings already in the repository can be shelved with a baseline, so a new one fails the build
and the old ones do not block it. [CI](https://isamu.github.io/lab/en/guide/ci/).

## Documentation

The site at [isamu.github.io/lab/en](https://isamu.github.io/lab/en/) has all of this, with a worked
example of every command on one page.

- [Getting started](https://isamu.github.io/lab/en/guide/getting-started/)
- [Commands](https://isamu.github.io/lab/en/guide/commands/)
- [Configuration](https://isamu.github.io/lab/en/guide/configuration/)
- [Making AI-sounding text sound human](https://isamu.github.io/lab/en/guide/ai-sounding/)
- [Using chaff for AI evals](https://isamu.github.io/lab/en/guide/ai-evals/)
- [CI](https://isamu.github.io/lab/en/guide/ci/)
- [Every rule](https://isamu.github.io/lab/en/rules/)

The source is in [isamu/lab, under text/](https://github.com/isamu/lab/tree/main/text).

MIT
