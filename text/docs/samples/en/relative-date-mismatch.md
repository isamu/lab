<!-- chaff-sample
rule: relative-date-mismatch
genre: business/press-release
file: competition.md
-->

# A relative date that does not match its base date (`relative-date-mismatch`)

**Where it helps:** competition rules, event notices, project schedules, emails. Anywhere a date is given both as "two weeks later" and as a date.

## Original

```markdown chaff-before
# Young Photographer of the Year 2026

Entries open on 1 April 2026 and close on 31 May 2026. Anyone aged 12 to 18 can enter up to three photographs.

The judges meet in June. Shortlisted entrants will hear from us by email on 30 June 2026. Two weeks later, on 21 July 2026, the winners will be announced at the town hall exhibition.

Full rules are on the competition page.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/press-release competition.md

competition.md   business/press-release · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    21 July 2026, the winners will be announced at the town hall exhibition.

  ⚠  A relative date that does not match its base date

     Two weeks later from 30 June 2026 is 14 July 2026, but the date is given as 21 July 2026
     When a relative length and a date are written together ("Applications open on May 1, 2026. Two weeks later, on May 16, 2026, …"), the reader cannot tell which is right. It happens when a schedule moves and only the date or only the length is changed. The date right after "N days later" or "N weeks earlier" is compared with the nearest earlier date in the same sentence (or in the previous sentence when the sentence opens with the relative length), plus or minus the length. A day word in an email or minutes ("next Monday (October 12)", "tomorrow (October 7)") is compared with the day it counts to from the date field at the head of the email or the minutes ("Date:"). A week may start on Monday or on Sunday, and "next Monday" may be the coming Monday; only a date that fits none of these readings is reported.

     → Check which is right, the base date, the length or the date, and make the rest agree.

     Relax this rule:  npx chaffjs relax relative-date-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Young Photographer of the Year 2026

Entries open on 1 April 2026 and close on 31 May 2026. Anyone aged 12 to 18 can enter up to three photographs.

The judges meet in June. Shortlisted entrants will hear from us by email on 30 June 2026. Three weeks later, on 21 July 2026, the winners will be announced at the town hall exhibition.

Full rules are on the competition page.
```

## How it was fixed

Two weeks after 30 June is 14 July, but the notice gives the announcement as 21 July.
The exhibition was moved back a week, and the date was changed while "two weeks later" stayed.
A family planning a trip to the town hall cannot tell whether to keep the 14th or the 21st free, and a young entrant has every reason to want to be there.

The town hall is booked for 21 July, so the fix keeps the date and corrects the length to "three weeks later".
When the date is the part that is wrong, correct the date instead; either way, the two now point at the same day.

## Settings

The rule is a warning at `normal` and a note at `relaxed`:

```yaml chaff-settings
rules:
  relative-date-mismatch: relaxed
```

The date right after "N days later" or "N weeks earlier" is compared with the nearest earlier date in the same sentence, or in the previous sentence when the sentence opens with the length.
In an email or minutes, a day word ("next Monday (October 12)", "tomorrow (October 7)") is compared with the date at the head of the message, allowing for either day as the start of the week.
Units other than days, weeks, months and years ("3 business days later") are left alone.
The rule runs in every genre.

```text chaff-explain
$ npx chaffjs explain relative-date-mismatch --genre business/press-release

  A relative date that does not match its base date   (relative-date-mismatch)

  When a relative length and a date are written together ("Applications open on May 1, 2026. Two weeks later, on May 16, 2026, …"), the reader cannot tell which is right. It happens when a schedule moves and only the date or only the length is changed. The date right after "N days later" or "N weeks earlier" is compared with the nearest earlier date in the same sentence (or in the previous sentence when the sentence opens with the relative length), plus or minus the length. A day word in an email or minutes ("next Monday (October 12)", "tomorrow (October 7)") is compared with the day it counts to from the date field at the head of the email or the minutes ("Date:"). A week may start on Monday or on Sunday, and "next Monday" may be the coming Monday; only a date that fits none of these readings is reported.

  How to fix: Check which is right, the base date, the length or the date, and make the rest agree.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax relative-date-mismatch --why "reason"
```

[All samples](README.md)
