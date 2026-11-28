<!-- chaff-sample
rule: concrete-evidence-density
genre: business/report
file: quarterly-report.md
-->

# Section with nothing concrete (`concrete-evidence-density`)

**Where it helps:** quarterly reports, project updates, proposals. Any document that claims something went well and needs the reader to believe it.

## Original

```markdown chaff-before
# Customer support: third quarter report

## Response times

The team answered tickets much faster this quarter. Customers noticed the change straight away. Fewer of them had to chase us for an answer.

## Satisfaction

Customers were happier with the support they received. Several wrote in to thank individual agents. The tone of the feedback was warmer than before.

## Staffing

The new rota spread the work more evenly across the week. Agents worked less overtime. Morale in the team improved as a result.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report quarterly-report.md

quarterly-report.md   business/report · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    Response times

  ·  Section with nothing concrete

     Section "Response times" has no number, code or link (3 of 3 sections)
     A section with no number, no code and no link leaves the reader with nothing to take away.

     → Add one example. If you cannot, the section may belong inside another one.

     Relax this rule:  npx chaffjs relax concrete-evidence-density


─── line 7 ───────────────────────────────────────────────────

    Satisfaction

  ·  Section with nothing concrete

     Section "Satisfaction" has no number, code or link (3 of 3 sections)
     A section with no number, no code and no link leaves the reader with nothing to take away.

     → Add one example. If you cannot, the section may belong inside another one.

     Relax this rule:  npx chaffjs relax concrete-evidence-density


─── line 11 ──────────────────────────────────────────────────

    Staffing

  ·  Section with nothing concrete

     Section "Staffing" has no number, code or link (3 of 3 sections)
     A section with no number, no code and no link leaves the reader with nothing to take away.

     → Add one example. If you cannot, the section may belong inside another one.

     Relax this rule:  npx chaffjs relax concrete-evidence-density


────────────────────────────────────────────────────────────

  3 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Customer support: third quarter report

## Response times

The team answered tickets in 6 hours on average this quarter, down from 19 hours. Customers noticed the change straight away. Follow-up messages asking for an answer fell by 40%.

## Satisfaction

The satisfaction score rose from 78% to 86%. Several customers wrote in to thank individual agents. The tone of the feedback was warmer than before.

## Staffing

The new rota spread the work more evenly across the week. Overtime fell from 120 hours to 45 hours over the quarter. Morale in the team improved as a result.
```

## How it was fixed

Every section of the report says things improved: replies came faster, customers were happier, the team was under less pressure.
Not one of them says by how much.
A manager who has to decide whether the new rota is worth keeping has nothing to take away, and nothing to compare with next quarter.

The fix adds one figure to each section: the average reply time, the satisfaction score, the overtime hours.
The sentences around them stay as they were. One number is enough to turn a section from an opinion into a finding.

## Settings

The level is the number of sections with nothing concrete before the report is flagged: one at `strict`, three at the default level, six at `relaxed`.
A section shorter than three sentences is not checked, nor a section that lists conditions or plans.

If your documents are opinion pieces or plans where a number would not help, relax it:

```yaml chaff-settings
rules:
  concrete-evidence-density: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

It is off for legal, documentation, academic, literature and speech genres, for meeting minutes, and for blogs.

```text chaff-explain
$ npx chaffjs explain concrete-evidence-density --genre business/report

  Section with nothing concrete   (concrete-evidence-density)

  A section with no number, no code and no link leaves the reader with nothing to take away.

  How to fix: Add one example. If you cannot, the section may belong inside another one.

  Levels:
    strict   reported once 1 section has nothing concrete
  → normal   reported once 3 sections have nothing concrete
    relaxed  reported once 6 sections have nothing concrete
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax concrete-evidence-density --why "reason"
```

[All samples](README.md)
