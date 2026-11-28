<!-- chaff-sample
rule: cross-doc-broken-link
genre: docs/manual
file: getting-started.md
-->

# Link to another file that goes nowhere (`cross-doc-broken-link`)

**Where it helps:** manuals split into several pages, help centres, sets of policies that link to each other.

## Original

```markdown chaff-before
# Getting started

Before you invite your team, choose a plan.
The prices are listed in [Plans and prices](./billing.md#monthly-plans).
```

It links to a second page, `billing.md`, which is checked with it:

```markdown chaff-file billing.md
# Billing

## Plans and prices

The Team plan costs $8 per user each month.
The Business plan costs $15 per user each month.

## Invoices

Invoices are sent on the first day of each month.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual getting-started.md billing.md

getting-started.md   docs/manual · English   genre from --genre

─── line 4 ───────────────────────────────────────────────────

    [Plans and prices](./billing.md#monthly-plans)

  ⚠  Link to another file that goes nowhere

     The link "[Plans and prices](./billing.md#monthly-plans)" points to "./billing.md#monthly-plans", but that file has no such heading
     A manual or a bundle of documents links its pages to each other with relative paths ("[Fees](./pricing.md#monthly-fee)"). Renaming a file or rewording a heading leaves the links from other pages with nowhere to go, and no single file shows it. The files given together are checked against each other: a link whose file is not there, and a link to a heading that file does not have, are pointed out. Heading anchors are compared on letters and digits only.

     → Match the file's current name and the heading as it is now written. If the file or the heading is gone, remove the link or point it at the page that replaced it.

     Relax this rule:  npx chaffjs relax cross-doc-broken-link


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Getting started

Before you invite your team, choose a plan.
The prices are listed in [Plans and prices](./billing.md#plans-and-prices).
```

## How it was fixed

The guide links to `billing.md#monthly-plans`, but the billing page has no heading called "Monthly plans". It is now "Plans and prices".
Someone renamed the heading on the billing page, and nothing on that page shows that another page linked to it.
The reader lands on the billing page with no idea where the prices are.

The fix points the link at the heading as it is written now.
chaff only sees this when both files are checked together, as in `npx chaffjs getting-started.md billing.md`, or a whole folder.
It also reports a link to a file that is not among the files checked.

## Settings

A link that goes nowhere is a warning at the default level; `strict` makes it an error and `relaxed` a note.

If some of your links point to pages that are published elsewhere and not checked with these files, relax it:

```yaml chaff-settings
rules:
  cross-doc-broken-link: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain cross-doc-broken-link --genre docs/manual

  Link to another file that goes nowhere   (cross-doc-broken-link)

  A manual or a bundle of documents links its pages to each other with relative paths ("[Fees](./pricing.md#monthly-fee)"). Renaming a file or rewording a heading leaves the links from other pages with nowhere to go, and no single file shows it. The files given together are checked against each other: a link whose file is not there, and a link to a heading that file does not have, are pointed out. Heading anchors are compared on letters and digits only.

  How to fix: Match the file's current name and the heading as it is now written. If the file or the heading is gone, remove the link or point it at the page that replaced it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax cross-doc-broken-link --why "reason"
```

[All samples](README.md)
