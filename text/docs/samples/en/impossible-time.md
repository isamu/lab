<!-- chaff-sample
rule: impossible-time
genre: business/email
file: fire-drill.md
-->

# A time the clock does not have (`impossible-time`)

**Where it helps:** meeting invitations, notices, timetables, booking confirmations. Anywhere the 24-hour clock and AM or PM meet.

## Original

```markdown chaff-before
Subject: Fire drill on Wednesday

Hi all,

The building will hold a fire drill on Wednesday afternoon. The alarm will sound at 14:30 PM and the drill should take about twenty minutes.

When the alarm sounds, leave by the nearest stairs and meet at the car park on Station Road. Please do not use the lifts.

Thanks,
Tom
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email fire-drill.md

fire-drill.md   business/email · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    alarm will sound at 14:30 PM and the drill shoul

  ✖  A time the clock does not have

     "14:30 PM" is not a time (with AM or PM, the hour runs to 12)
     A time such as "13 PM", "午後13時" or "10:75" is not on the clock. The reader cannot tell whether 1 PM or 13:00 was meant, or which minute, and someone turns up at the wrong time. It happens when the 24-hour clock and AM/PM are mixed, or a digit is mistyped. With AM or PM the hour runs to 12, and minutes and seconds to 59, so a machine can tell.

     → Check the time that was meant and correct it. For one in the afternoon write "1 PM" or "13:00", not both at once.

     Relax this rule:  npx chaffjs relax impossible-time


────────────────────────────────────────────────────────────

  1 error   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Fire drill on Wednesday

Hi all,

The building will hold a fire drill on Wednesday afternoon. The alarm will sound at 14:30 and the drill should take about twenty minutes.

When the alarm sounds, leave by the nearest stairs and meet at the car park on Station Road. Please do not use the lifts.

Thanks,
Tom
```

## How it was fixed

"14:30 PM" mixes two clocks: with PM the hour runs only to 12.
Most readers will guess half past two, but someone who reads it as a slip for "4:30 PM" will book a client call for 14:30 and be in it when the alarm goes.
It happens when a time copied from a 24-hour calendar gets an AM or PM added out of habit.

The fix writes the time on one clock only: 14:30.
"2:30 PM" would be just as right; what matters is not writing both at once.

## Settings

The rule is an error at `normal` and a warning at `relaxed`:

```yaml chaff-settings
rules:
  impossible-time: relaxed
```

It runs in every genre.
A time past 24 without AM or PM ("25:00") is not reported, since late-night schedules count past midnight that way.
Numbers right after a capitalised word or a punctuation mark ("Genesis 24:67"), scales and ratios such as "1:75", and code are not read as times.

```text chaff-explain
$ npx chaffjs explain impossible-time --genre business/email

  A time the clock does not have   (impossible-time)

  A time such as "13 PM", "午後13時" or "10:75" is not on the clock. The reader cannot tell whether 1 PM or 13:00 was meant, or which minute, and someone turns up at the wrong time. It happens when the 24-hour clock and AM/PM are mixed, or a digit is mistyped. With AM or PM the hour runs to 12, and minutes and seconds to 59, so a machine can tell.

  How to fix: Check the time that was meant and correct it. For one in the afternoon write "1 PM" or "13:00", not both at once.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   error
    relaxed  warning
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax impossible-time --why "reason"
```

[All samples](README.md)
