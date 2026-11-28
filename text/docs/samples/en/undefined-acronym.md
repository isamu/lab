<!-- chaff-sample
rule: undefined-acronym
genre: business/report
file: update.md
-->

# Undefined acronym (`undefined-acronym`)

**Where it helps:** monthly reports, project updates, proposals, onboarding notes. Any document read by someone outside the team that wrote it.

## Original

```markdown chaff-before
# Support team update, October

We moved all incoming tickets to the new shared queue on 3 October.
Since then, the average first reply has come within four hours, down from nine.

Our CSAT rose for the second month in a row, and we closed the month with no breach of the SLA.
Next month we will review the ten slowest tickets with the product team.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report update.md

update.md   business/report · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    Our CSAT rose for the second month in a row, and we closed the month with no breach of the SLA.

  ·  Acronym never expanded

     "CSAT" is used without an expansion (2 such acronyms)
     An acronym means different things to different readers. What is obvious inside one team is not obvious outside it.

     → Expand it in brackets at first use. If your readers know it as a name (a company, say), list it under names in chaff.yaml and it is not asked for.

     Relax this rule:  npx chaffjs relax undefined-acronym


─── line 6 ───────────────────────────────────────────────────

    Our CSAT rose for the second month in a row, and we closed the month with no breach of the SLA.

  ·  Acronym never expanded

     "SLA" is used without an expansion (2 such acronyms)
     An acronym means different things to different readers. What is obvious inside one team is not obvious outside it.

     → Expand it in brackets at first use. If your readers know it as a name (a company, say), list it under names in chaff.yaml and it is not asked for.

     Relax this rule:  npx chaffjs relax undefined-acronym


────────────────────────────────────────────────────────────

  2 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Support team update, October

We moved all incoming tickets to the new shared queue on 3 October.
Since then, the average first reply has come within four hours, down from nine.

Our customer satisfaction score (CSAT) rose for the second month in a row, and we closed the month with no breach of our service level agreement (SLA), the response times we promise our customers.
Next month we will review the ten slowest tickets with the product team.
```

## How it was fixed

The support team says "CSAT" and "SLA" every day, so the update uses them without a second thought.
The people who read it, a finance lead or a new manager, may not know them, and the two sentences that carry the good news are the ones they cannot read.

The fix spells each one out the first time it appears, with the short form in brackets after it.
After that, the short form is enough: chaff counts an acronym as defined from the point where it is spelled out.
Everyday acronyms such as "PDF" or "USB" are not reported.

## Settings

At the default level, a report is flagged once it leaves two different acronyms unexplained, so a single stray one passes.
`strict` flags the first one; `relaxed` waits for five. The numbers differ by genre (see the `explain` output below).

A name written in capitals, such as your company or a product, is not an acronym to spell out.
List it under `names` and chaff reads it as one name:

```yaml chaff-settings
names:
  - ACME
```

If every reader of your documents knows the short forms, relax the rule; to stop checking, turn it `off`:

```yaml chaff-settings
rules:
  undefined-acronym: relaxed
```

```text chaff-explain
$ npx chaffjs explain undefined-acronym --genre business/report

  Acronym never expanded   (undefined-acronym)

  An acronym means different things to different readers. What is obvious inside one team is not obvious outside it.

  How to fix: Expand it in brackets at first use. If your readers know it as a name (a company, say), list it under names in chaff.yaml and it is not asked for.

  Levels:
    strict   reported once 1 different acronym goes unexplained, or from the first one when the document itself spells out 1 other
  → normal   reported once 2 different acronyms go unexplained, or from the first one when the document itself spells out 2 others
    relaxed  reported once 5 different acronyms go unexplained, or from the first one when the document itself spells out 5 others
    off      not checked

  These numbers are for business, which business/report takes. technical / speech / docs/faq / docs/manual have numbers of their own.

  Now: normal.

  Change it:  npx chaffjs relax undefined-acronym --why "reason"
```

[All samples](README.md)
