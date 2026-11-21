<!-- chaff-sample
rule: uncomparable-graded
genre: business/proposal
file: venue-proposal.md
-->

# An uncomparable adjective given a degree (`uncomparable-graded`)

**Where it helps:** proposals, product pages, reviews. Anywhere a writer reaches for emphasis.

## Original

```markdown chaff-before
# Proposal: the boathouse for the summer party

We propose holding the summer party at the old boathouse on the river.
The venue is very unique: the hall opens straight onto a terrace over the water, and it holds up to 120 people.

It is free on both of the Fridays we had in mind, and the hire fee includes the tables and the lighting.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/proposal venue-proposal.md

venue-proposal.md   business/proposal · English   genre from --genre

─── line 4 ───────────────────────────────────────────────────

    The venue is very unique: the hall opens straight onto a terrace over the water, and it holds up to 120 people.

  ·  An uncomparable adjective given a degree

     "very unique" grades an adjective that has no degrees
     "Unique", "unanimous" and "impossible" (最適, 完璧) name a state that holds or does not. "Very unique" or "more unanimous" (より最適な, とても完璧) adds nothing, and tells the reader the writer did not weigh the word. The phrases are listed in the lexicon.

     → Drop the grade, or use a word that has degrees ("very unique" → "unique", or "unusual"; より最適な → 最適な, or より適した).

     Relax this rule:  npx chaffjs relax uncomparable-graded


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Proposal: the boathouse for the summer party

We propose holding the summer party at the old boathouse on the river.
No other venue we looked at has anything like it: the hall opens straight onto a terrace over the water, and it holds up to 120 people.

It is free on both of the Fridays we had in mind, and the hire fee includes the tables and the lighting.
```

## How it was fixed

"Unique" means the only one of its kind; something cannot be more or less the only one.
"Very unique" tells the reader the writer was reaching for emphasis without weighing the word, and the emphasis falls flat.

The fix says what makes the venue stand out, and how it compares: none of the others had a terrace over the water.
"Unique" alone, or "unusual", would also have been fine.

## Settings

The rule reports the pairs on chaff's list ("very unique", "more unanimous", "completely perfect" and so on).
At `normal` and `strict` one is enough; `relaxed` waits for two:

```yaml chaff-settings
rules:
  uncomparable-graded: relaxed
```

Words that say how close ("almost unique", "nearly impossible") are not reported.
It does not run on literature, where a character may well say "very unique".

```text chaff-explain
$ npx chaffjs explain uncomparable-graded --genre business/proposal

  An uncomparable adjective given a degree   (uncomparable-graded)

  "Unique", "unanimous" and "impossible" (最適, 完璧) name a state that holds or does not. "Very unique" or "more unanimous" (より最適な, とても完璧) adds nothing, and tells the reader the writer did not weigh the word. The phrases are listed in the lexicon.

  How to fix: Drop the grade, or use a word that has degrees ("very unique" → "unique", or "unusual"; より最適な → 最適な, or より適した).

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported once there is 1
  → normal   reported once there is 1
    relaxed  reported once there are 2
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax uncomparable-graded --why "reason"
```

[All samples](README.md)
