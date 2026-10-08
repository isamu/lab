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
| `total-mismatch` | A total that is not the sum of its items, in a table or in a sentence |
| `dangling-reference` | A reference to an article the document does not have |
| `numbering-gap` | A skipped or repeated article number |
| `date-weekday-mismatch` | A date whose weekday disagrees with the calendar. A date without its year is read in the year that puts it within five months of the dated date before it |
| `duplicate-definition` | The same term defined twice |
| `dangling-figure-reference` | A figure, table or schedule the text refers to that the document does not have |

What it does not do is decided too.

- It does not judge whether the terms are fair, or lawful. People read and decide that.
- It does not say whether a clause favours one party.
- It does not decide which of two definitions is right. It shows where the second one is.
- It does not flag passives, or sentences that open the same way. In a contract, those are the usual way of writing.

How article numbers and references are read is the same as in [Internal rules and regulations](./documents-statute).
This page looks at dates and amounts first, then at [names, terms and deadlines](#names-terms-and-deadlines).

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
  21:12   error   The total $800 is not the sum of its items ($700)
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
  21:12   error   The total $800 is not the sum of its items ($700)
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

## The guide that comes first

With the genre set, chaff opens the report with the genre's guide: what a good contract does, as questions to check the draft against.
Under them is a line naming the rules that matter most for this genre.
Most of the questions are ones no rule can answer, so read them before the findings.
An AI that rewrites the text works to the same lines ([Using the guide with an AI](./ai-sounding#give-the-ai-the-genres-guide)).

```
$ npx chaffjs contract.md --genre legal/contract

Guide: Contract and terms (legal/contract)

  Before the findings below, check the draft against these.

  - Are the parties named the same way (as defined) from start to end?
  - Is each defined term defined once and used in exactly its defined form?
  - Can each obligation be read as who does what by when?
  - Do amounts, dates, periods and clause references agree across the clauses and the schedules?
  - Are termination, liability, governing law and dispute resolution covered?

  Rules that matter most for this genre: dangling-figure-reference, dangling-reference, date-range-reversed, date-weekday-mismatch, defined-name-repeated, defined-term-form, duplicate-definition, numbering-gap, obligation-without-deadline, party-role-name, requirement-smell, total-mismatch, vague-deadline
  Change it with guide: in chaff.yaml; leave it out with --no-guide.

════════════════════════════════════════════════════════════

contract.md   legal/contract · English   genre from --genre
…
```

A genre that was guessed from the path or the content, or left at the default, prints no guide.
A guide for the wrong kind of document would mislead.
`--compact` and `--no-guide` leave it out.
A team changes the lines with `guide:` in `chaff.yaml` ([Changing the genre's guide](./configuration#changing-the-genres-guide)).

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

## Names, terms and deadlines

A contract names its parties and its terms once, then uses those names.
A clause pasted from another template brings that template's names with it, and its deadlines may be written another way.
These rules check the names and the deadlines.

| Rule | What it finds |
| --- | --- |
| `party-role-name` | A party called by a role the contract never gave it ("the Vendor", where the parties are the Supplier and the Customer) |
| `defined-name-repeated` | A party's full name used again after its short name was defined |
| `defined-term-form` | A defined term written in another form: quoted again, or a capitalised term in lower case |
| `undefined-term` | In Japanese, a term in the defined form (本成果物) that the contract never defines |
| `vague-deadline` | "Promptly" or "without undue delay", in a contract that writes its other limits in days |
| `obligation-without-deadline` | A duty to pay, deliver, return or notify with no time at all, in a contract that gives its other duties one |
| `duration-mismatch` | A start date and a length of time that do not reach the end date written beside them |
| `reference-title-mismatch` | A clause referred to by a name its heading does not have |

This licence was saved as `licence.md`. The companies are made up.

```markdown file=licence.md
# Software Licence Agreement

This Agreement is made between Harbour Works Ltd (the "Supplier") and Kite Analytics Inc. (the "Customer").

## Article 1 (Licence)

The Supplier grants the Customer a licence to use its analytics software.

## Article 2 (Fees)

The Customer shall pay the fees within 30 days of each invoice. The Vendor shall send each invoice by email.

## Article 3 (Support)

Harbour Works Ltd shall answer each support request within 2 business days.
A reported defect shall be fixed promptly.

## Article 4 (Term)

This Agreement runs for 12 months, from April 1, 2027 to March 31, 2029.

## Article 5 (Termination)

Either party may end this Agreement on 60 days' written notice, as set out in Article 2 (Notices).
```

```
$ npx chaffjs licence.md --genre legal/contract --compact

licence.md   legal/contract · English   genre from --genre

  11:69   info    "Vendor" is not a name this contract gave a party (Supplier, Customer)
                  party-role-name
  15:1    info    "Harbour Works Ltd" was given the short name "Supplier" on line 3
                  defined-name-repeated
  16:34   info    "promptly" sets no deadline; a number of days makes it one that can be met or missed
                  vague-deadline
  20:58   warning April 1, 2027 plus 12 months ends around 2028-03-31, but the end is given as March 31, 2029
                  duration-mismatch
  24:90   info    Article 2 is called "Notices" here, but its heading is "(Fees)"
                  reference-title-mismatch

{counts}
```

| Line | Finding | How to fix it |
| --- | --- | --- |
| 11 | `party-role-name` | Write "the Supplier". If someone else sends the invoices, define them first |
| 15 | `defined-name-repeated` | Write "The Supplier" |
| 16 | `vague-deadline` | Write the limit in days, from a stated start: "within 10 business days of the report" |
| 20 | `duration-mismatch` | Decide which is right, the length or the end date, and fix the other |
| 24 | `reference-title-mismatch` | Point to the article on notices. If there is none, add it |

Most of these are `info`: how to name the parties is the drafter's choice, and chaff only points at a name that differs from the rest.
`duration-mismatch` is a `warning`, since the length and the two dates cannot all be right.

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
