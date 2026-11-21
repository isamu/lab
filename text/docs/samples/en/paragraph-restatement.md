<!-- chaff-sample
rule: paragraph-restatement
genre: business/report
file: campaign.md
-->

# Paragraph restates the one before (`paragraph-restatement`)

**Where it helps:** reports, reviews, summaries. Anywhere a writer adds "In other words" to make sure the point got across.

## Original

```markdown chaff-before
# Why the spring campaign missed its target

The campaign brought in 1,800 new subscribers against a target of 3,000. Most of the shortfall came from the radio adverts, which ran in the morning slot when our listeners are driving and cannot visit a website. The online adverts met their share of the target.

In other words, the radio adverts ran in the morning slot, when listeners are driving and cannot visit the website, so most of the shortfall came from radio while the online adverts met their target.

For the autumn campaign we will move the radio budget to the evening slot and add a short code that listeners can text.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report campaign.md

campaign.md   business/report · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    In other words, the radio adverts ran in the morning slot, when listeners are driving and cannot visit the website, so m…

  ·  A paragraph that only restates the one before

     This paragraph opens with "In other words" and 87% of its content words repeat the paragraph before
     When a paragraph opens with "In other words" or "In short" and then uses mostly the words of the paragraph before it, the reader reads the same thing twice. A summary helps only when it adds something the paragraph before did not say (the conclusion, what to do next, a figure). chaff counts, for a paragraph that opens with a restating word (from the lexicon), the share of its content words (nouns, verbs, adjectives, adverbs, numbers) already in the paragraph before.

     → Cut the paragraph and let the one before stand. If a summary is needed, make it say what the paragraph before did not (the conclusion, the next step, a figure).

     Relax this rule:  npx chaffjs relax paragraph-restatement


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Why the spring campaign missed its target

The campaign brought in 1,800 new subscribers against a target of 3,000. Most of the shortfall came from the radio adverts, which ran in the morning slot when our listeners are driving and cannot visit a website. The online adverts met their share of the target.

For the autumn campaign we will move the radio budget to the evening slot and add a short code that listeners can text.
```

## How it was fixed

The second paragraph opens with "In other words" and then says the first paragraph again in almost the same words: the radio adverts, the morning slot, the drivers, the shortfall, the online adverts.
The reader learns nothing new from it, and a busy reader may wonder whether they missed a difference.

The first paragraph already says it plainly, so the fix deletes the restatement.
The report now goes straight from the cause to what will change in the autumn.
A summary paragraph is worth keeping only when it adds something: a conclusion, a next step, a figure.

## Settings

chaff looks only at a paragraph that opens with a restating phrase such as "In other words" or "In short", and measures how many of its content words (nouns, verbs, adjectives, adverbs, numbers) are already in the paragraph just before.
At the default level it reports 50 percent or more; `strict` reports 40 percent and `relaxed` 60 percent.
A paragraph after a heading, a list, a table or code is not compared, nor is one whose summing-up sentence is followed by sentences that move on.

```yaml chaff-settings
rules:
  paragraph-restatement: relaxed
```

The rule does not run on legal documents, literature or speeches, where saying it again is part of the form.

```text chaff-explain
$ npx chaffjs explain paragraph-restatement --genre business/report

  A paragraph that only restates the one before   (paragraph-restatement)

  When a paragraph opens with "In other words" or "In short" and then uses mostly the words of the paragraph before it, the reader reads the same thing twice. A summary helps only when it adds something the paragraph before did not say (the conclusion, what to do next, a figure). chaff counts, for a paragraph that opens with a restating word (from the lexicon), the share of its content words (nouns, verbs, adjectives, adverbs, numbers) already in the paragraph before.

  How to fix: Cut the paragraph and let the one before stand. If a summary is needed, make it say what the paragraph before did not (the conclusion, the next step, a figure).

  Rewrite depth: structure (sections, headings and paragraphs are reorganised). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported when 40% or more of the paragraph's content words repeat the paragraph before
  → normal   reported when 50% or more of the paragraph's content words repeat the paragraph before
    relaxed  reported when 60% or more of the paragraph's content words repeat the paragraph before
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax paragraph-restatement --why "reason"
```

[All samples](README.md)
