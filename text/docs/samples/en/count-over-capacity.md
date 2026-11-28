<!-- chaff-sample
rule: count-over-capacity
genre: business/email
file: talk-invitation.md
-->

# More registered than the stated capacity (`count-over-capacity`)

**Where it helps:** event invitations, reminders, course announcements, booking confirmations. Any notice that states a capacity and how many have signed up.

## Original

```markdown chaff-before
Subject: Autumn talk: "Bees in the city", Thursday November 26

Dear members,

Our autumn talk is nearly here. A beekeeper from the university will talk about the bees that live on city rooftops. There will be time for questions afterwards.

- Date: Thursday, November 26, 2026, 7 pm
- Place: the upstairs room at the Corn Exchange
- Capacity: 60 seats

As of November 18, 72 members have registered. Tea and biscuits will be served from 6:30 pm.

Best wishes,

The events committee
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email talk-invitation.md

talk-invitation.md   business/email · English   genre from --genre

─── line 9 ───────────────────────────────────────────────────

    60 seats

  ⚠  More registered than the stated capacity

     The capacity (60 seats) is smaller than the number stated later (72 members)
     When an invitation says "Capacity: 90 seats" and later "95 members have registered", one of the two numbers is wrong, and readers have to ask whether they can still register or will get in on the day. Only numbers of people that carry a word of capacity ("capacity", "limited to") or of registration ("have registered", "invited") are compared, and only when the document states one capacity.

     → Check the capacity and the number, and correct the wrong one. If places past the capacity go to a waiting list or a ballot, say so.

     Relax this rule:  npx chaffjs relax count-over-capacity


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Autumn talk: "Bees in the city", Thursday November 26

Dear members,

Our autumn talk is nearly here. A beekeeper from the university will talk about the bees that live on city rooftops. There will be time for questions afterwards.

- Date: Thursday, November 26, 2026, 7 pm
- Place: the upstairs room at the Corn Exchange
- Capacity: 80 seats

As of November 18, 72 members have registered. Tea and biscuits will be served from 6:30 pm.

Best wishes,

The events committee
```

## How it was fixed

The room seats 60, and 72 members have registered.
One of the two is wrong, and the email does not say which: a member who has not registered yet cannot tell whether to bother, and one who has cannot tell whether there will be a seat on the night.
Here the talk had moved to the larger upstairs room, and the capacity was left from the first announcement.

The fix writes the capacity of the room the talk is in, 80 seats.
If the room really is full, say what happens next instead: a waiting list, or a second talk.

## Settings

A count over the capacity is a warning at the default level; `strict` makes it an error and `relaxed` a note:

```yaml chaff-settings
rules:
  count-over-capacity: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

Only numbers of people with a word of capacity ("capacity", "limited to") or of registration ("have registered", "invited") are compared, and only when the document states one capacity.
A document that mentions a waiting list or a ballot, a capacity per session, and last year's numbers are not compared.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain count-over-capacity --genre business/email

  More registered than the stated capacity   (count-over-capacity)

  When an invitation says "Capacity: 90 seats" and later "95 members have registered", one of the two numbers is wrong, and readers have to ask whether they can still register or will get in on the day. Only numbers of people that carry a word of capacity ("capacity", "limited to") or of registration ("have registered", "invited") are compared, and only when the document states one capacity.

  How to fix: Check the capacity and the number, and correct the wrong one. If places past the capacity go to a waiting list or a ballot, say so.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax count-over-capacity --why "reason"
```

[All samples](README.md)
