<!-- chaff-sample
rule: annual-holidays-mismatch
genre: business/press-release
file: support-specialist.md
-->

# Annual days off fewer than the weekly days off give (`annual-holidays-mismatch`)

**Where it helps:** job postings, offer letters, employee handbooks. Any page that states both the weekly days off and the yearly count.

## Original

```markdown chaff-before
# Customer support specialist, Leeds office

We are hiring a customer support specialist to join our team of eight in Leeds.
You will answer customers by phone and chat, and keep our help pages up to date.

| Item | Details |
| --- | --- |
| Contract | Permanent, full time |
| Hours | 9:00 to 17:30, Monday to Friday |
| Days off | Two days off every week (Saturday and Sunday) and public holidays |
| Annual days off | 98 days |
| Annual leave | 25 days, plus your birthday |

To apply, send your CV and a short note about yourself to jobs@example.com by 30 November.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/press-release support-specialist.md

support-specialist.md   business/press-release · English   genre from --genre

─── line 11 ──────────────────────────────────────────────────

    | Annual days off | 98 days | | Annual le

  ⚠  Annual days off fewer than the weekly days off give

     The annual days off (98 days) are fewer than the 104 days a year that "Two days off every week" gives
     "Two days off every week" in a job posting means at least 104 days off in a year of 52 weeks, so "Annual days off: 90 days" beside it cannot both be right. It happens when a line is copied from another posting, or when the weekly days off are rewritten and the annual count is not. The annual count of days off is compared with the fewest the weekly phrase gives (two days off every week or a five-day work week is 104, three days off every week or a four-day work week is 156) and pointed out only when it is fewer. More is normal (public holidays, summer, the new year) and is not looked at. Only phrases that say every week count; vague ones ("weekends off", "two days off a week") are not compared. The phrases and their minimums are in the weekly-days-off lexicon.

     → Check which of the annual days off and the weekly days off is right, and correct the other. If some weeks have fewer days off, say so instead of "every week".

     Relax this rule:  npx chaffjs relax annual-holidays-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Customer support specialist, Leeds office

We are hiring a customer support specialist to join our team of eight in Leeds.
You will answer customers by phone and chat, and keep our help pages up to date.

| Item | Details |
| --- | --- |
| Contract | Permanent, full time |
| Hours | 9:00 to 17:30, Monday to Friday |
| Days off | Two days off every week (Saturday and Sunday) and public holidays |
| Annual days off | 112 days |
| Annual leave | 25 days, plus your birthday |

To apply, send your CV and a short note about yourself to jobs@example.com by 30 November.
```

## How it was fixed

Two days off every week is at least 104 days in a year of 52 weeks, before a single public holiday is counted.
The posting promised that and, a line below, 98 days off a year: the count had been copied from an older posting for a role that worked some Saturdays.
A candidate comparing offers reads the yearly figure first, and 98 days makes this job look worse than it is.

The fix counts again: 104 weekend days and the 8 public holidays in England make 112.
If the job really does have fewer days off, the weekly line is the one to change, so that it no longer says "every week".

## Settings

The rule is a warning at `normal`, an error at `strict` and a note at `relaxed`:

```yaml chaff-settings
rules:
  annual-holidays-mismatch: relaxed
```

Only phrases that say every week are compared ("two days off every week", "a five-day work week"); "weekends off" is too vague to count.
A count with "about" or "or more", a range, and a phrase followed by an exception ("except some Saturdays") are left alone.
More days off than the minimum is never reported, and "annual leave" is read as paid leave, not as the yearly count of days off.

```text chaff-explain
$ npx chaffjs explain annual-holidays-mismatch --genre business/press-release

  Annual days off fewer than the weekly days off give   (annual-holidays-mismatch)

  "Two days off every week" in a job posting means at least 104 days off in a year of 52 weeks, so "Annual days off: 90 days" beside it cannot both be right. It happens when a line is copied from another posting, or when the weekly days off are rewritten and the annual count is not. The annual count of days off is compared with the fewest the weekly phrase gives (two days off every week or a five-day work week is 104, three days off every week or a four-day work week is 156) and pointed out only when it is fewer. More is normal (public holidays, summer, the new year) and is not looked at. Only phrases that say every week count; vague ones ("weekends off", "two days off a week") are not compared. The phrases and their minimums are in the weekly-days-off lexicon.

  How to fix: Check which of the annual days off and the weekly days off is right, and correct the other. If some weeks have fewer days off, say so instead of "every week".

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax annual-holidays-mismatch --why "reason"
```

[All samples](README.md)
