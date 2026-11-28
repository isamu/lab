<!-- chaff-sample
rule: deadline-after-event
genre: business/press-release
file: open-day.md
-->

# A registration deadline after the event (`deadline-after-event`)

**Where it helps:** invitations, event notices, course announcements, trip notices. Anywhere a sign-up date comes with the event's own date.

## Original

```markdown chaff-before
# Community garden open day

Come and see what the Hillside Allotments have grown this year. There will be a plant swap, a soup tent and a short talk on composting.

- Date: Saturday 13 June 2026, 11:00 to 15:00
- Place: Hillside Allotments, gate on Mill Lane

The open day is free, but places on the composting talk are limited. Please register by 20 June 2026 using the form on our website.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/press-release open-day.md

open-day.md   business/press-release · English   genre from --genre

─── line 8 ───────────────────────────────────────────────────

    20 June 2026 using the form on our website.

  ✖  A registration deadline after the event

     The registration deadline 20 June 2026 is after the event on 13 June 2026
     When the registration deadline or the RSVP date of an invitation is after the event itself, a reader who signs up in time arrives after it is over. It happens when last year's invitation is reused and only one of the dates is changed. The date on a line starting with an event-date word (Date, When) and holding a time of day is read as the event's date, and a date in a sentence with a registration word and a deadline word (register by, Booking deadline) after it is pointed out. In a trip notice, the first day on a Departure or Dates line is read as the departure even without a time, and a payment deadline after it (Payment due, a Due by column) is pointed out too.

     → Check which is right, the event date or the deadline, and correct the other.

     Relax this rule:  npx chaffjs relax deadline-after-event


────────────────────────────────────────────────────────────

  1 error   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Community garden open day

Come and see what the Hillside Allotments have grown this year. There will be a plant swap, a soup tent and a short talk on composting.

- Date: Saturday 13 June 2026, 11:00 to 15:00
- Place: Hillside Allotments, gate on Mill Lane

The open day is free, but places on the composting talk are limited. Please register by 6 June 2026 using the form on our website.
```

## How it was fixed

The open day is on 13 June, but the notice asks people to register by 20 June, a week after the gates have closed.
Last year's open day was later in the month, and only the event date was changed when the notice was reused.
A reader who believes the deadline may leave it until the week after and find the talk already over; one who notices has to email to ask which date is right.

The fix sets the deadline a week before the event, 6 June, so the organisers know the numbers in time.
If the event date were the wrong one, it would be the one to correct.

## Settings

The rule is an error at `normal` and a warning at `relaxed`:

```yaml chaff-settings
rules:
  deadline-after-event: relaxed
```

The date on a line starting with an event-date word (Date, When) and holding a time of day is read as the event's date.
A date in a sentence with a registration word (register, RSVP, booking) and a deadline word (by, deadline, closes) is compared with it.
A Date line without a time of day, a date without its year, and a sentence with two dates are not compared, and neither is a deadline for a survey or for the slides.
It runs on business, technical and blog writing; it does not run on legal texts, documentation, academic writing, literature or speech, where a date is reported on rather than set.

```text chaff-explain
$ npx chaffjs explain deadline-after-event --genre business/press-release

  A registration deadline after the event   (deadline-after-event)

  When the registration deadline or the RSVP date of an invitation is after the event itself, a reader who signs up in time arrives after it is over. It happens when last year's invitation is reused and only one of the dates is changed. The date on a line starting with an event-date word (Date, When) and holding a time of day is read as the event's date, and a date in a sentence with a registration word and a deadline word (register by, Booking deadline) after it is pointed out. In a trip notice, the first day on a Departure or Dates line is read as the departure even without a time, and a payment deadline after it (Payment due, a Due by column) is pointed out too.

  How to fix: Check which is right, the event date or the deadline, and correct the other.

  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   error
    relaxed  warning
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax deadline-after-event --why "reason"
```

[All samples](README.md)
