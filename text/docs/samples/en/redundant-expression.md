<!-- chaff-sample
rule: redundant-expression
genre: business/email
file: office-move.md
-->

# Redundant pair (`redundant-expression`)

**Where it helps:** emails, notices, reports. Text written quickly and sent without a second read.

## Original

```markdown chaff-before
Subject: Office move on Friday

Hi all,

The new desks arrive on Friday morning, so please clear your desk by Thursday evening.
Each and every box needs your name and your new desk number on the lid.

If the new layout does not work, we can revert back to the old one.

Thanks,
Priya
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email office-move.md

office-move.md   business/email · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    Each and every box needs your name and your new desk number on the lid.

  ·  Redundant pair

     "each and every" says the same thing twice
     Two words that say the same thing ("end result", "each and every", "revert back") make the reader look for a meaning in the second word that is not there, and read as unedited. Dropping the repeat changes nothing. The pairs are listed in each language's lexicon, each with the form to use instead. Idioms that are sometimes needed ("whether or not", "period of time") are not counted.

     → Drop the repeat ("end result" → "result", "revert back" → "revert").

     Relax this rule:  npx chaffjs relax redundant-expression


─── line 8 ───────────────────────────────────────────────────

    If the new layout does not work, we can revert back to the old one.

  ·  Redundant pair

     "revert back" says the same thing twice
     Two words that say the same thing ("end result", "each and every", "revert back") make the reader look for a meaning in the second word that is not there, and read as unedited. Dropping the repeat changes nothing. The pairs are listed in each language's lexicon, each with the form to use instead. Idioms that are sometimes needed ("whether or not", "period of time") are not counted.

     → Drop the repeat ("end result" → "result", "revert back" → "revert").

     Relax this rule:  npx chaffjs relax redundant-expression


────────────────────────────────────────────────────────────

  2 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Office move on Friday

Hi all,

The new desks arrive on Friday morning, so please clear your desk by Thursday evening.
Every box needs your name and your new desk number on the lid.

If the new layout does not work, we can revert to the old one.

Thanks,
Priya
```

## How it was fixed

"Each and every" and "revert back" say the same thing twice.
"Every" already means each one; "revert" already means go back.
The reader looks for something the second word adds, finds nothing, and the email reads as if nobody edited it.

The fix drops the repeat. Nothing in the meaning changed, and both sentences are shorter.

## Settings

The rule reports the pairs listed in chaff's lexicon, each with the form to use instead.
At `normal` and `strict` one sentence with a pair is enough; `relaxed` waits for two:

```yaml chaff-settings
rules:
  redundant-expression: relaxed
```

Idioms that are sometimes needed, such as "whether or not", "period of time" and "plan ahead", are not reported.
It does not run on literature, where repetition can be the author's choice.

```text chaff-explain
$ npx chaffjs explain redundant-expression --genre business/email

  Redundant pair   (redundant-expression)

  Two words that say the same thing ("end result", "each and every", "revert back") make the reader look for a meaning in the second word that is not there, and read as unedited. Dropping the repeat changes nothing. The pairs are listed in each language's lexicon, each with the form to use instead. Idioms that are sometimes needed ("whether or not", "period of time") are not counted.

  How to fix: Drop the repeat ("end result" → "result", "revert back" → "revert").

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported once 1 sentence holds one
  → normal   reported once 1 sentence holds one
    relaxed  reported once 2 sentences hold one
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax redundant-expression --why "reason"
```

[All samples](README.md)
