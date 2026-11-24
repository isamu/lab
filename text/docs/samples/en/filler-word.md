<!-- chaff-sample
rule: filler-word
genre: business/meeting-notes
file: minutes.md
-->

# Filler word left in (`filler-word`)

**Where it helps:** minutes and notes made from a recording, by hand or by an AI transcription that kept every "um".

## Original

```markdown chaff-before
# Supplier review: minutes

Present: Ana Ruiz, Ben Cole, Mei Tan.

Um, the current supplier raised its prices by six percent from April.
Ben compared two other quotes. You know, both are cheaper but deliver a week later.
The team agreed to keep the current supplier until the end of June.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/meeting-notes minutes.md

minutes.md   business/meeting-notes · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    Um, the current supplier raised its prices by six percent from April.

  ⚠  Filler word left in

     "Um" is a spoken filler (2 in the document)
     Fillers such as "um" and "you know" fill the pauses of speech while the speaker thinks. Left in minutes or notes made from a transcript, they are words with nothing in them for the reader, and the record no longer reads as written.

     → Delete the filler and keep only what the sentence says.

     Relax this rule:  npx chaffjs relax filler-word


─── line 6 ───────────────────────────────────────────────────

    You know, both are cheaper but deliver a week later.

  ⚠  Filler word left in

     "You know" is a spoken filler (2 in the document)
     Fillers such as "um" and "you know" fill the pauses of speech while the speaker thinks. Left in minutes or notes made from a transcript, they are words with nothing in them for the reader, and the record no longer reads as written.

     → Delete the filler and keep only what the sentence says.

     Relax this rule:  npx chaffjs relax filler-word


────────────────────────────────────────────────────────────

  2 warnings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Supplier review: minutes

Present: Ana Ruiz, Ben Cole, Mei Tan.

The current supplier raised its prices by six percent from April.
Ben compared two other quotes. Both are cheaper but deliver a week later.
The team agreed to keep the current supplier until the end of June.
```

## How it was fixed

"Um" and "you know" were how the speakers paused while they thought; in the minutes they are words with nothing in them.
Deleting them leaves every fact in place: the price rise, the two quotes and the decision.
Nothing was rewritten beyond the fillers, so the minutes still say only what was said.

## Settings

One filler is enough for a finding. With `relaxed`, it takes two:

```yaml chaff-settings
rules:
  filler-word: relaxed
```

"you know", "I mean" and "er" count only where they stand apart, at the head of a sentence or between commas, so "as you know" is not reported.
Words inside quotation marks are someone's words quoted as said.
The rule runs only in business documents and documentation; `speech/transcript`, a verbatim record, keeps its fillers.

```text chaff-explain
$ npx chaffjs explain filler-word --genre business/meeting-notes

  Filler word left in   (filler-word)

  Fillers such as "um" and "you know" fill the pauses of speech while the speaker thinks. Left in minutes or notes made from a transcript, they are words with nothing in them for the reader, and the record no longer reads as written.

  How to fix: Delete the filler and keep only what the sentence says.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported once there is 1 filler
  → normal   reported once there is 1 filler
    relaxed  reported once there are 2 fillers
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax filler-word --why "reason"
```

[All samples](README.md)
