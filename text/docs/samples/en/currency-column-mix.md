<!-- chaff-sample
rule: currency-column-mix
genre: business/proposal
file: freight-quote.md
-->

# One amount in another currency in a column of amounts (`currency-column-mix`)

**Where it helps:** freight quotes, invoices, expense claims, budgets. Any table where amounts from several sources are put in one column.

## Original

```markdown chaff-before
# Freight quotation: Yokohama to Seattle

Shipment: one 20-foot container of machine parts, door to port.

| Charge | Amount |
| --- | --- |
| Ocean freight | $640.00 |
| Origin terminal handling | $210.00 |
| Marine insurance | ¥12,500 |
| Documentation fee | $40.00 |

Rates are valid for sailings until 15 December and exclude US customs duties.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/proposal freight-quote.md

freight-quote.md   business/proposal · English   genre from --genre

─── line 9 ───────────────────────────────────────────────────

    ¥12,500 |

  ⚠  One amount in another currency in a column of amounts

     "Marine insurance" is written "¥12,500", in another currency than the rest of its column ("$640.00")
     When one cell of a column of dollar amounts reads "¥12,500", the reader adds or compares it with the others without noticing it is in another currency. It happens when a row is copied from another quotation or a foreign invoice, or when an amount is not converted. For each column of a table, the currencies of its amounts are counted (¥ and yen are one currency); when at least two cells are in one currency and exactly one cell is in another, that cell is pointed out.

     → Convert the amount to the column's currency, or, if it really is paid in another currency, name the currency in the row's label or the column's heading ("Marine insurance (JPY)").

     Relax this rule:  npx chaffjs relax currency-column-mix


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Freight quotation: Yokohama to Seattle

Shipment: one 20-foot container of machine parts, door to port.

| Charge | Amount |
| --- | --- |
| Ocean freight | $640.00 |
| Origin terminal handling | $210.00 |
| Marine insurance | $85.00 |
| Documentation fee | $40.00 |

Rates are valid for sailings until 15 December and exclude US customs duties.
```

## How it was fixed

Three charges are in dollars and one is in yen.
The insurance line was copied from the insurer's Japanese invoice and never converted.
A buyer adding up the column, or a spreadsheet doing it for them, reads ¥12,500 as 12,500 dollars, or skips it and quotes a total that is short.

The fix converts the insurance to dollars at the rate of the day, so the column can be added.
If a charge really is paid in another currency, keep it, and say so in the row's label ("Marine insurance (JPY)"); chaff then leaves it alone.

## Settings

The rule is a warning at `normal`, an error at `strict` and a note at `relaxed`:

```yaml chaff-settings
rules:
  currency-column-mix: relaxed
```

A cell is reported only when at least two cells of its column are in one currency and it is the only one in another.
A table with a column of currencies or exchange rates, a heading that names two currencies ("Amount (JPY/USD)"), and a cell that gives both ("¥12,500 (USD 85)") are left alone.
¥ and yen count as one currency, and so do $ and US$.

```text chaff-explain
$ npx chaffjs explain currency-column-mix --genre business/proposal

  One amount in another currency in a column of amounts   (currency-column-mix)

  When one cell of a column of dollar amounts reads "¥12,500", the reader adds or compares it with the others without noticing it is in another currency. It happens when a row is copied from another quotation or a foreign invoice, or when an amount is not converted. For each column of a table, the currencies of its amounts are counted (¥ and yen are one currency); when at least two cells are in one currency and exactly one cell is in another, that cell is pointed out.

  How to fix: Convert the amount to the column's currency, or, if it really is paid in another currency, name the currency in the row's label or the column's heading ("Marine insurance (JPY)").

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax currency-column-mix --why "reason"
```

[All samples](README.md)
