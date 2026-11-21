<!-- chaff-sample
rule: discount-rate-mismatch
genre: business/press-release
file: price-list.md
-->

# A discount that the list price and the tier price do not give (`discount-rate-mismatch`)

**Where it helps:** volume price lists, rate cards, promotions. Any table that gives a price and the discount it stands for.

## Original

```markdown chaff-before
# Volume prices: printed flyers

The list price is $0.40 per flyer, A5, printed both sides in full colour. Larger orders get a lower price per flyer.

| Order size | Price per flyer | Discount |
| --- | --- | --- |
| 500 to 999 | $0.36 | 10% |
| 1,000 to 4,999 | $0.32 | 20% |
| 5,000 or more | $0.30 | 20% |

Prices include delivery to one address. Orders placed by noon are printed the same day.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/press-release price-list.md

price-list.md   business/press-release · English   genre from --genre

─── line 9 ───────────────────────────────────────────────────

    20% |

  ⚠  A discount that the list price and the tier price do not give

     The discount 20% is not what the list price $0.40 and the price $0.30 give (25%)
     On a volume price list, with a list price of $0.080 per envelope and a tier price of $0.072, the discount is 10%. When the discount column says something else, the reader cannot tell whether the price or the discount is right. It happens when a price is corrected and its discount is not, or when another tier's rate is copied. The two cells of one row, in the columns whose headings name the discount and the price, are compared with the list price: a list-price column of the table, else the one list price the document states, in a sentence ("The list price is $0.080 per envelope") or a row (| List price | $0.080 |). The discount is 1 − tier price ÷ list price, rounded to the digits the rate is written to.

     → Check the list price and the tier price, and work the discount out again.

     Relax this rule:  npx chaffjs relax discount-rate-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Volume prices: printed flyers

The list price is $0.40 per flyer, A5, printed both sides in full colour. Larger orders get a lower price per flyer.

| Order size | Price per flyer | Discount |
| --- | --- | --- |
| 500 to 999 | $0.36 | 10% |
| 1,000 to 4,999 | $0.32 | 20% |
| 5,000 or more | $0.30 | 25% |

Prices include delivery to one address. Orders placed by noon are printed the same day.
```

## How it was fixed

At a list price of $0.40, a flyer at $0.30 is 25% off, but the top row says 20%.
The row was added last, and its discount was copied from the row above.
A customer comparing tiers cannot tell which is right: if the discount is right, the price should be $0.32 and the top tier gives nothing extra; if the price is right, the table undersells the best offer on the page.

The $0.30 price is the one the printer charges, so the fix works the discount out again from it: 25%.
Now each row's price and discount say the same thing.

## Settings

The rule is a warning at `normal`, an error at `strict` and a note at `relaxed`:

```yaml chaff-settings
rules:
  discount-rate-mismatch: relaxed
```

In each row, the discount and the price are compared with the list price: a list-price column of the table, or the one list price the document states in a sentence or a row.
The discount is 1 − tier price ÷ list price, and rounding to the digits the rate is written to is read as right.
Nothing is compared with no list price, with two different list prices, or with prices in different units.
A column whose heading names tax, markup or margin is not read as a discount.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain discount-rate-mismatch --genre business/press-release

  A discount that the list price and the tier price do not give   (discount-rate-mismatch)

  On a volume price list, with a list price of $0.080 per envelope and a tier price of $0.072, the discount is 10%. When the discount column says something else, the reader cannot tell whether the price or the discount is right. It happens when a price is corrected and its discount is not, or when another tier's rate is copied. The two cells of one row, in the columns whose headings name the discount and the price, are compared with the list price: a list-price column of the table, else the one list price the document states, in a sentence ("The list price is $0.080 per envelope") or a row (| List price | $0.080 |). The discount is 1 − tier price ÷ list price, rounded to the digits the rate is written to.

  How to fix: Check the list price and the tier price, and work the discount out again.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax discount-rate-mismatch --why "reason"
```

[All samples](README.md)
