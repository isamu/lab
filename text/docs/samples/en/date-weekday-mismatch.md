<!-- chaff-sample
rule: date-weekday-mismatch
genre: business/email
file: sessions.md
-->

# A date and a weekday that disagree (`date-weekday-mismatch`)

**Where it helps:** meeting invitations, event notices, schedules, itineraries. Anywhere a date is written with its day of the week.

## Original

```markdown chaff-before
Subject: Planning sessions for the spring catalogue

Hi all,

Here are the dates for the three planning sessions for the spring catalogue. Each one runs from 10:00 to 11:30 in the second-floor meeting room.

- Tuesday, 3 March 2026: product line-up and page plan
- Tuesday, 10 March 2026: photography brief
- Tuesday, 18 March 2026: copy review and sign-off

If you cannot make one of them, please tell me by Friday, 27 February. I will send you the notes afterwards.

Thanks,
Hannah
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email sessions.md

sessions.md   business/email · English   genre from --genre

─── line 9 ───────────────────────────────────────────────────

    18 March 2026: copy review and sign-off

  ✖  Date and weekday disagree

     18 March 2026 is a Wednesday, not a Tuesday
     When a date and its weekday disagree ("Friday, 1 October 2026"), the reader has to find out which one is right. It happens when a schedule is copied, or reused for another year. A date written without its year ("Friday, October 9" in an email) is checked as the date in the year that puts it within five months of the dated date just before it (or, with none before, the first one in the document).

     → Check which is right, the date or the weekday, and correct the other.

     Relax this rule:  npx chaffjs relax date-weekday-mismatch


────────────────────────────────────────────────────────────

  1 error   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Planning sessions for the spring catalogue

Hi all,

Here are the dates for the three planning sessions for the spring catalogue. Each one runs from 10:00 to 11:30 in the second-floor meeting room.

- Tuesday, 3 March 2026: product line-up and page plan
- Tuesday, 10 March 2026: photography brief
- Tuesday, 17 March 2026: copy review and sign-off

If you cannot make one of them, please tell me by Friday, 27 February. I will send you the notes afterwards.

Thanks,
Hannah
```

## How it was fixed

The sessions are weekly, every Tuesday, and the third date was typed one day off: 18 March 2026 is a Wednesday.
Half the team will put the session in their calendar on Tuesday and half on Wednesday, and someone will sit in an empty meeting room.
A reader cannot tell from the email which of the two was meant, so they have to write back and ask.

Here the weekday is the part that fits: the sessions are a weekly series, so the date is corrected to Tuesday, 17 March.
When the date is the fixed part instead (a booked venue, a public holiday), correct the weekday.
The calendar decides whether a date and a weekday agree, so a machine can check every one of them.

## Settings

The rule is an error at `normal` and a warning at `relaxed`:

```yaml chaff-settings
rules:
  date-weekday-mismatch: relaxed
```

A date without its year ("Friday, 27 February") is checked against the year of the dated date just before it, as long as it falls within five months of it.
When the document gives no year at all, or the date could be in either year, it is not checked.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain date-weekday-mismatch --genre business/email

  Date and weekday disagree   (date-weekday-mismatch)

  When a date and its weekday disagree ("Friday, 1 October 2026"), the reader has to find out which one is right. It happens when a schedule is copied, or reused for another year. A date written without its year ("Friday, October 9" in an email) is checked as the date in the year that puts it within five months of the dated date just before it (or, with none before, the first one in the document).

  How to fix: Check which is right, the date or the weekday, and correct the other.

  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   error
    relaxed  warning
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax date-weekday-mismatch --why "reason"
```

[All samples](README.md)
