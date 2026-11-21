<!-- chaff-sample
rule: acronym-expansion-conflict
genre: business/proposal
file: proposal.md
-->

# Abbreviation expanded two ways (`acronym-expansion-conflict`)

**Where it helps:** proposals, reports, specifications. Any document assembled from paragraphs written for other documents.

## Original

```markdown chaff-before
# Proposal: one system for customer records

Today the sales team keeps customer details in spreadsheets, and the support team keeps its own list in the ticket tool.
When a customer moves office, the two lists disagree within a week.

We propose a single CRM (customer relationship management) system for both teams.
Sales would see every open ticket before a call, and support would see what the customer has bought.

The first year would cost about the same as the two tools we pay for now.
We would move the support list first, in July, and the sales spreadsheets in September.
After the move, the CRM (client records manager) would be the only place where a customer's address is changed.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/proposal proposal.md

proposal.md   business/proposal · English   genre from --genre

─── line 11 ──────────────────────────────────────────────────

    CRM (client records manager) would be the only place where a customer's address

  ⚠  Abbreviation expanded two ways

     "CRM" is expanded as "client records manager" here and as "customer relationship management" on line 6
     An abbreviation spelled out as two different names leaves the reader unsure whether they are the same thing. One of them is usually a slip, or a sentence pasted from another document.

     → Check which name is right and use it in both places. If they are different things, give them different abbreviations.

     Relax this rule:  npx chaffjs relax acronym-expansion-conflict


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Proposal: one system for customer records

Today the sales team keeps customer details in spreadsheets, and the support team keeps its own list in the ticket tool.
When a customer moves office, the two lists disagree within a week.

We propose a single CRM (customer relationship management) system for both teams.
Sales would see every open ticket before a call, and support would see what the customer has bought.

The first year would cost about the same as the two tools we pay for now.
We would move the support list first, in July, and the sales spreadsheets in September.
After the move, the CRM would be the only place where a customer's address is changed.
```

## How it was fixed

"CRM" is spelled out twice, as two different things.
The second expansion came with a paragraph copied from an older note, where it named a tool the company once used.
A reader who meets "client records manager" asks whether the proposal is about one system or two, and the board may approve something nobody meant.

The fix keeps the first expansion and drops the second, since the reader already knows what "CRM" means here.
If the two really were different things, each would need its own abbreviation.

## Settings

The rule is a warning at `normal`, an error at `strict` and a note at `relaxed`.
An English name counts as an expansion only when its initials spell the abbreviation, and differences of case, hyphens and a plural "s" are ignored.

To make it a note:

```yaml chaff-settings
rules:
  acronym-expansion-conflict: relaxed
```

```text chaff-explain
$ npx chaffjs explain acronym-expansion-conflict --genre business/proposal

  Abbreviation expanded two ways   (acronym-expansion-conflict)

  An abbreviation spelled out as two different names leaves the reader unsure whether they are the same thing. One of them is usually a slip, or a sentence pasted from another document.

  How to fix: Check which name is right and use it in both places. If they are different things, give them different abbreviations.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax acronym-expansion-conflict --why "reason"
```

[All samples](README.md)
