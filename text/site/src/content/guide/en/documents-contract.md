# Contracts and terms of service

Contracts and terms of service number their articles and write their promises in dates and amounts.
chaff checks by machine that the numbers, references, definitions, dates and amounts fit together.
The genre is `legal/contract`. Privacy policies are checked under the same genre.

## What usually goes wrong

A contract is usually made from a template, with articles added and deleted. Each time, the figures can drift.

| What goes wrong | Example |
| --- | --- |
| A period that runs backwards | Only the year of last year's template was changed, and the end date now comes before the start |
| A total that does not add up | One amount was changed, but not the total |
| A reference to a missing article | "set out in Article 9", but there is no Article 9 |
| A skipped number | Article 4 was deleted and the articles were not renumbered |
| A weekday that is wrong | "Monday, December 5, 2026" falls on a Saturday |
| A term defined twice | "Services" is defined in Article 1 and again in Article 6 |

Found after signing, each of these becomes an argument over which figure is right.

## What chaff checks, and what it does not

For this genre, these rules run with nothing added.

| Rule | What it finds |
| --- | --- |
| `date-range-reversed` | A period whose end comes before its start |
| `total-mismatch` | A total that is not the sum of the amounts above it |
| `dangling-reference` | A reference to an article the document does not have |
| `numbering-gap` | A skipped or repeated article number |
| `date-weekday-mismatch` | A date whose weekday disagrees with the calendar |
| `duplicate-definition` | The same term defined twice |
| `dangling-figure-reference` | A figure, table or schedule the text refers to that the document does not have |

What it does not do is decided too.

- It does not judge whether the terms are fair, or lawful. People read and decide that.
- It does not say whether a clause favours one party.
- It does not decide which of two definitions is right. It shows where the second one is.
- It does not check the weekday of a date written without a year, since the year is unknown.
- It does not flag passives, or sentences that open the same way. In a contract, those are the usual way of writing.

How article numbers and references are read is the same as in [Internal rules and regulations](./documents-statute).
This page looks mainly at dates and amounts.

## Try it

If you have not set up yet, do [Getting ready](./documents#getting-ready) first.
The contract below was saved as `contract.md`. The companies are made up.

```markdown file=contract.md
# Website Maintenance Agreement

This Agreement is made between Minato Trading Ltd. (the "Client") and Sasaki Studio LLC (the "Contractor").

## Article 1 (Purpose)

The Client engages the Contractor to maintain the Client's website (the "Services"), and the Contractor accepts.

## Article 2 (Term)

This Agreement runs from November 1, 2026 through October 31, 2026.

## Article 3 (Fees)

The monthly fees for the Services are as follows.

| Item | Amount |
| --- | --- |
| Monthly updates | $500 |
| Server monitoring | $200 |
| Total | $800 |

The Client shall pay each month's fees by the end of the following month. The method of payment is set out in Article 9.

## Article 5 (Reports)

The Contractor shall report the work done each month by the 5th of the following month. The first report is due on Monday, December 5, 2026.

## Article 6 (Definitions)

In this Agreement, "Services" means updating, monitoring and repairing the Client's website.

## Article 7 (Good faith)

The parties shall settle in good faith any matter this Agreement does not cover.
```

Run without a genre, chaff reads it as a tech article, and suggests a genre.

```
$ npx chaffjs contract.md --compact

contract.md   blog/tech · English   genre from the default
   Looks like: Contract and terms. Try --genre legal/contract

  1:32    info    Section length varies by only 28% (want at least 35%)
                  section-length-uniformity
  3:1     info    Paragraph length varies by only 28% (want at least 30%)
                  paragraph-length-variance
  11:26   warning The period "November 1, 2026 through October 31, 2026" ends before it starts
                  date-range-reversed
  21:12   error   The total $800 is not the sum of the amounts above it ($700)
                  total-mismatch
  23:111  error   "Article 9" (address 9) is not in this document
                  dangling-reference
  25:1    error   "Article 5" follows "Article 3" (expected number 4)
                  numbering-gap
  27:124  error   2026-12-05 is a Saturday, not a Monday
                  date-weekday-mismatch
  31:20   warning "Services" is also defined on line 7
                  duplicate-definition
  33:26   info    This heading's capitalisation differs from the rest (1 in this document)
                  title-case-consistency

{counts}
```

Add `--genre legal/contract`, as suggested, and run it again.
`--compact` prints each finding on two lines.

```
$ npx chaffjs contract.md --genre legal/contract --compact

contract.md   legal/contract · English   genre from --genre

  11:26   warning The period "November 1, 2026 through October 31, 2026" ends before it starts
                  date-range-reversed
  21:12   error   The total $800 is not the sum of the amounts above it ($700)
                  total-mismatch
  23:111  error   "Article 9" (address 9) is not in this document
                  dangling-reference
  25:1    error   "Article 5" follows "Article 3" (expected number 4)
                  numbering-gap
  27:124  error   2026-12-05 is a Saturday, not a Monday
                  date-weekday-mismatch
  31:20   warning "Services" is also defined on line 7
                  duplicate-definition
  33:26   info    This heading's capitalisation differs from the rest (1 in this document)
                  title-case-consistency

{counts}
```

`error` means the figures disagree, so one of them is certainly wrong.
`warning` is worth fixing.

## What each finding means

| Line | Finding | What it means | How to fix it |
| --- | --- | --- | --- |
| 11 | `date-range-reversed` | The end date comes before the start date | Fix the end year: "through October 31, 2027" |
| 21 | `total-mismatch` | $500 and $200 make $700 | Fix the total, or add the missing item |
| 23 | `dangling-reference` | There is no Article 9 | Add the article on how to pay, or point to the right one |
| 25 | `numbering-gap` | Article 5 follows Article 3 | Renumber, and fix every reference to the renumbered articles |
| 27 | `date-weekday-mismatch` | December 5, 2026 is a Saturday | Fix the weekday, or move the date to a Monday |
| 31 | `duplicate-definition` | "Services" is defined in Article 1 and in Article 6 | Keep one definition. If they differ, the parties decide which is right |
| 33 | `title-case-consistency` | The heading "Article 7 (Good faith)" is in sentence case, and the rest are in Title Case | Write the heading the way the rest are |

Renumbering turns Article 5 into Article 4, and moves the reference to Article 9 too.
After fixing, run chaff again to check that the references still match.

## No checks that read meaning

For this genre, `npx chaffjs test` sends nothing to an AI.
`npx chaffjs test contract.md --genre legal/contract --dry-run` says 0 passages would be sent.
Reading what the contract means is for people.

## A starter chaff.yaml

Put this `chaff.yaml` in the folder that holds your contracts.

```yaml
genre: legal/contract
language: en
```

With the genre written down, you no longer type `--genre`. `npx chaffjs contract.md --compact` alone shows all the findings above.

## What to read next

- How to silence one spot, and how to relax a rule, are in [Internal rules and regulations](./documents-statute).
- Every rule is explained in the [reference](./reference).
- For another kind of document, go back to [What chaff does for each kind of document](./documents).
