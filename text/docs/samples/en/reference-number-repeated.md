<!-- chaff-sample
rule: reference-number-repeated
genre: business/report
file: expense-claim.md
-->

# The same receipt or invoice number on two rows of an itemised table (`reference-number-repeated`)

**Where it helps:** expense claims, invoices with line items, payment lists. Any table with one receipt or invoice per row.

## Original

```markdown chaff-before
# Expense claim: client visit to Osaka

Claimed by the sales team for the visit to Minato Foods on May 12 to 14, 2026.

| Date | Receipt no. | Description | Amount |
| --- | --- | --- | --- |
| May 12, 2026 | 20418 | Train, Tokyo to Osaka | $96.40 |
| May 12, 2026 | 20419 | Hotel, two nights | $212.00 |
| May 13, 2026 | 20419 | Dinner with the client | $84.50 |
| May 14, 2026 | 20421 | Train, Osaka to Tokyo | $96.40 |

The receipts are attached in the order of the table.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report expense-claim.md

expense-claim.md   business/report · English   genre from --genre

─── line 9 ───────────────────────────────────────────────────

    20419 | Dinner with the client | $84.50 |

  ⚠  The same receipt or invoice number on two rows of an itemised table

     "20419" in the column "Receipt no." is already on line 8
     In an expense claim or an invoice's line items, each row is one receipt or invoice, and its number appears once in the table. The same number on two rows means either the same receipt is claimed twice or a row was copied and its number not changed. Neither is seen unless the reader checks the numbers one by one. The column is decided by its heading words alone (Receipt no., Invoice no., Voucher no., Ref.). Only cells holding at least one digit are read as numbers; a blank cell, a dash, "none" or "N/A" is not. Case, full-width and half-width forms and spaces are ignored when comparing.

     → If the two rows are different receipts, correct the number; if they are the same receipt, remove one of the rows.

     Relax this rule:  npx chaffjs relax reference-number-repeated


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Expense claim: client visit to Osaka

Claimed by the sales team for the visit to Minato Foods on May 12 to 14, 2026.

| Date | Receipt no. | Description | Amount |
| --- | --- | --- | --- |
| May 12, 2026 | 20418 | Train, Tokyo to Osaka | $96.40 |
| May 12, 2026 | 20419 | Hotel, two nights | $212.00 |
| May 13, 2026 | 20420 | Dinner with the client | $84.50 |
| May 14, 2026 | 20421 | Train, Osaka to Tokyo | $96.40 |

The receipts are attached in the order of the table.
```

## How it was fixed

Receipt 20419 is on two rows: the hotel and the dinner.
Either one receipt is claimed twice, or the dinner row was copied from the hotel row and its number was not changed.
The approver would have to check every number against the paper receipts to see it.

Here the dinner receipt is 20420, so the fix corrects the number.
If two rows really are one receipt, remove one of them.
Only a column whose heading names a receipt, voucher or invoice number is read.

## Settings

A repeated receipt number is a warning at the default level, an error at `strict` and a note at `relaxed`.

If your tables split one receipt over several rows, relax it:

```yaml chaff-settings
rules:
  reference-number-repeated: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain reference-number-repeated --genre business/report

  The same receipt or invoice number on two rows of an itemised table   (reference-number-repeated)

  In an expense claim or an invoice's line items, each row is one receipt or invoice, and its number appears once in the table. The same number on two rows means either the same receipt is claimed twice or a row was copied and its number not changed. Neither is seen unless the reader checks the numbers one by one. The column is decided by its heading words alone (Receipt no., Invoice no., Voucher no., Ref.). Only cells holding at least one digit are read as numbers; a blank cell, a dash, "none" or "N/A" is not. Case, full-width and half-width forms and spaces are ignored when comparing.

  How to fix: If the two rows are different receipts, correct the number; if they are the same receipt, remove one of the rows.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax reference-number-repeated --why "reason"
```

[All samples](README.md)
