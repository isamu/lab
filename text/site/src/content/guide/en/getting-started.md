# Getting started

chaff finds the places in a text that are hard to read. It never rewrites anything; fixing is the writer's job.
Start by running it once on something you wrote.

```bash
npx chaffjs article.md
```

## Pick the kind of document

A contract's sentences run longer than a blog's, a poem repeats its words, and a transcript keeps what was said.
Each is how that kind of document is written.
Pick the kind of document (the genre) and chaff sets its rules and limits to that kind, with no settings to write.

```bash
npx chaffjs --genre legal/contract contract.md   check it as a contract, this run only
npx chaffjs init --genre legal/contract          write the genre into this folder's chaff.yaml
npx chaffjs genres                               list the genres and what each is for
```

| Document | Genre |
| --- | --- |
| Specifications, RFCs, design documents | `technical/spec` |
| READMEs, documentation for developers | `technical/readme` |
| Technical articles (the genre when none is set) | `blog/tech` |
| Personal essays on a blog | `blog/essay` |
| Articles an organisation publishes | `blog/owned-media` |
| Proposals, plans, pitches | `business/proposal` |
| Reports, white papers, internal documents | `business/report` |
| Work email and letters | `business/email` |
| Press releases and public notices | `business/press-release` |
| Minutes and meeting notes | `business/meeting-notes` |
| Contracts, terms of service, privacy policies | `legal/contract` |
| Statutes, regulations, internal rules | `legal/statute` |
| Court judgments and opinions | `legal/judgment` |
| Patent specifications and claims | `legal/patent` |
| User guides, how-to pages, help | `docs/manual` |
| Questions and answers | `docs/faq` |
| Glossaries | `docs/glossary` |
| Papers and abstracts | `academic/paper` |
| Novels and stories | `literature/fiction` |
| Literary essays | `literature/essay` |
| Poems and verse | `literature/poetry` |
| Plays and scripts | `literature/play` |
| Speeches written to be read aloud | `speech/address` |
| Records of what was said (press conferences, debates) | `speech/transcript` |

What each genre leaves out, and what it adds, is on the [Genres](../../genres/) page.

With no genre set, a document is checked as a technical article (`blog/tech`).
When it looks like another kind, the screen says so under the first line.
The genre it is checked with does not change.

```
contract.md   blog/tech · English   genre from the default
   Looks like: Contract and terms. Try --genre legal/contract
```

## Run it on your own writing

No settings file, no API key and no language setting are needed. Give it a file and it reads it.

```bash
npx chaffjs article.md           check this file
npx chaffjs .                    check every Markdown file here
npx chaffjs docs/ README.md      mix directories, files and globs
```

`node_modules`, `dist`, `build` and `coverage` are skipped.
If nothing is found to check, the run fails.
That way a run that checked nothing never looks like a pass.

## Reading the screen

With no findings, it looks like this.

```
$ npx chaffjs article.md

article.md   blog/tech · English   genre from the default

────────────────────────────────────────────────────────────

  No findings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.

  {not-run}

```

With findings, each one gets its own block. This is a run on a real article.

```
$ npx chaffjs sample.md

sample.md   blog/tech · English   genre from the default

─── line 21 ──────────────────────────────────────────────────

    If you imagine MCP, it’s easier to understand: a ToolsAgent is an agent that allows an LLM to call functions (Agents) by…

  ⚠  Sentence too long

     This sentence runs 31 words (limit 25)
     In a long sentence the reader loses the subject before reaching the verb.

     → Split it in two at the conjunction.

     Relax this rule:  npx chaff relax max-sentence-length


─── line 21 ──────────────────────────────────────────────────

    Internally, it passes the tools schema to an OpenAI LLM agent, then dynamically calls the appropriate agent(s) within Gr…

  ⚠  Sentence too long

     This sentence runs 27 words (limit 25)
     In a long sentence the reader loses the subject before reaching the verb.

     → Split it in two at the conjunction.

     Relax this rule:  npx chaff relax max-sentence-length


─── line 142 ─────────────────────────────────────────────────

    Set the tools schema in agentFunctionInfo.

  ⚠  Heading echoed

     The first sentence repeats the heading "agentFunctionInfo"
     When the first sentence repeats the heading, the reader gains nothing by reading on.

     → Start from what the heading promised, not from the heading itself.

     Relax this rule:  npx chaff relax heading-echo
```

From top to bottom, the screen says:

| Part of the screen | What it means |
| --- | --- |
| First line | The file, its genre, its language, and where the genre came from |
| `─── line 21 ───` | One finding starts here; the number is the line |
| The indented sentence | The sentence the finding is about |
| `⚠` and `·` | How serious the finding is, followed by its title |
| The two lines under the title | What is happening, and why it is hard to read |
| The line starting with `→` | How to fix it |
| Relax this rule | The command that adjusts that rule for your team |
| The count at the end | How many findings, and that all of them were judged by machine |
| Rules that did not run | The rules not used this time, each with the reason |

The same text gives the same result every time.
Rules that did not run are listed with their reasons, so you can see what was checked and what was not.

The screen says `npx chaff relax`; when you type it yourself, type `npx chaffjs relax`.
This guide writes commands the way you type them, as `npx chaffjs`.

## Three ways to respond to a finding

Any of them is fine.

| Way | When | What to do |
| --- | --- | --- |
| Fix it | The finding is right | Rewrite the text |
| Silence this spot | The finding is right, but here it is on purpose | Write `<!-- stet: rule-id — reason -->` |
| Change the rule | It does not fit how your team writes | Type `npx chaffjs relax rule-id --why "reason"` |

The third one matters.
Without a way to change the rule, "too noisy, stop using it" is where it ends.

## Choosing what to silence

`stet` marks a finding as intended. It is written as a Markdown comment, so readers never see it.
There are three reaches to choose from.

| Written as | Silences |
| --- | --- |
| `<!-- stet: bold-density — a glossary, on purpose -->` | The paragraph just below it (or the one heading, list or table) |
| `<!-- stet-section: bold-density — a list -->` | Up to the next heading |
| `<!-- stet-file: ai-tell, rule-of-three — mostly quotations -->` | The whole file |

Write the reason after `—`, so whoever reads it later can see why it was silenced.
If you keep silencing the same rule, it is time to change the rule instead.

## What to read next

- What chaff does for internal rules or a business report, with real examples, is in [What chaff does for each kind of document](./documents).
- Everything chaff can find, with an example and its real output, is listed in the [Reference](./reference).
- To fit rule strength and genre to your team, read [Configuration](./configuration).
- Every command and option is listed in [Commands](./commands).
