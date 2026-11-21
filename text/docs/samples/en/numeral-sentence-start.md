<!-- chaff-sample
rule: numeral-sentence-start
genre: business/report
file: open-day.md
-->

# A sentence that opens with a numeral (`numeral-sentence-start`)

**Where it helps:** reports, newsletters, summaries. Any text full of figures, where it is tempting to lead with the number.

## Original

```markdown chaff-before
# School open day: what happened

The open day ran from ten until three on Saturday, 12 April.
Families came from all over the district, and the car park was full by eleven.
140 families signed the visitors' book. 35 of them asked about the after-school club.

We will send the club's timetable to every family who left an email address.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report open-day.md

open-day.md   business/report · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    140 families signed the visitors' book.

  ·  A sentence that opens with a numeral

     The sentence opens with the numeral "140"
     English readers find the start of a sentence by its capital letter. A sentence that opens with a numeral ("20 people came.") hides that boundary, and the number can read as the end of the sentence before. Most English style guides ask for the number to be spelled out at the start of a sentence, or for the sentence to be recast. A year ("2026 was a good year.") cannot be spelled out and is not reported.

     → Spell the number out ("Twenty people came.") or recast the sentence so the number comes later ("The meeting drew 20 people.").

     Relax this rule:  npx chaffjs relax numeral-sentence-start


─── line 5 ───────────────────────────────────────────────────

    35 of them asked about the after-school club.

  ·  A sentence that opens with a numeral

     The sentence opens with the numeral "35"
     English readers find the start of a sentence by its capital letter. A sentence that opens with a numeral ("20 people came.") hides that boundary, and the number can read as the end of the sentence before. Most English style guides ask for the number to be spelled out at the start of a sentence, or for the sentence to be recast. A year ("2026 was a good year.") cannot be spelled out and is not reported.

     → Spell the number out ("Twenty people came.") or recast the sentence so the number comes later ("The meeting drew 20 people.").

     Relax this rule:  npx chaffjs relax numeral-sentence-start


────────────────────────────────────────────────────────────

  2 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# School open day: what happened

The open day ran from ten until three on Saturday, 12 April.
Families came from all over the district, and the car park was full by eleven.
The visitors' book has 140 families in it, and 35 of them asked about the after-school club.

We will send the club's timetable to every family who left an email address.
```

## How it was fixed

An English reader finds where a sentence starts by its capital letter.
"140 families signed the visitors' book. 35 of them asked…" hides that edge: the two numbers run together, and "book. 35" can read as one figure for a moment.

The fix moves the numbers out of the opening position, and joins the two sentences so the second figure follows the first.
Spelling the number out would also work for a small one ("Thirty-five of them asked…"), but large numbers read better recast than spelled.

## Settings

The rule reports a sentence that opens with a numeral.
It is a note at `normal` and `relaxed`, and a warning at `strict`:

```yaml chaff-settings
rules:
  numeral-sentence-start: strict
```

A year ("2026 was a good year."), list items, headings, tables and numbered clauses are not reported.
It reads English only, and does not run on speech transcripts.

```text chaff-explain
$ npx chaffjs explain numeral-sentence-start --genre business/report

  A sentence that opens with a numeral   (numeral-sentence-start)

  English readers find the start of a sentence by its capital letter. A sentence that opens with a numeral ("20 people came.") hides that boundary, and the number can read as the end of the sentence before. Most English style guides ask for the number to be spelled out at the start of a sentence, or for the sentence to be recast. A year ("2026 was a good year.") cannot be spelled out and is not reported.

  How to fix: Spell the number out ("Twenty people came.") or recast the sentence so the number comes later ("The meeting drew 20 people.").

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax numeral-sentence-start --why "reason"
```

[All samples](README.md)
