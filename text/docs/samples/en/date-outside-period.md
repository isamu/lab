<!-- chaff-sample
rule: date-outside-period
genre: business/email
file: trip-letter.md
-->

# A date outside the stated period (`date-outside-period`)

**Where it helps:** trip letters, itineraries, conference programmes, course outlines. Any document that states a period and then lists what happens on each day.

## Original

```markdown chaff-before
# Year 8 residential trip to the Lake District

Dear parents and carers,

Here is the plan for this year's outdoor learning trip. Please read it with your child.

Trip dates: June 15–18, 2027

- June 15: coach leaves school at 8:30 am; afternoon canoeing
- June 16: ghyll scrambling and a night walk
- June 17: climbing wall and the camp-fire evening
- June 19: morning on the lake, then coach home, back at school by 5 pm

Your child will need a waterproof coat, walking boots and a refillable water bottle.

Kind regards,

The Year 8 team
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email trip-letter.md

trip-letter.md   business/email · English   genre from --genre

─── line 12 ──────────────────────────────────────────────────

    June 19: morning on the lake, then coach home, back at school by 5 pm

  ⚠  A date outside the stated period

     June 19 is outside the stated period "June 15–18, 2027"
     When an itinerary says "Trip dates: Oct 12–15" and then lists something on October 17, the reader has to ask whether the period or the schedule is right. It happens when a date is copied wrong, or when the schedule moves and the period is not updated. The period is read from one line that starts with a period word such as "Trip dates" or "Conference", and the dates after it in the same section are compared, in list items, table rows and headings, and in running text when the date has no year. A date whose item, sentence or section heading marks it as outside the period on purpose (a post-trip meeting, a booking deadline, a past edition) is not compared. Nor is a date in running text that a deadline word is attached to ("let us know by September 18"): it is a reply-by date after the period. A period without a year ("Dec 28 – Jan 4") is read as running into the new year. When the period the document's work is done in ("Term") is stated at the top or in the overview section, a date after its end in an item or sentence of any later section that says "submit", "due", "deadline" or "Assignment:" is reported (an assignment due after the term). A date without a year takes the term's year only when the term lies within one year.

     → Check the date and the period, and correct the one that is wrong. If the item is meant to fall before or after the period, say so ("pre-trip", "follow-up").

     Relax this rule:  npx chaffjs relax date-outside-period


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Year 8 residential trip to the Lake District

Dear parents and carers,

Here is the plan for this year's outdoor learning trip. Please read it with your child.

Trip dates: June 15–18, 2027

- June 15: coach leaves school at 8:30 am; afternoon canoeing
- June 16: ghyll scrambling and a night walk
- June 17: climbing wall and the camp-fire evening
- June 18: morning on the lake, then coach home, back at school by 5 pm

Your child will need a waterproof coat, walking boots and a refillable water bottle.

Kind regards,

The Year 8 team
```

## How it was fixed

The trip runs from June 15 to June 18, but the last day of the plan is dated June 19.
Four days, four items: the dates simply ran one day too far when the plan was typed.
Parents read this letter to book time off and to know when to be at the school gate, and half of them will plan around the wrong day.

The fix dates the last day June 18, the end of the stated period.
If the trip had really been extended by a day, the period at the top is the line to correct, along with the cost and the kit list.

## Settings

A date outside the period is a warning at the default level; `strict` makes it an error and `relaxed` a note:

```yaml chaff-settings
rules:
  date-outside-period: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

The period is read from one line that starts with a period word such as "Trip dates" or "Conference", and the dates after it in the same section are compared.
A date marked as outside on purpose ("post-trip meeting", "book by", "deadline") is not compared, and nor is a reply-by date ("let us know by May 20").
A period without a year ("Dec 28 – Jan 4") is read as running into the new year.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain date-outside-period --genre business/email

  A date outside the stated period   (date-outside-period)

  When an itinerary says "Trip dates: Oct 12–15" and then lists something on October 17, the reader has to ask whether the period or the schedule is right. It happens when a date is copied wrong, or when the schedule moves and the period is not updated. The period is read from one line that starts with a period word such as "Trip dates" or "Conference", and the dates after it in the same section are compared, in list items, table rows and headings, and in running text when the date has no year. A date whose item, sentence or section heading marks it as outside the period on purpose (a post-trip meeting, a booking deadline, a past edition) is not compared. Nor is a date in running text that a deadline word is attached to ("let us know by September 18"): it is a reply-by date after the period. A period without a year ("Dec 28 – Jan 4") is read as running into the new year. When the period the document's work is done in ("Term") is stated at the top or in the overview section, a date after its end in an item or sentence of any later section that says "submit", "due", "deadline" or "Assignment:" is reported (an assignment due after the term). A date without a year takes the term's year only when the term lies within one year.

  How to fix: Check the date and the period, and correct the one that is wrong. If the item is meant to fall before or after the period, say so ("pre-trip", "follow-up").

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax date-outside-period --why "reason"
```

[All samples](README.md)
