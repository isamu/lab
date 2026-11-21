<!-- chaff-sample
rule: demonstrative-opener-run
genre: business/report
file: notice.md
-->

# Sentences in a row opening with a demonstrative (`demonstrative-opener-run`)

**Where it helps:** internal notices, reports, policy changes. Paragraphs that explain one change and then its effects.

## Original

```markdown chaff-before
# Change to the expense approval process

From 1 February, expense claims under 200 euros no longer need a manager's approval.
This applies to travel, meals and small purchases.
This means most claims will be paid within three working days instead of ten.
It also removes about a third of the requests that managers approve each month.
This was the main complaint in last year's staff survey.

Claims of 200 euros or more still go to the manager first.
Finance will check a random sample of the smaller claims every quarter.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report notice.md

notice.md   business/report · English   genre from --genre

─── line 4 ───────────────────────────────────────────────────

    This applies to travel, meals and small purchases.This means most claims will be paid within three working days instead …

  ·  Sentences in a row opening with a demonstrative

     4 sentences in a row open with a word that points back, such as "This" (limit 2)
     Sentence after sentence opening with a word that points back (This, That, It; これは, その結果) sends the reader back each time to find what it points at, and blurs whether it means the last sentence or one before. Only runs within one paragraph are counted.

     → Replace one of the demonstratives with the noun it points at (This → The new procedure; その結果 → 調査の結果).

     Relax this rule:  npx chaffjs relax demonstrative-opener-run


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Change to the expense approval process

From 1 February, expense claims under 200 euros no longer need a manager's approval.
The change applies to travel, meals and small purchases.
Most claims will now be paid within three working days instead of ten.
Managers will have about a third fewer requests to approve each month.
The ten-day wait was the main complaint in last year's staff survey.

Claims of 200 euros or more still go to the manager first.
Finance will check a random sample of the smaller claims every quarter.
```

## How it was fixed

Four sentences in a row open with "This" or "It".
Each one sends the reader back to find what it points at, and by the last one the answer is no longer clear: "This was the main complaint" could mean the approval step, the ten-day wait or the managers' workload.
The writer knew; the reader has to guess.

The fix names the thing each time: "The change", "Most claims", "Managers", "The ten-day wait".
The sentences are no longer, and the last one now says plainly what staff complained about.

## Settings

Only runs inside one paragraph are counted. In the default level, a run of more than two such sentences is reported; `strict` reports two and `relaxed` waits for four.

```yaml chaff-settings
rules:
  demonstrative-opener-run: relaxed
```

The rule does not run on literature, where repetition can be the author's choice.

```text chaff-explain
$ npx chaffjs explain demonstrative-opener-run --genre business/report

  Sentences in a row opening with a demonstrative   (demonstrative-opener-run)

  Sentence after sentence opening with a word that points back (This, That, It; これは, その結果) sends the reader back each time to find what it points at, and blurs whether it means the last sentence or one before. Only runs within one paragraph are counted.

  How to fix: Replace one of the demonstratives with the noun it points at (This → The new procedure; その結果 → 調査の結果).

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   up to 1 such sentences in a row
  → normal   up to 2 such sentences in a row
    relaxed  up to 3 such sentences in a row
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax demonstrative-opener-run --why "reason"
```

[All samples](README.md)
