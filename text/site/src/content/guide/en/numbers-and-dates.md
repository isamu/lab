# Numbers and dates that disagree

Many mistakes in paperwork are two places in one document that do not agree.
A total is not the sum of its rows, a net amount is not the gross less the deductions, a return comes before the departure, or one booking number is written two ways.
chaff finds these by machine, in Japanese and in English.
It does not know which of the two places is right; that is for the writer to find out.

## What a finding means

A finding of this kind says one thing: two places in the document disagree.
It does not say which one is wrong.
The total may be wrong, or one of the rows above it; the rate may be wrong, or the amount it was applied to.

| Do | Do not |
| --- | --- |
| Look at both places the finding names | Change the figure the finding points at, just because it points there |
| Check them against the source: the receipt, the timesheet, the bank's own record, the booking | Change a figure that was right so that the two agree |
| Fix the one that is wrong, then run chaff again | Adjust both until they merely match |

When you cannot tell which is right, leave both and ask the person who knows.

## Try it

The expense claim below was saved as `claim.md`. The names are made up.

```markdown file=claim.md
# Expense claim: Leeds visit

Claimant: Priya Natarajan
Departure: 14 October 2026
Return: 16 October 2026

| Date | Item | Quantity | Unit price | Amount |
| --- | --- | --- | --- | --- |
| 14 Oct | Train, return | 1 | £86.40 | £86.40 |
| 14 Oct | Hotel, per night | 2 | £95.00 | £180.00 |
| 15 Oct | Dinner with a client | 1 | £42.50 | £42.50 |
| Total | | | | £318.90 |
```

```bash
npx chaffjs claim.md --genre business/report --compact    check claim.md, one line per finding
```

```
$ npx chaffjs claim.md --genre business/report --compact

claim.md   business/report · English   genre from --genre

  10:44   error   The amount £180.00 is not quantity × unit price (2 × £95.00 = £190.00)
                  line-amount-mismatch
  12:18   error   The total £318.90 is not the sum of its items (£308.90)
                  total-mismatch

{counts}
```

There are two findings, but there is one mistake.

| Line | Finding | What it means |
| --- | --- | --- |
| 10 | [`line-amount-mismatch`](../../rules/line-amount-mismatch/) | 2 nights at £95.00 is £190.00, but the row says £180.00 |
| 12 | [`total-mismatch`](../../rules/total-mismatch/) | The rows add up to £308.90, but the total says £318.90 |

The hotel receipt says £190.00, so the row is wrong and the total is right.
Fixing the row clears both findings.

```markdown file=claim-fixed.md
# Expense claim: Leeds visit

Claimant: Priya Natarajan
Departure: 14 October 2026
Return: 16 October 2026

| Date | Item | Quantity | Unit price | Amount |
| --- | --- | --- | --- | --- |
| 14 Oct | Train, return | 1 | £86.40 | £86.40 |
| 14 Oct | Hotel, per night | 2 | £95.00 | £190.00 |
| 15 Oct | Dinner with a client | 1 | £42.50 | £42.50 |
| Total | | | | £318.90 |
```

```
$ npx chaffjs claim-fixed.md --genre business/report --compact

claim-fixed.md   business/report · English   genre from --genre


{counts}
```

## Silencing it the wrong way

Suppose the total had been changed to £308.90 instead, to match the rows.
The total finding goes away, and the row is still flagged.
Suppose the unit price had then been changed to £90.00 as well.
chaff is quiet, and the claim is £10.00 short.

```markdown file=claim-quiet.md
# Expense claim: Leeds visit

Claimant: Priya Natarajan
Departure: 14 October 2026
Return: 16 October 2026

| Date | Item | Quantity | Unit price | Amount |
| --- | --- | --- | --- | --- |
| 14 Oct | Train, return | 1 | £86.40 | £86.40 |
| 14 Oct | Hotel, per night | 2 | £90.00 | £180.00 |
| 15 Oct | Dinner with a client | 1 | £42.50 | £42.50 |
| Total | | | | £308.90 |
```

```
$ npx chaffjs claim-quiet.md --genre business/report --compact

claim-quiet.md   business/report · English   genre from --genre


{counts}
```

No findings means the document agrees with itself, not that it agrees with the receipts.
Only the source can say which figure is right.

## What chaff compares

Each row below is a short document and what chaff printed for it.
The rule's name links to its page, with more examples and what it leaves alone.

