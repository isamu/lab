# Reference: what chaff can find

This page lists everything chaff can find, one rule at a time.
Each rule comes with a text it flags and what chaff actually printed for that text.
Click a rule's name to read its full page.
When no rule fits a team's requirement, read [Adding a rule](./adding-rules).
The papers and standards behind the rules are listed in the [Bibliography](./bibliography).

## How to read the list

| Mark | Meaning |
| --- | --- |
| on by default | Runs with no settings at all |
| experimental | Off by default. Turn it on as shown in "Turning experimental rules on" below |
| when listed in chaff.yaml | Checks only the words or headings your team lists in `chaff.yaml`. With nothing listed, it says nothing |
| chaff test | Needs the meaning to decide. `npx chaffjs test` has an AI read the passage |
| Japanese / English | The language of the documents the rule checks |

The output of every example is made by running chaff again each time the site is built.
The examples are run with the genre `business/report`, with experimental rules on.
An example that needed other settings shows its `chaff.yaml`.
The `1:7` at the start of a line of output means line 1, character 7 of the example.

## Turning experimental rules on

Experimental rules are off by default, because their false findings are still being cut down.
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
