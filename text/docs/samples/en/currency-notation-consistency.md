<!-- chaff-sample
rule: currency-notation-consistency
genre: business/report
file: costs.md
-->

# A currency written two ways (`currency-notation-consistency`)

**Where it helps:** expense reports, quotes, travel budgets. Any document that gathers prices from several sources.

## Original

```markdown chaff-before
# Trade fair in Chicago: costs

The stand cost $4,800 for the three days, including power and one table.
Flights for the four of us came to $2,900, booked six weeks ahead.
The hotel near the venue charged $180 a night per room.
The printed brochures were invoiced at USD 650 by the local printer.

Next year we can save on the hotel by booking before the fair opens its block of rooms.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report costs.md

costs.md   business/report · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    es were invoiced at USD 650 by the local printe

  ·  A currency written two ways

     "USD 650" here, where the document usually writes this currency like "$4,800" (1 of 4)
     When one currency is written two ways in one document ("$20" and "USD 20", "1,000円" and "¥1,000"), the reader wonders whether a different currency or a different kind of amount is meant. It happens when quotes and notes are pasted together. chaff does not decide which way is right; for each currency it points at the way the document uses less. Amounts in table cells are counted too.

     → Match the way the rest of the document writes the currency. If the team has decided, write it in the style guide.

     Relax this rule:  npx chaffjs relax currency-notation-consistency


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Trade fair in Chicago: costs

The stand cost $4,800 for the three days, including power and one table.
Flights for the four of us came to $2,900, booked six weeks ahead.
The hotel near the venue charged $180 a night per room.
The printed brochures were invoiced at $650 by the local printer.

Next year we can save on the hotel by booking before the fair opens its block of rooms.
```

## How it was fixed

Every cost is written with the dollar sign, except the brochures, which keep "USD" from the printer's invoice.
The reader stops to ask whether it is another currency, or a figure that has not been converted yet.

The fix writes it as "$650", like the rest of the report.
chaff does not decide which way is right. A report that writes "USD" throughout would have the "$" amounts pointed at instead.

## Settings

The rarer way is reported while it is at most a third of that currency's amounts (34% at `normal`, 49% at `strict`, 20% at `relaxed`).
Above that, the document is read as using both on purpose ("USD" in tables, "$" in prose).
Each currency is compared with itself, so dollars beside euros is not a mix. Amounts in table cells are counted too.

To stop checking:

```yaml chaff-settings
rules:
  currency-notation-consistency: off
```

```text chaff-explain
$ npx chaffjs explain currency-notation-consistency --genre business/report

  A currency written two ways   (currency-notation-consistency)

  When one currency is written two ways in one document ("$20" and "USD 20", "1,000円" and "¥1,000"), the reader wonders whether a different currency or a different kind of amount is meant. It happens when quotes and notes are pasted together. chaff does not decide which way is right; for each currency it points at the way the document uses less. Amounts in table cells are counted too.

  How to fix: Match the way the rest of the document writes the currency. If the team has decided, write it in the style guide.

  Levels:
    strict   reported when the less common way is 49% of that currency's amounts or less
  → normal   reported when the less common way is 34% of that currency's amounts or less
    relaxed  reported when the less common way is 20% of that currency's amounts or less
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax currency-notation-consistency --why "reason"
```

[All samples](README.md)
