<!-- chaff-sample
rule: repeated-conjunction
genre: business/report
file: tools.md
-->

# Paragraphs in a row opening with a connective (`repeated-conjunction`)

**Where it helps:** reports, comparisons, recommendations. Documents that walk through several options one paragraph at a time.

## Original

```markdown chaff-before
# Choosing a project management tool

We tried three tools over the summer with the design team.

However, the first tool was too slow once a board held more than a few hundred cards. People went back to the spreadsheet within a month.

Moreover, the second tool charged for every guest. Half of the people we work with are freelancers who need to see the board.

Additionally, the third tool had everything we needed. But its mobile app could not attach files, which the site team does every day.

We recommend the third tool, with a request to the vendor to fix file attachments before we renew.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report tools.md

tools.md   business/report · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    However, the first tool was too slow once a board held more than a few hundred cards.

  ⚠  Paragraphs keep opening the same way

     3 paragraphs in a row open with a conjunction (limit 2)
     One paragraph opening with a conjunction carries the flow. A run of them makes every paragraph an afterthought.

     → Keep one. Start the others with what you want to say.

     Relax this rule:  npx chaffjs relax repeated-conjunction


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Choosing a project management tool

We tried three tools over the summer with the design team.

The first tool was too slow once a board held more than a few hundred cards. People went back to the spreadsheet within a month.

The second charged for every guest. Half of the people we work with are freelancers who need to see the board.

The third had everything we needed. But its mobile app could not attach files, which the site team does every day.

We recommend the third tool, with a request to the vendor to fix file attachments before we renew.
```

## How it was fixed

Three paragraphs in a row open with "However", "Moreover" and "Additionally".
The words were added to make the report flow, but they say the wrong things: nothing before the first paragraph is contradicted, so "However" has nothing to turn against, and "Additionally" suggests the third tool is one more problem when it is the one the report recommends.

The paragraphs were already in order: first, second, third. The fix deletes the connectives and lets each paragraph open with the tool it is about.
"But" inside the third paragraph stays; it marks the one real turn.

## Settings

At the default level, a run of more than two paragraphs in a row opening with a connective is reported; `strict` reports two and `relaxed` waits for five.
One paragraph opening with a connective is ordinary and is not reported.

```yaml chaff-settings
rules:
  repeated-conjunction: relaxed
```

The rule does not run on literature or on verbatim transcripts.
Sentences, rather than paragraphs, that open with "And" or "But" one after another are a separate rule, `sentence-initial-conjunction-run`.

```text chaff-explain
$ npx chaffjs explain repeated-conjunction --genre business/report

  Paragraphs keep opening the same way   (repeated-conjunction)

  One paragraph opening with a conjunction carries the flow. A run of them makes every paragraph an afterthought.

  How to fix: Keep one. Start the others with what you want to say.

  Levels:
    strict   up to 1 paragraphs in a row opening with a connective
  → normal   up to 2 paragraphs in a row opening with a connective
    relaxed  up to 4 paragraphs in a row opening with a connective
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax repeated-conjunction --why "reason"
```

[All samples](README.md)