| What is compared | Written | What chaff says |
| --- | --- | --- |
| A total and its rows ([`total-mismatch`](../../rules/total-mismatch/)) | Rows of £86.40, £180.00 and £42.50, then `Total` £318.90 | The total £318.90 is not the sum of its items (£308.90) |
| Quantity × unit price and the amount ([`line-amount-mismatch`](../../rules/line-amount-mismatch/)) | Quantity 2, unit price £95.00, amount £180.00 | The amount £180.00 is not quantity × unit price (2 × £95.00 = £190.00) |
| A net amount and the gross less the deductions ([`net-amount-mismatch`](../../rules/net-amount-mismatch/)) | Gross pay: $3,293.00 / Total deductions: $714.96 / Net pay: $2,587.04 | "$2,587.04" is written, but the gross amount minus the deductions is $2,578.04 |
| A closing balance and the movements ([`closing-balance-mismatch`](../../rules/closing-balance-mismatch/)) | Opening balance: $2,418.36 / Total deposits: $2,941.80 / Total withdrawals: $3,203.60 / Closing balance: $2,165.56 | "$2,165.56" is written, but the opening balance plus deposits less withdrawals is $2,156.56 |
| Tax and the amount it is on ([`tax-mismatch`](../../rules/tax-mismatch/)) | Subtotal $8,000, Sales tax (10%) $880 | The tax $880 is not 10% of the amount above it ($800) |
| Interest and the balance at the rate ([`interest-mismatch`](../../rules/interest-mismatch/)) | average balance $3,600.00 × rate 0.50% = $1.80 | The interest $1.80 is not the balance $3,600.00 at 0.50% ($18.00) |
| A variance and the budget and actual ([`variance-mismatch`](../../rules/variance-mismatch/)) | Budget $400.00, actual $434.50, variance $43.50 | "Refreshments" shows a variance of "$43.50", but its budget and actual give "$34.50" |
| A rate of change in a sentence ([`change-rate-mismatch`](../../rules/change-rate-mismatch/)) | Revenue was $1.0 million in 2025 and $1.5 million in 2026, up 20%. | "20%" is written, but the two values give 50% |
| Two dates that come in order ([`due-before-issue`](../../rules/due-before-issue/)) | Check-in: 12 November 2026 / Check-out: 10 November 2026 | "Check-out" 10 November 2026 is before "Check-in" 12 November 2026 |
| One number written two ways ([`reference-number-variant`](../../rules/reference-number-variant/)) | Policy number: PL-48213, later policy number PL-48231 | The number PL-48231 is PL-48213 with two neighbouring characters swapped |
| One item given two values ([`fact-conflict`](../../rules/fact-conflict/)) | Fee: $300, later "The fee is $350." | "The fee" is $350 here, but $300 earlier in the same section |

The interest row shows why chaff cannot choose.
The rate may have been mistyped (0.05% gives $1.80), or the interest copied from another month.
Every rule of this kind is listed under "Facts that disagree" in `npx chaffjs rules` and on the [rule reference](../../rules/).

## How strict these checks are

Each check on this page reports an `error` or a `warning`.
An `error` fails the run, so a CI job stops on it. A `warning` is reported and does not fail the run.
They run the same in every business genre, so for paperwork the genre changes the guide at the top and the wording rules, not these checks.
The literature genres turn them off.
Which genre to use for payslips, bills and statements is in [Payslips, bills and statements](./documents-paperwork).

## When the document is right

Sometimes two figures look as if they disagree and do not, because of something chaff cannot know.
A salary paid on the 25th for the whole month is one; it is in [Payslips, bills and statements](./documents-paperwork#when-a-finding-is-right-in-general-but-not-here).
Then silence that one spot with `stet`, and write why:

```markdown
<!-- stet: due-before-issue — salary is paid on the 25th for the whole month -->
```

Only that paragraph, list or table is silenced; the rest of the document is still checked.
When it is not one spot but how your team writes every document, change the rule for the team instead, as in [Three ways to respond to a finding](./getting-started#three-ways-to-respond-to-a-finding).

## What chaff does not read

chaff reads a figure only where it can tell what the figure is.
These places are left alone, and no finding there does not mean they agree.

| Written like this | Read? |
| --- | --- |
| A list of items, then `- Total: £540.00` as the list's last item | Yes, compared with the items above it |
| `- Total: £540.00` as the first item, before the items it adds up | No. A total is compared with what comes above it |
| A sentence with "for a total of £540.00" after the amounts | Yes |
| A sentence that ends "so the bill came to £540.00" | No. Only "a total of" and similar words mark a total in a sentence |
| `Net pay: $2,587.04` on its own line, beside the gross and the deductions | Yes |
| "so net pay is $2,587.04" inside a sentence | No. The net amount is read from labelled lines and tables only |
| A label chaff knows (`Net pay`) | Yes |
| A label it does not know (`Amount deposited`) | No |
| A table whose `Total` row has the word in its first cell | Yes |
| A `Total` row whose first cell is empty, with the word in the second | No |

Numbers in tables and in labelled lines are read most; numbers inside sentences are read less.
When a figure matters, put it in a table or on a line of its own, with a label.
Whether a figure is true, whether a tax rate is the right one, and whether a payment follows the law are not checked at all.

## The words chaff reads

Labels such as `Net pay`, `Total deductions`, `Pay date` or `Check-in` come from word lists bundled with chaff, one per language.
`chaff.yaml` cannot add words to them.
When your document's labels are not read, or a finding is wrong, `npx chaffjs feedback` drafts a report from your own document, keeping only the lines around it ([Reporting a wrong or missed finding](./commands#reporting-a-wrong-or-missed-finding)).
A report becomes a test and a fix.

Some knowledge belongs to one kind of document only, and lives in a document profile.
The Japanese property listing profile (`listing`), for one, holds the 80 m per minute used for walking times.
How a profile is chosen, and how to set it, is in [Choosing the kind of document](./configuration#choosing-the-kind-of-document).

## What to read next

- For payslips, bills, bank statements and other paperwork, read [Payslips, bills and statements](./documents-paperwork).
- For totals and dates in contracts, read [Contracts and terms of service](./documents-contract).
- Every rule, with its examples, is in the [rule reference](../../rules/).
