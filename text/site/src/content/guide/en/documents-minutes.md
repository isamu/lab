# Meeting minutes

Minutes record what a meeting decided, and who will do what by when.
chaff finds by machine a wrong weekday, a skipped item number and a count that does not match its list.
It also finds decisions with nobody behind them.
The genre is `business/meeting-notes`. Meeting notes are checked under the same genre.

## What usually goes wrong

Minutes are written in a hurry, during or right after the meeting, often by copying last week's.

| What goes wrong | Example |
| --- | --- |
| A weekday that is wrong | Last week's date line was copied, and only the date changed |
| A skipped item number | Item 3 was dropped and the items were not renumbered |
| A count that does not match | "The meeting agreed on three points:" above two points |
| Nobody decided it | "it was decided that design B would be used" |

The last one leaves a later reader unable to find out who decided.

## What chaff checks, and what it does not

These are the main rules for this genre.

| Rule | What it finds | When it runs |
| --- | --- | --- |
| `heading-echo` | A first sentence that only repeats its heading | Always |
| `date-weekday-mismatch` | A date whose weekday disagrees with the calendar | With `--experimental` |
| `numbering-gap` | A skipped or repeated item number | With `--experimental` |
| `announced-count-mismatch` | A count announced that differs from the list below it | With `--experimental` |

What it does not do is decided too.

- It does not check that the minutes are true. Whether the meeting really decided that is for the people who were there.
- It does not check that every action has an owner. An empty cell in the table is for a person to fill.
- It does not check the weekday of a date written without a year, so the due dates in the table are not checked.
- It does not flag passives with nobody behind them ("it was decided"). Minutes record what the meeting did, so the meeting is the actor by the form.
  The rule would fire on almost every set of minutes.

## Try it

If you have not set up yet, do [Getting ready](./documents#getting-ready) first.
The minutes below were saved as `minutes.md`.

```markdown
# Website redesign weekly meeting: minutes

- Date: Tuesday, October 7, 2026, 10:00 to 11:00
- Place: Head office, Room B
- Attendees: Yamada (Sales), Suzuki (IT), Sasaki (Sasaki Studio)
- Minutes taken by: Suzuki

## 1. Actions from last week

All actions from last week are done. The contact form bug was fixed on September 30.

## 2. Home page designs

Sasaki presented two designs for the home page. Design A uses a large photo; design B puts the news at the top.

After discussion, it was decided that design B would be used.

## 4. Launch date

The launch date is November 20. The date may be moved if the KPI review requires it.

## Decisions

The meeting agreed on three points:

- The home page will use design B
- The launch date is November 20

## Actions

| Owner | Action | Due |
| --- | --- | --- |
| Sasaki | Finish design B | October 14 |
| Suzuki | Check the steps for the server move | October 14 |
| | Get permission to use the photos | October 10 |

The next meeting is on Wednesday, October 14, 2026, at 10:00 in the same room.
```

Without a genre, chaff reads these as a tech article. Name the genre.
`--compact` prints each finding on two lines.

```
$ npx chaffjs minutes.md --genre business/meeting-notes --compact

minutes.md   business/meeting-notes · English   genre from --genre

  10:1    warning The first sentence repeats the heading "1. Actions from last week"
                  heading-echo
  14:1    warning The first sentence repeats the heading "2. Home page designs"
                  heading-echo
  20:1    warning The first sentence repeats the heading "4. Launch date"
                  heading-echo

{counts}
```

Only `heading-echo` runs by default. The rules that help minutes most are experimental.
Add `--experimental` and run it again.

```
$ npx chaffjs minutes.md --genre business/meeting-notes --experimental --compact

minutes.md   business/meeting-notes · English   genre from --genre

  3:18    error   2026-10-07 is a Wednesday, not a Tuesday
                  date-weekday-mismatch
  10:1    warning The first sentence repeats the heading "1. Actions from last week"
                  heading-echo
  14:1    warning The first sentence repeats the heading "2. Home page designs"
                  heading-echo
  18:1    error   "4" follows "2" (expected number 3)
                  numbering-gap
  20:1    warning The first sentence repeats the heading "4. Launch date"
                  heading-echo
  24:23   warning "three points" is announced, but the number of items in the list below is 2
                  announced-count-mismatch

{counts}
```

## What each finding means

| Line | Finding | What it means | How to fix it |
| --- | --- | --- | --- |
| 3 | `date-weekday-mismatch` | October 7, 2026 is a Wednesday | Fix the weekday. If the meeting was on Tuesday, fix the date |
| 10, 14, 20 | `heading-echo` | Each section's first sentence repeats its heading | Start with what is new: "The contact form bug was fixed on September 30." |
| 18 | `numbering-gap` | Item 2 is followed by item 4 | Renumber to 3, or add the missing item 3 |
| 24 | `announced-count-mismatch` | It says "three points", but there are two | Add the missing decision, or say "two points" |

"It was decided" and "may be moved" do not say who decided or who moves it. This genre leaves passives alone, so a person reads for them.
The third row of the action table has no owner. chaff does not check that either, so a person fills it in.

## Checks that read meaning go to an AI

`npx chaffjs test` can have an AI read whether the minutes leave out something to watch for.
`npx chaffjs test minutes.md --genre business/meeting-notes --dry-run` says 1 passage would be sent.
What minutes must keep differs from meeting to meeting. Read the AI's answer and decide.

## A starter chaff.yaml

Put this `chaff.yaml` in the folder that holds your minutes.

```yaml
genre: business/meeting-notes
language: en

rules:
  date-weekday-mismatch: normal
  numbering-gap: normal
  announced-count-mismatch: normal
  required-sections: normal

required_sections:
  - Decisions
  - Actions
```

With this file in place, `npx chaffjs minutes.md --compact` alone shows all the findings above.
`required_sections` lists the headings every set of minutes needs.
Minutes without a "Decisions" or an "Actions" heading are flagged by `required-sections`.
How to write it is in [Configuration](./configuration), under "Deciding the team's jargon and required headings".

## What to read next

- How to silence one spot, and how to relax a rule, are in [Business reports](./documents-report).
- Every rule is explained in the [reference](./reference).
- For another kind of document, go back to [What chaff does for each kind of document](./documents).
