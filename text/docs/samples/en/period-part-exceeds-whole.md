<!-- chaff-sample
rule: period-part-exceeds-whole
genre: docs/manual
file: warranty.md
-->

# A part of a period that is longer than the period (`period-part-exceeds-whole`)

**Where it helps:** warranty cards, service terms, leases, subscription terms. Any document that sets a period and then a shorter period inside it.

## Original

```markdown chaff-before
# Warranty for your cordless vacuum cleaner

Thank you for buying the AirLite V8. Please keep your receipt: you will need it to make a claim.

## What is covered

The warranty period is 2 years from the date of purchase. Within the warranty period, the battery replacement period is 30 months.

## What is not covered

Filters, brushes and damage from dropping the cleaner are not covered.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual warranty.md

warranty.md   docs/manual · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    30 months.

  ⚠  A part of a period that is longer than the period

     "30 months" is longer than the period it is part of, "2 years"
     When a card says "Within the 12-month warranty period, the free replacement period is 18 months", the reader has to ask whether replacement is free in months 13 to 18. It happens when one of the two lengths is updated and the other is not, or when a part is copied from another product's terms. The period after "within the", or before "of the", is the whole, and the one other length in the sentence is the part; the part is reported when it is longer. The whole's length is read where it is named (the 12-month warranty period, the warranty period (12 months)); otherwise from the same section, in a sentence or table row that names the whole ("The warranty period is 1 year", "the warranty runs for 12 months"). When the section gives several lengths, the longest is used. "Within it" takes the length in the sentence before. Years are converted to months and weeks to days.

     → Correct whichever length is wrong. If the period follows the whole (an extended warranty), say so ("after the warranty period ends").

     Relax this rule:  npx chaffjs relax period-part-exceeds-whole


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Warranty for your cordless vacuum cleaner

Thank you for buying the AirLite V8. Please keep your receipt: you will need it to make a claim.

## What is covered

The warranty period is 2 years from the date of purchase. Within the warranty period, the battery replacement period is 12 months.

## What is not covered

Filters, brushes and damage from dropping the cleaner are not covered.
```

## How it was fixed

The battery cover is said to be part of the 2-year warranty, yet it runs for 30 months.
Thirty months is longer than two years, so the sentence contradicts itself: is the battery covered in months 25 to 30, or not?
A customer whose battery fails in month 27 will read this sentence as a promise, and the shop will read it the other way.

The battery figure came from another model's card; this model's battery is covered for 12 months.
The fix writes the length that sits inside the warranty.
If the battery really is covered for longer than the rest, say that it runs past the warranty ("the battery is covered for 30 months, beyond the 2-year warranty") rather than "within" it.

## Settings

A part longer than its whole is a warning at the default level; `strict` makes it an error and `relaxed` a note:

```yaml chaff-settings
rules:
  period-part-exceeds-whole: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

The whole is the period after "within the" or before "of the", and its length is read where it is named or from the same section ("The warranty period is 2 years").
The part must be another named period in the same sentence.
A sentence with "extended", "additional" or "renewal", a length with "about" or "up to", and a range are not read.
Years are turned into months and weeks into days; months are never compared with days.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain period-part-exceeds-whole --genre docs/manual

  A part of a period that is longer than the period   (period-part-exceeds-whole)

  When a card says "Within the 12-month warranty period, the free replacement period is 18 months", the reader has to ask whether replacement is free in months 13 to 18. It happens when one of the two lengths is updated and the other is not, or when a part is copied from another product's terms. The period after "within the", or before "of the", is the whole, and the one other length in the sentence is the part; the part is reported when it is longer. The whole's length is read where it is named (the 12-month warranty period, the warranty period (12 months)); otherwise from the same section, in a sentence or table row that names the whole ("The warranty period is 1 year", "the warranty runs for 12 months"). When the section gives several lengths, the longest is used. "Within it" takes the length in the sentence before. Years are converted to months and weeks to days.

  How to fix: Correct whichever length is wrong. If the period follows the whole (an extended warranty), say so ("after the warranty period ends").

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax period-part-exceeds-whole --why "reason"
```

[All samples](README.md)
