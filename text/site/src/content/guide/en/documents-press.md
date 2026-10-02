# Press releases and announcements

A press release or an announcement has to give outside readers its dates, counts and prices right the first time.
chaff finds by machine a wrong weekday, a period that runs backwards and a total that does not add up.
It also finds a breakdown that is not 100%, and a count that does not match its list.
The genre is `business/press-release`. Internal notices are checked under the same genre.

## What usually goes wrong

Dates and prices keep moving until the moment a release goes out. The figures that were changed sit next to the ones that were not.

| What goes wrong | Example |
| --- | --- |
| A weekday that is wrong | The launch moved by a day, but the weekday did not |
| A period that runs backwards | "October 26, 2026 – October 19, 2026" |
| A total that does not add up | The option's price changed, but the total did not |
| A breakdown that is not 100% | One share was changed, and the shares now add up to 95% |
| A count that does not match | "four features" above a list of three |

Once a release is out, fixing it means publishing a correction.

## What chaff checks, and what it does not

These are the main rules for this genre. All are experimental, and run with `--experimental`.

| Rule | What it finds |
| --- | --- |
| `date-weekday-mismatch` | A date whose weekday disagrees with the calendar |
| `date-range-reversed` | A period whose end comes before its start |
| `total-mismatch` | A total that is not the sum of the amounts above it |
| `percent-sum-mismatch` | Shares of a whole that do not add up to 100% |
| `announced-count-mismatch` | A count announced that differs from the list below it |
| `agentless-passive` | A passive that never says who did it |

What it does not do is decided too.

- It does not check that the figures are true. Whether 400 staff really took the survey is for the writer to check.
- It does not check the weekday of a date written without a year, since the year is unknown.
- Percentages are added up only when a nearby header or sentence names the parts of a whole (breakdown, market share, composition).
  Growth rates and usage rates do not add up to 100%, and are not added.

## Try it

If you have not set up yet, do [Getting ready](./documents#getting-ready) first.
The release below was saved as `release.md`. The company and the app are made up.

```markdown
# Minato Trading launches Yoyakun, a meeting room booking app, in November

October 15, 2026
Minato Trading Ltd.

Minato Trading Ltd. will launch Yoyakun, an app for booking meeting rooms from a smartphone, on Tuesday, November 2, 2026.

## Why we built it

In a survey of 400 staff in September, many said they were unhappy with how meeting rooms are booked.

| Complaint | Breakdown |
| --- | --- |
| Hard to find a free room | 45% |
| Cancelling takes too long | 30% |
| Other | 20% |

## Features

Yoyakun has four features:

- Find free rooms on a floor map
- Cancel a booking in one tap
- Sign in with the company's single sign-on

## Preview event

Before the launch, staff can try the app at a preview event.

- Dates: October 26, 2026 – October 19, 2026
- Place: Head office, ground floor lobby

## Pricing

| Plan | Per month |
| --- | --- |
| Basic plan | $300 |
| Map option | $50 |
| Total | $360 |

## Contact

Minato Trading Ltd., Press Office
```

With the genre and nothing else, there are no findings: the rules that help a release are all experimental.

```
$ npx chaffjs release.md --genre business/press-release --compact

release.md   business/press-release · English   genre from --genre


{counts}
```

Add `--experimental` to run them.
`--compact` prints each finding on two lines.

```
$ npx chaffjs release.md --genre business/press-release --experimental --compact

release.md   business/press-release · English   genre from --genre

  6:106   error   2026-11-02 is a Monday, not a Tuesday
                  date-weekday-mismatch
  10:95   warning This sentence is passive ("booked") but never says who did it
                  agentless-passive
  14:30   warning The shares add up to 95%, not 100%
                  percent-sum-mismatch
  20:13   warning "four features" is announced, but the number of items in the list below is 3
                  announced-count-mismatch
  30:10   warning The period "October 26, 2026 – October 19, 2026" ends before it starts
                  date-range-reversed
  39:12   error   The total $360 is not the sum of the amounts above it ($350)
                  total-mismatch

{counts}
```

`error` means the figures disagree, so one of them is certainly wrong.
`warning` is worth fixing.

## What each finding means

| Line | Finding | What it means | How to fix it |
| --- | --- | --- | --- |
| 6 | `date-weekday-mismatch` | November 2, 2026 is a Monday | Fix the weekday. To launch on a Tuesday, make it November 3 |
| 10 | `agentless-passive` | "how meeting rooms are booked" does not say who books them | Here the passive reads naturally; leave it, or say "how staff book meeting rooms" |
| 14 | `percent-sum-mismatch` | 45%, 30% and 20% make 95% | Check the survey and fix the wrong figure |
| 20 | `announced-count-mismatch` | It says "four features", but there are three | Add the missing feature, or say "three" |
| 30 | `date-range-reversed` | The end date comes before the start date | "October 19, 2026 – October 26, 2026" |
| 39 | `total-mismatch` | $300 and $50 make $350 | Fix the total, or the amount that is wrong |

For line 6, chaff does not decide whether the date or the weekday is wrong. The writer decides.
Run chaff again before the release goes out, and check that the findings are gone.

## Checks that read meaning go to an AI

`npx chaffjs test` can have an AI read whether the release leaves out something to watch for.
`npx chaffjs test release.md --genre business/press-release --dry-run` says 1 passage would be sent.

Line 10 says "many said they were unhappy", but not how many.
In this example, no passage goes to the check for numbers without a source, so chaff does not send this line to an AI either.
A person reads it, and writes the number: "280 of the 400".

## A starter chaff.yaml

Put this `chaff.yaml` in the folder that holds your releases.

```yaml
genre: business/press-release
language: en

rules:
  date-weekday-mismatch: normal
  date-range-reversed: normal
  total-mismatch: normal
  percent-sum-mismatch: normal
  announced-count-mismatch: normal
  required-sections: normal

required_sections:
  - Contact
```

With this file in place, `npx chaffjs release.md --compact` alone shows the findings above, except `agentless-passive`.
`required_sections` lists the headings every release needs.
A release without a "Contact" heading is flagged by `required-sections`.

## What to read next

- How to silence one spot, and how to relax a rule, are in [Business reports](./documents-report).
- Every rule is explained in the [reference](./reference).
- For another kind of document, go back to [What chaff does for each kind of document](./documents).
