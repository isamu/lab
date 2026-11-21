<!-- chaff-sample
rule: wordy-phrase
genre: business/email
file: parking-email.md
-->

# Wordy phrase (`wordy-phrase`)

**Where it helps:** emails, notices, reports, help pages. Any text a busy reader skims.

## Original

```markdown chaff-before
Subject: Car park closed next Monday

Hi all,

The staff car park is closed next Monday due to the fact that it is being resurfaced.
In order to park that day, please use the public car park on Station Road.
We will pay for it.

At this point in time, we expect the work to finish by Tuesday morning.

Thanks,
Facilities
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email parking-email.md

parking-email.md   business/email · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    The staff car park is closed next Monday due to the fact that it is being resurfaced.

  ·  Wordy phrase

     "due to the fact that" can be said in fewer words
     "In order to", "due to the fact that" and "at this point in time" (することが可能, 現時点において) say in several words what "to", "because" and "now" say in one. The reader reads more and learns nothing more. The phrases and their short forms are listed in the lexicon. Phrases that contracts and statutes use on purpose ("with regard to", "prior to") are left out.

     → Use the short form ("in order to" → "to", "due to the fact that" → "because", "in the event that" → "if"; することが可能です → できます).

     Relax this rule:  npx chaffjs relax wordy-phrase


─── line 6 ───────────────────────────────────────────────────

    In order to park that day, please use the public car park on Station Road.

  ·  Wordy phrase

     "in order to" can be said in fewer words
     "In order to", "due to the fact that" and "at this point in time" (することが可能, 現時点において) say in several words what "to", "because" and "now" say in one. The reader reads more and learns nothing more. The phrases and their short forms are listed in the lexicon. Phrases that contracts and statutes use on purpose ("with regard to", "prior to") are left out.

     → Use the short form ("in order to" → "to", "due to the fact that" → "because", "in the event that" → "if"; することが可能です → できます).

     Relax this rule:  npx chaffjs relax wordy-phrase


─── line 9 ───────────────────────────────────────────────────

    At this point in time, we expect the work to finish by Tuesday morning.

  ·  Wordy phrase

     "at this point in time" can be said in fewer words
     "In order to", "due to the fact that" and "at this point in time" (することが可能, 現時点において) say in several words what "to", "because" and "now" say in one. The reader reads more and learns nothing more. The phrases and their short forms are listed in the lexicon. Phrases that contracts and statutes use on purpose ("with regard to", "prior to") are left out.

     → Use the short form ("in order to" → "to", "due to the fact that" → "because", "in the event that" → "if"; することが可能です → できます).

     Relax this rule:  npx chaffjs relax wordy-phrase


────────────────────────────────────────────────────────────

  3 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Car park closed next Monday

Hi all,

The staff car park is closed next Monday because it is being resurfaced.
Please use the public car park on Station Road that day.
We will pay for it.

We now expect the work to finish by Tuesday morning.

Thanks,
Facilities
```

## How it was fixed

"Due to the fact that", "in order to" and "at this point in time" say in several words what "because", "to" and "now" say in one.
The reader reads more and learns nothing more, and in a notice that most people skim, the date and the place are what should stand out.

The fix uses the short forms.
"In order to park that day" needed no replacement at all: everyone reading it knows why they need a car park.

## Settings

The rule reports the phrases on chaff's list, each with its short form.
At `normal` it reports once two sentences hold one; `strict` reports the first, and `relaxed` waits for four:

```yaml chaff-settings
rules:
  wordy-phrase: relaxed
```

Phrases that contracts use on purpose ("with regard to", "prior to", "in accordance with") are not on the list, and the rule does not run on legal text, literature or speech transcripts.

```text chaff-explain
$ npx chaffjs explain wordy-phrase --genre business/email

  Wordy phrase   (wordy-phrase)

  "In order to", "due to the fact that" and "at this point in time" (することが可能, 現時点において) say in several words what "to", "because" and "now" say in one. The reader reads more and learns nothing more. The phrases and their short forms are listed in the lexicon. Phrases that contracts and statutes use on purpose ("with regard to", "prior to") are left out.

  How to fix: Use the short form ("in order to" → "to", "due to the fact that" → "because", "in the event that" → "if"; することが可能です → できます).

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported once 1 sentences hold one
  → normal   reported once 2 sentences hold one
    relaxed  reported once 4 sentences hold one
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax wordy-phrase --why "reason"
```

[All samples](README.md)
