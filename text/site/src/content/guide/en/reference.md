# Reference: what chaff can find

This page lists everything chaff can find, one rule at a time.
Each rule comes with a text it flags and what chaff actually printed for that text.
Click a rule's name to read its full page.
When no rule fits a team's requirement, read [Adding a rule](./adding-rules).
The papers and standards behind the rules are listed in the [Bibliography](./bibliography).
To grade a model's outputs with these checks, read [Using chaff for AI evals](./ai-evals).

## How to read the list

| Mark | Meaning |
| --- | --- |
| on by default | Runs with no settings at all |
| on by default (info) | Runs with no settings, and reports as information. It never fails the run |
| experimental | A new rule not measured yet. Off by default. Turn it on as shown in "Turning experimental rules on" below |
| when listed in chaff.yaml | Checks only the words or headings your team lists in `chaff.yaml`. With nothing listed, it says nothing |
| chaff test | Needs the meaning to decide. `npx chaffjs test` has an AI read the passage |
| Japanese / English | The language of the documents the rule checks |

The output of every example is made by running chaff again each time the site is built.
The examples are run with the genre `business/report`, with experimental rules on, and with the rules that genre is off for by measurement on too.
An example that needed other settings shows its `chaff.yaml`.
The `1:7` at the start of a line of output means line 1, character 7 of the example.

## Which rules run by default

Most rules run without `--experimental`.
Which ones run is decided by measurement, not by hand: chaff is run over real documents people wrote (the corpus), and each rule is placed by how often it reports on them.

- A rule that seldom reports on human documents runs as it is.
- A rule that often reports on human documents too runs as information. You can scan past it.
- A rule that reports on most documents of a genre is off for that genre: it describes how that kind of document is written, not a mistake. It is listed among the rules that did not run, with the reason.

To drop the information from a rule you do not want, turn it off.

```bash
npx chaffjs off ngram-repetition --why "repetition is our style"
```

## Turning experimental rules on

Experimental rules are new rules that have not been measured on real documents yet. They are off by default until they are.
To run all of them, add `--experimental`.

```bash
npx chaffjs --experimental report.md   also run the experimental rules
```

To turn on just one, give it a level under `rules` in `chaff.yaml`.

```yaml
rules:
  doubled-word: normal
```

The rules that read Markdown syntax (heading depth, image alt text, link targets and so on) run on Markdown documents only.
On a `.txt` file they stop with "the document is not Markdown".

Some genres turn experimental rules on by default.
The [genres page](../../genres/) shows which rules each genre runs.

## Checks that read meaning run with chaff test

Does the conclusion say something? Does a number have a source? Is a risk disclosed? None of these can be decided without reading.
chaff narrows the text down to the passages that matter, and `npx chaffjs test` sends only those to an AI to read.
`npx chaffjs test --dry-run report.md` shows what would be sent, before anything is sent.
Without an AI, every other check still runs.
