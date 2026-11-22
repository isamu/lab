<!-- chaff-sample
rule: range-band-mismatch
genre: docs/manual
file: visiting.md
-->

# Bands that overlap or leave a gap (`range-band-mismatch`)

**Where it helps:** ticket and fee tables, dosage tables by age or weight, discount bands, shipping rates. Any table or list of bands that should meet end to end.

## Original

```markdown chaff-before
# Visiting the museum

The museum is open from 10:00 to 17:00, Tuesday to Sunday.

## Tickets

| Age | Ticket |
| --- | --- |
| Under 4 | Free |
| 4 to 12 | $9 |
| 14 to 64 | $16 |
| 65 and over | $11 |

Tickets bought online can be used on any day within three months.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual visiting.md

visiting.md   docs/manual · English   genre from --genre

─── line 11 ──────────────────────────────────────────────────

    14 to 64 | $16 |

  ⚠  Bands that overlap or leave a gap

     The bands "4 to 12" and "14 to 64" leave a gap between them
     When the bands of a table column or a list (ages, weights, amounts, scores) overlap or leave a gap, as "7 to 12" followed by "12 to 14", or "1 to 6 years" followed by "8 years and over", the reader cannot tell which amount a 12-year-old takes or which band a 7-year-old is in. It happens in a dosage or a fee table when only one end of one band is edited. "And over", "or more" and "up to" include their end; "under", "over", "more than" and "less than" do not. Ages, people and points have no value in between, so 6 to 11 then 12 and over is contiguous and two bands that share an end number overlap. Weights, money and durations do, so two bands that meet at one number with a range mark ("50-60 kg", "60-70 kg") are contiguous, and so are two a step of the written digits apart (59 kg then 60 kg).

     → Check the end numbers of the two bands, and correct the wrong one.

     Relax this rule:  npx chaffjs relax range-band-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Visiting the museum

The museum is open from 10:00 to 17:00, Tuesday to Sunday.

## Tickets

| Age | Ticket |
| --- | --- |
| Under 4 | Free |
| 4 to 12 | $9 |
| 13 to 64 | $16 |
| 65 and over | $11 |

Tickets bought online can be used on any day within three months.
```

## How it was fixed

The ticket bands go from "4 to 12" to "14 to 64".
A 13-year-old falls in no band, so the ticket desk and the website can each make up their own answer.

The fix makes the adult band start at 13.
Ages have no value in between, so "4 to 12" followed by "13 to 64" leaves no gap.
For weights, money and durations, bands that meet at one number ("50-60 kg", "60-70 kg") are read as meeting end to end.

## Settings

Bands that overlap or leave a gap are a warning at the default level, an error at `strict` and a note at `relaxed`.

If your tables list bands that are not meant to meet, relax it:

```yaml chaff-settings
rules:
  range-band-mismatch: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain range-band-mismatch --genre docs/manual

  Bands that overlap or leave a gap   (range-band-mismatch)

  When the bands of a table column or a list (ages, weights, amounts, scores) overlap or leave a gap, as "7 to 12" followed by "12 to 14", or "1 to 6 years" followed by "8 years and over", the reader cannot tell which amount a 12-year-old takes or which band a 7-year-old is in. It happens in a dosage or a fee table when only one end of one band is edited. "And over", "or more" and "up to" include their end; "under", "over", "more than" and "less than" do not. Ages, people and points have no value in between, so 6 to 11 then 12 and over is contiguous and two bands that share an end number overlap. Weights, money and durations do, so two bands that meet at one number with a range mark ("50-60 kg", "60-70 kg") are contiguous, and so are two a step of the written digits apart (59 kg then 60 kg).

  How to fix: Check the end numbers of the two bands, and correct the wrong one.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax range-band-mismatch --why "reason"
```

[All samples](README.md)
