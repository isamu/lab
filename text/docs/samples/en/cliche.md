<!-- chaff-sample
rule: cliche
genre: business/report
file: checkout-report.md
-->

# Cliché (`cliche`)

**Where it helps:** reports, project updates, proposals, blog posts. Anywhere a familiar phrase stands in for the result.

## Original

```markdown chaff-before
# Checkout redesign: first month

We shipped the new checkout page to all customers on 4 March.
At the end of the day, the numbers are encouraging.

Fewer people now leave at the payment step, and an order takes less time to complete than it did in February.
The address form was the low-hanging fruit: we cut it from eleven fields to six, and that change alone did most of the work.

To move the needle further, next month we will test saving a card for the next order.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report checkout-report.md

checkout-report.md   business/report · English   genre from --genre

─── line 4 ───────────────────────────────────────────────────

    At the end of the day, the numbers are encouraging.

  ·  Cliché

     "at the end of the day" is a cliché
     "At the end of the day", "low-hanging fruit" and "move the needle" are figures of speech worn down to filler. The reader skims the familiar shape and learns nothing about this document. The phrases are listed in the lexicon, each with what to write instead.

     → Say what the phrase stood for ("low-hanging fruit" → name the easy tasks).

     Relax this rule:  npx chaffjs relax cliche


─── line 7 ───────────────────────────────────────────────────

    The address form was the low-hanging fruit: we cut it from eleven fields to six, and that change alone did most of the w…

  ·  Cliché

     "low-hanging fruit" is a cliché
     "At the end of the day", "low-hanging fruit" and "move the needle" are figures of speech worn down to filler. The reader skims the familiar shape and learns nothing about this document. The phrases are listed in the lexicon, each with what to write instead.

     → Say what the phrase stood for ("low-hanging fruit" → name the easy tasks).

     Relax this rule:  npx chaffjs relax cliche


─── line 9 ───────────────────────────────────────────────────

    To move the needle further, next month we will test saving a card for the next order.

  ·  Cliché

     "move the needle" is a cliché
     "At the end of the day", "low-hanging fruit" and "move the needle" are figures of speech worn down to filler. The reader skims the familiar shape and learns nothing about this document. The phrases are listed in the lexicon, each with what to write instead.

     → Say what the phrase stood for ("low-hanging fruit" → name the easy tasks).

     Relax this rule:  npx chaffjs relax cliche


────────────────────────────────────────────────────────────

  3 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Checkout redesign: first month

We shipped the new checkout page to all customers on 4 March.
In its first month, more orders were completed, and each one took less time.

Fewer people now leave at the payment step: 18 in every 100, down from 26 in February.
The address form was the easiest fix: we cut it from eleven fields to six in two days, and most of the drop came from that change alone.

To bring that figure down further, next month we will test saving a card for the next order.
```

## How it was fixed

"At the end of the day", "low-hanging fruit" and "move the needle" are phrases the reader has seen in a hundred updates.
Each one sits where a result should be, so the reader skims past it and still does not know how well the new checkout did.

The fix says what each phrase stood for.
"The numbers are encouraging" becomes what got better, "low-hanging fruit" becomes the easiest fix and how long it took, and "move the needle" becomes the figure the team wants to move: 18 people in every 100 leaving at payment, down from 26.

## Settings

The rule reports the phrases on chaff's list, each with what to write instead.
At `normal` and `strict` one is enough; `relaxed` waits for two.
To relax it or stop checking:

```yaml chaff-settings
rules:
  cliche: relaxed
```

It does not run on literature or speech transcripts, where a character or a speaker may talk in clichés.
Headings are not read, and a phrase that is only named as a phrase ("the phrase 'low-hanging fruit'") is not reported.

```text chaff-explain
$ npx chaffjs explain cliche --genre business/report

  Cliché   (cliche)

  "At the end of the day", "low-hanging fruit" and "move the needle" are figures of speech worn down to filler. The reader skims the familiar shape and learns nothing about this document. The phrases are listed in the lexicon, each with what to write instead.

  How to fix: Say what the phrase stood for ("low-hanging fruit" → name the easy tasks).

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported once there are 1
  → normal   reported once there are 1
    relaxed  reported once there are 2
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax cliche --why "reason"
```

[All samples](README.md)
