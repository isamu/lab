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

These are the main rules for this genre. All of them run by default.

| Rule | What it finds |
| --- | --- |
| `date-weekday-mismatch` | A date whose weekday disagrees with the calendar |
| `numbering-gap` | A skipped or repeated item number |
| `announced-count-mismatch` | A count announced that differs from the list below it |
| `heading-echo` | A first sentence that only repeats its heading |

What it does not do is decided too.

- It does not check that the minutes are true. Whether the meeting really decided that is for the people who were there.
- It does not check that every action has an owner. An empty cell in the table is for a person to fill.
- The due dates in the table give no weekday, so there is nothing to check there. A date without its year that does give one is read in the year that puts it within five months of the dated date before it, and checked.
- It does not flag passives with nobody behind them ("it was decided"). Minutes record what the meeting did, so the meeting is the actor by the form.
  The rule would fire on almost every set of minutes.

## Try it

If you have not set up yet, do [Getting ready](./documents#getting-ready) first.
The minutes below were saved as `minutes.md`.

```markdown file=minutes.md
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

  3:18    error   2026-10-07 is a Wednesday, not a Tuesday
                  date-weekday-mismatch
  10:1    info    The first sentence repeats the heading "1. Actions from last week"
                  heading-echo
  14:1    info    The first sentence repeats the heading "2. Home page designs"
                  heading-echo
  18:1    error   "4" follows "2" (expected number 3)
                  numbering-gap
  20:1    info    The first sentence repeats the heading "4. Launch date"
                  heading-echo
  22:1    info    The heading "Decisions" has no number, while 3 of its siblings do ("1. Actions from last week")
                  heading-numbering-mix
  24:23   warning "three points" is announced, but the number of items in the list below is 2
                  announced-count-mismatch
  29:1    info    The heading "Actions" has no number, while 3 of its siblings do ("1. Actions from last week")
                  heading-numbering-mix

{counts}
```

## The guide that comes first

With the genre set, chaff opens the report with the genre's guide: what good minutes do, as questions to check the draft against.
Under them is a line naming the rules that matter most for this genre.
Most of the questions are ones no rule can answer, so read them before the findings.
An AI that rewrites the text works to the same lines ([Using the guide with an AI](./ai-sounding#give-the-ai-the-genres-guide)).

```
$ npx chaffjs minutes.md --genre business/meeting-notes

Guide: Meeting notes (business/meeting-notes)

  Before the findings below, check the draft against these.

  - Are the date, the attendees and the agenda at the top?
  - Are decisions kept apart from what was only discussed?
  - Does each action item have an owner and a deadline?
  - Are the next meeting and the items carried over recorded?

  Rules that matter most for this genre: cushion-phrase-density, due-before-issue, preamble-length, request-without-deadline, risk-disclosure, unsourced-number
  Change it with guide: in chaff.yaml; leave it out with --no-guide.

════════════════════════════════════════════════════════════

minutes.md   business/meeting-notes · English   genre from --genre
…
```

A genre that was guessed from the path or the content, or left at the default, prints no guide.
A guide for the wrong kind of document would mislead.
`--compact` and `--no-guide` leave it out.
A team changes the lines with `guide:` in `chaff.yaml` ([Changing the genre's guide](./configuration#changing-the-genres-guide)).

## What each finding means

| Line | Finding | What it means | How to fix it |
| --- | --- | --- | --- |
| 3 | `date-weekday-mismatch` | October 7, 2026 is a Wednesday | Fix the weekday. If the meeting was on Tuesday, fix the date |
| 10, 14, 20 | `heading-echo` | Each section's first sentence repeats its heading | Start with what is new: "The contact form bug was fixed on September 30." |
| 18 | `numbering-gap` | Item 2 is followed by item 4 | Renumber to 3, or add the missing item 3 |
| 22, 29 | `heading-numbering-mix` | "Decisions" and "Actions" have no number, while the agenda headings beside them do | Number them too, or put them at a different heading level from the numbered agenda items |
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

required_sections:
  - Decisions
  - Actions
```

With this file in place, `npx chaffjs minutes.md --compact` needs no `--genre`.
`required_sections` lists the headings every set of minutes needs.
Minutes without a "Decisions" or an "Actions" heading are flagged by `required-sections`.
How to write it is in [Configuration](./configuration), under "Deciding the team's jargon and required headings".

## What to read next

- How to silence one spot, and how to relax a rule, are in [Business reports](./documents-report).
- Every rule is explained in the [reference](./reference).
- For another kind of document, go back to [What chaff does for each kind of document](./documents).
