<!-- chaff-sample
rule: empty-section
genre: business/proposal
file: proposal.md
-->

# Empty section (`empty-section`)

**Where it helps:** proposals, plans, reports. Any document drafted from a list of headings to be filled in.

## Original

```markdown chaff-before
# Proposal: a shared parcel room

## Background

Parcels for staff now arrive at reception, and the front desk spends about an hour a day sorting them.

## Cost

## Next steps

Facilities will price two lockers and report to the office committee on December 3, 2026.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/proposal proposal.md

proposal.md   business/proposal · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    ## Cost

  ⚠  Empty section

     Nothing under the heading "Cost"
     A heading followed straight away by a heading of the same or a higher level has nothing under it. A heading was put up to be filled in later, or its content was deleted and the heading left behind. It still shows in the table of contents, and a reader who opens it finds nothing. A heading followed by a deeper one (a section split into subsections) has content and is not reported. The last heading of the document is reported if nothing follows it. A section holding only an HTML comment counts as empty.

     → Write the section, or remove the heading.

     Relax this rule:  npx chaffjs relax empty-section


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Proposal: a shared parcel room

## Background

Parcels for staff now arrive at reception, and the front desk spends about an hour a day sorting them.

## Cost

Two smart lockers cost about $4,200 to install and $60 a month to run.

## Next steps

Facilities will price two lockers and report to the office committee on December 3, 2026.
```

## How it was fixed

The "Cost" heading has nothing under it.
The committee reading the proposal sees "Cost" in the outline, opens it, and finds the next heading.
The one thing they need before they can approve the lockers is missing.

The heading was put up to be filled in later. The fix writes the section.
If the cost is not known yet, the section can say so and say when it will be. A heading with nothing under it says nothing at all.
A heading followed by a deeper one, a section split into subsections, is not reported.

## Settings

An empty section is a warning at the default level; `strict` makes it an error and `relaxed` a note.

If you check outlines and drafts where empty headings are expected, relax it:

```yaml chaff-settings
rules:
  empty-section: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain empty-section --genre business/proposal

  Empty section   (empty-section)

  A heading followed straight away by a heading of the same or a higher level has nothing under it. A heading was put up to be filled in later, or its content was deleted and the heading left behind. It still shows in the table of contents, and a reader who opens it finds nothing. A heading followed by a deeper one (a section split into subsections) has content and is not reported. The last heading of the document is reported if nothing follows it. A section holding only an HTML comment counts as empty.

  How to fix: Write the section, or remove the heading.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax empty-section --why "reason"
```

[All samples](README.md)
